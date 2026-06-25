import {
    getSnapshot,
    getTopRouteInterests,
    pruneSnapshots,
    upsertSnapshot,
} from './d1';
import { fetchTDX, fetchTDXWithCache } from './tdx';
import type {
    DelaySnapshot,
    Env,
    ScheduleCacheStatus,
    Snapshot,
    Station,
    TDXFullTimetable,
    TDXStation,
    TDXTimetableResponse,
} from './types';

export const STATIONS_KEY = 'stations';
export const LIVE_BOARD_KEY = 'train-live-board';
export const LIVE_BOARD_FRESH_SECONDS = 5 * 60;
const ROUTE_TIMETABLE_RETENTION_DAYS = 2;
const FULL_TIMETABLE_RETENTION_DAYS = 2;
const POPULAR_ROUTE_PREWARM_LIMIT = 12;
const dailyTimetableRefreshes = new Map<string, Promise<TDXFullTimetable[]>>();
let liveBoardRefresh: Promise<DelaySnapshot> | null = null;

export interface CachedRouteTimetable {
    timetables: TDXFullTimetable[];
    cacheStatus: ScheduleCacheStatus;
    snapshotFetchedAt: string | null;
}

export function getTaipeiDate(date = new Date()) {
    return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
}

function getRoutePruneCutoffDate(date = new Date()) {
    return getTaipeiDate(
        new Date(
            date.getTime() -
                ROUTE_TIMETABLE_RETENTION_DAYS * 24 * 60 * 60 * 1000
        )
    );
}

function getFullTimetablePruneCutoffDate(date = new Date()) {
    return getTaipeiDate(
        new Date(
            date.getTime() - FULL_TIMETABLE_RETENTION_DAYS * 24 * 60 * 60 * 1000
        )
    );
}

export function getNextTaipeiDate(date = new Date()) {
    return getTaipeiDate(new Date(date.getTime() + 24 * 60 * 60 * 1000));
}

export function shouldRefreshLiveBoard(date = new Date()) {
    const hour = Number(
        date.toLocaleTimeString('en-CA', {
            hour: '2-digit',
            hour12: false,
            timeZone: 'Asia/Taipei',
        })
    );

    return hour === 0 || hour >= 4;
}

export function timetableKey(date: string) {
    return `daily-timetable:${date}`;
}

export function routeTimetableKey(date: string, origin: string, dest: string) {
    return `daily-timetable-od:${date}:${origin}:${dest}`;
}

function toStations(data: TDXStation[]): Station[] {
    return data.map((station) => ({
        id: station.StationID,
        name: station.StationName.Zh_tw,
        nameEn: station.StationName.En,
        lat: station.StationPosition?.PositionLat,
        lon: station.StationPosition?.PositionLon,
    }));
}

export async function refreshStations(env: Env) {
    const data = await fetchTDX<TDXStation[] | { Stations?: TDXStation[] }>(
        env,
        'v3/Rail/TRA/Station',
        {
            searchParams: {
                $select: 'StationID,StationName,StationPosition',
                $top: '999',
            },
            tier: 'basic',
            caller: 'station-refresh',
        }
    );

    const stations = toStations(
        Array.isArray(data) ? data : (data.Stations ?? [])
    );
    await upsertSnapshot(env, STATIONS_KEY, stations, null);
    return stations;
}

export async function refreshTimetable(env: Env, date = getTaipeiDate()) {
    const path =
        date === getTaipeiDate()
            ? 'v3/Rail/TRA/DailyTrainTimetable/Today'
            : `v3/Rail/TRA/DailyTrainTimetable/TrainDate/${date}`;
    const data = await fetchTDX<TDXTimetableResponse>(env, path, {
        searchParams: {
            $select: 'TrainInfo,StopTimes',
        },
        tier: 'basic',
        caller: 'daily-timetable-refresh',
    });
    const timetables = data.TrainTimetables ?? [];

    await upsertSnapshot(env, timetableKey(date), timetables, null);
    return timetables;
}

export function filterRouteTimetables(
    timetables: TDXFullTimetable[],
    origin: string,
    dest: string
) {
    const routeTimetables: TDXFullTimetable[] = [];

    for (const timetable of timetables) {
        const stops = timetable.StopTimes || [];
        let originStop: TDXFullTimetable['StopTimes'][number] | null = null;
        let destStop: TDXFullTimetable['StopTimes'][number] | null = null;

        for (const stop of stops) {
            if (!originStop) {
                if (stop.StationID === origin) {
                    originStop = stop;
                }
                continue;
            }

            if (stop.StationID === dest) {
                destStop = stop;
                break;
            }
        }

        if (originStop && destStop) {
            routeTimetables.push({
                ...timetable,
                StopTimes: [originStop, destStop],
            });
        }
    }

    return routeTimetables;
}

