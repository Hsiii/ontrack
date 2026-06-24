import { getSnapshot, pruneSnapshots, upsertSnapshot } from './d1';
import { fetchTDX, fetchTDXWithCache } from './tdx';
import type {
    DelaySnapshot,
    Env,
    Station,
    TDXFullTimetable,
    TDXStation,
    TDXTimetableResponse,
} from './types';

export const STATIONS_KEY = 'stations';
export const LIVE_BOARD_KEY = 'train-live-board';
const ROUTE_TIMETABLE_RETENTION_DAYS = 2;
const routeTimetableRefreshes = new Map<string, Promise<TDXFullTimetable[]>>();

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

export async function refreshRouteTimetable(
    env: Env,
    date: string,
    origin: string,
    dest: string
) {
    const data = await fetchTDX<TDXTimetableResponse>(
        env,
        `v3/Rail/TRA/DailyTrainTimetable/OD/${origin}/to/${dest}/${date}`,
        {
            tier: 'basic',
            caller: 'route-cache-miss',
        }
    );
    const timetables = data.TrainTimetables ?? [];

    await upsertSnapshot(
        env,
        routeTimetableKey(date, origin, dest),
        timetables,
        null
    );
    return timetables;
}

export async function refreshLiveBoard(env: Env) {
    const previous = await getSnapshot<DelaySnapshot>(env, LIVE_BOARD_KEY);
    const response = await fetchTDXWithCache<{
        TrainLiveBoards?: { TrainNo: string; DelayTime?: number }[];
        TrainLiveBoardList?: { TrainNo: string; DelayTime?: number }[];
    }>(env, 'v3/Rail/TRA/TrainLiveBoard', {
        tier: 'basic',
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

export async function ensureStations(env: Env) {
    const snapshot = await getSnapshot<Station[]>(env, STATIONS_KEY);
    return snapshot?.data ?? refreshStations(env);
}

export async function ensureRouteTimetable(
    env: Env,
    date: string,
    origin: string,
    dest: string
) {
    const key = routeTimetableKey(date, origin, dest);
    const snapshot = await getSnapshot<TDXFullTimetable[]>(env, key);
    if (snapshot) {
        return snapshot.data;
    }

    const existingRefresh = routeTimetableRefreshes.get(key);
    if (existingRefresh) {
        return existingRefresh;
    }

    const refresh = refreshRouteTimetable(env, date, origin, dest).finally(() =>
        routeTimetableRefreshes.delete(key)
    );
    routeTimetableRefreshes.set(key, refresh);
    return refresh;
}

export async function getLiveBoard(env: Env) {
    const snapshot = await getSnapshot<DelaySnapshot>(env, LIVE_BOARD_KEY);
    return snapshot?.data ?? refreshLiveBoard(env);
}

export async function refreshDailySnapshots(env: Env) {
    await Promise.all([
        refreshStations(env),
        pruneSnapshots(env, getRoutePruneCutoffDate()),
    ]);
}