async function refreshLiveBoardUncached(env: Env) {
    const previous = await getSnapshot<DelaySnapshot>(env, LIVE_BOARD_KEY);
    const response = await fetchTDXWithCache<{
        TrainLiveBoards?: { TrainNo: string; DelayTime?: number }[];
        TrainLiveBoardList?: { TrainNo: string; DelayTime?: number }[];
    }>(env, 'v3/Rail/TRA/TrainLiveBoard', {
        tier: 'basic',
        searchParams: {
            $select: 'TrainNo,DelayTime',
        },
        ifModifiedSince: previous?.last_modified,
        caller: 'live-board-refresh',
    });

    if (response.notModified && previous) {
        await upsertSnapshot(
            env,
            LIVE_BOARD_KEY,
            previous.data,
            response.lastModified
        );
        return previous.data;
    }

    const liveData =
        response.data?.TrainLiveBoards ??
        response.data?.TrainLiveBoardList ??
        [];
    const delays = Object.fromEntries(
        liveData.map((train) => [train.TrainNo, train.DelayTime ?? 0])
    );
    const snapshot: DelaySnapshot = { delays };

    await upsertSnapshot(env, LIVE_BOARD_KEY, snapshot, response.lastModified);

    return snapshot;
}

export async function refreshLiveBoard(env: Env) {
    if (liveBoardRefresh) {
        return liveBoardRefresh;
    }

    liveBoardRefresh = refreshLiveBoardUncached(env).finally(() => {
        liveBoardRefresh = null;
    });
    return liveBoardRefresh;
}

export async function ensureStations(env: Env) {
    const snapshot = await getSnapshot<Station[]>(env, STATIONS_KEY);
    return snapshot?.data ?? refreshStations(env);
}

export async function getLiveBoardSnapshot(env: Env) {
    return getSnapshot<DelaySnapshot>(env, LIVE_BOARD_KEY);
}

export function getSnapshotAgeSeconds(snapshot: Snapshot<unknown>) {
    return Math.max(
        0,
        Math.floor((Date.now() - Date.parse(snapshot.fetched_at)) / 1000)
    );
}

export async function ensureTimetable(env: Env, date: string) {
    const snapshot = await getSnapshot<TDXFullTimetable[]>(
        env,
        timetableKey(date)
    );
    if (snapshot) {
        return snapshot.data;
    }

    const existingRefresh = dailyTimetableRefreshes.get(date);
    if (existingRefresh) {
        return existingRefresh;
    }

    const refresh = refreshTimetable(env, date).finally(() =>
        dailyTimetableRefreshes.delete(date)
    );
    dailyTimetableRefreshes.set(date, refresh);
    return refresh;
}

async function deriveRouteFromDailySnapshot(
    env: Env,
    date: string,
    origin: string,
    dest: string,
    snapshot: Snapshot<TDXFullTimetable[]>
): Promise<CachedRouteTimetable> {
    const timetables = filterRouteTimetables(snapshot.data, origin, dest);
    try {
        await upsertSnapshot(
            env,
            routeTimetableKey(date, origin, dest),
            timetables,
            null
        );
    } catch (error) {
        console.error('Failed to cache derived route timetable:', error);
    }

    return {
        timetables,
        cacheStatus: 'derived',
        snapshotFetchedAt: snapshot.fetched_at,
    };
}

export async function getCachedRouteTimetable(
    env: Env,
    date: string,
    origin: string,
    dest: string
): Promise<CachedRouteTimetable> {
    const routeSnapshot = await getSnapshot<TDXFullTimetable[]>(
        env,
        routeTimetableKey(date, origin, dest)
    );
    if (routeSnapshot) {
        return {
            timetables: routeSnapshot.data,
            cacheStatus: 'hit',
            snapshotFetchedAt: routeSnapshot.fetched_at,
        };
    }

    const dailySnapshot = await getSnapshot<TDXFullTimetable[]>(
        env,
        timetableKey(date)
    );
    if (dailySnapshot) {
        return deriveRouteFromDailySnapshot(
            env,
            date,
            origin,
            dest,
            dailySnapshot
        );
    }

    return {
        timetables: [],
        cacheStatus: 'warming',
        snapshotFetchedAt: null,
    };
}

export async function ensureRouteTimetable(
    env: Env,
    date: string,
    origin: string,
    dest: string
) {
    const cached = await getCachedRouteTimetable(env, date, origin, dest);
    if (cached.cacheStatus !== 'warming') {
        return cached.timetables;
    }

    const dailyTimetables = await ensureTimetable(env, date);
    const routeTimetables = filterRouteTimetables(
        dailyTimetables,
        origin,
        dest
    );
    await upsertSnapshot(
        env,
        routeTimetableKey(date, origin, dest),
        routeTimetables,
        null
    );
    return routeTimetables;
}

export async function getLiveBoard(env: Env) {
    const snapshot = await getSnapshot<DelaySnapshot>(env, LIVE_BOARD_KEY);
    return snapshot?.data ?? refreshLiveBoard(env);
}

export async function refreshDailySnapshots(env: Env) {
    const today = getTaipeiDate();
    const tomorrow = getNextTaipeiDate();

    await Promise.all([
        refreshStations(env),
        refreshTimetable(env, today),
        refreshTimetable(env, tomorrow),
        pruneSnapshots(
            env,
            getRoutePruneCutoffDate(),
            getFullTimetablePruneCutoffDate()
        ),
    ]);

    const routes = await getTopRouteInterests(env, POPULAR_ROUTE_PREWARM_LIMIT);
    await Promise.all(
        routes.flatMap((route) => [
            getCachedRouteTimetable(env, today, route.origin, route.dest),
            getCachedRouteTimetable(env, tomorrow, route.origin, route.dest),
        ])
    );
}
