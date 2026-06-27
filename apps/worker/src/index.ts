import { recordRouteInterest } from './d1';
import {
    ensureRouteTimetable,
    ensureStations,
    getCachedRouteTimetable,
    getLiveBoardPolicy,
    getLiveBoardSnapshot,
    getSnapshotAgeSeconds,
    getTaipeiDate,
    refreshDailySnapshots,
    refreshLiveBoardForAuto,
    refreshLiveBoardForCron,
    refreshLiveBoardForManual,
} from './refresh';
import { TDXServiceError } from './tdx';
import type {
    Env,
    LiveDataStatus,
    ScheduleMeta,
    TDXFullTimetable,
    TDXStopTime,
    TrainInfo,
} from './types';

const SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(self), microphone=(), camera=()',
};
const LIVE_BOARD_REFRESH_CRONS = new Set([
    '*/10 6-8,16-19 * * *',
    '*/30 9-15,20-22 * * *',
    '0 0-5,23 * * *',
]);
const DAILY_REFRESH_CRON = '50 19 * * *';
type ApiErrorCode =
    | 'bad_request'
    | 'not_found'
    | 'unauthorized'
    | 'service_capacity'
    | 'upstream_unavailable'
    | 'service_unavailable'
    | 'internal_error';

function json(data: unknown, init: ResponseInit = {}) {
    return new Response(JSON.stringify(data), {
        ...init,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            ...SECURITY_HEADERS,
            ...init.headers,
        },
    });
}

function jsonError(
    code: ApiErrorCode,
    message: string,
    status: number,
    requestId: string,
    init: ResponseInit = {}
) {
    return json(
        {
            error: {
                code,
                message,
                requestId,
            },
        },
        {
            ...init,
            status,
        }
    );
}

function getRequestId(request: Request) {
    return (
        request.headers.get('cf-ray') ??
        request.headers.get('x-request-id') ??
        crypto.randomUUID()
    );
}

function waitUntilLogged(
    ctx: ExecutionContext,
    task: Promise<unknown>,
    label: string
) {
    ctx.waitUntil(
        task.catch((error) => {
            console.error(`${label} failed:`, error);
        })
    );
}

function isValidStationId(id: unknown): id is string {
    return (
        typeof id === 'string' && /^[A-Z0-9-]+$/i.test(id) && id.length <= 10
    );
}

function isValidDate(date: unknown): date is string {
    return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function mapTrainToAppTrainInfo(
    timetable: TDXFullTimetable,
    origin: string,
    dest: string,
    delayMap: Map<string, number>
): TrainInfo | null {
    const stops = timetable.StopTimes || [];
    let originStop: TDXStopTime | null = null;
    let destStop: TDXStopTime | null = null;

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

    if (!originStop || !destStop) {
        return null;
    }

    const trainNo = timetable.TrainInfo.TrainNo;
    const delay = delayMap.get(trainNo);
    const status =
        delay === undefined ? 'unknown' : delay > 0 ? 'delayed' : 'on-time';

    return {
        trainNo,
        trainType: timetable.TrainInfo.TrainTypeName.Zh_tw,
        direction: timetable.TrainInfo.Direction,
        originStation: originStop.StationName.Zh_tw,
        destinationStation: destStop.StationName.Zh_tw,
        departureTime: originStop.DepartureTime,
        arrivalTime: destStop.ArrivalTime,
        delay: delay || 0,
        status,
    };
}

async function handleStations(env: Env) {
    const stations = await ensureStations(env);

    return json(stations, {
        headers: {
            'Cache-Control':
                'public, s-maxage=86400, stale-while-revalidate=604800',
        },
    });
}

function getLiveDataStatus(
    isToday: boolean,
    liveBoard: Awaited<ReturnType<typeof getLiveBoardSnapshot>>,
    maxAgeSeconds: number
): {
    status: LiveDataStatus;
    fetchedAt: string | null;
    ageSeconds: number | null;
} {
    if (!isToday) {
        return {
            status: 'not-applicable',
            fetchedAt: null,
            ageSeconds: null,
        };
    }

    if (!liveBoard) {
        return {
            status: 'unavailable',
            fetchedAt: null,
            ageSeconds: null,
        };
    }

    const ageSeconds = getSnapshotAgeSeconds(liveBoard);
    return {
        status: ageSeconds <= maxAgeSeconds ? 'fresh' : 'stale',
        fetchedAt: liveBoard.fetched_at,
        ageSeconds,
    };
}

async function handleSchedule(
    url: URL,
    env: Env,
    ctx: ExecutionContext,
    requestId: string
) {
    const origin = url.searchParams.get('origin');
    const dest = url.searchParams.get('dest');
    const date = url.searchParams.get('date');
    const forceLiveRefresh = url.searchParams.get('refreshLive') === '1';

    if (!origin || !dest) {
        return jsonError(
            'bad_request',
            'Choose both an origin and destination, then try again.',
            400,
            requestId
        );
    }

    if (!isValidStationId(origin) || !isValidStationId(dest)) {
        return jsonError(
            'bad_request',
            'One of the selected stations is invalid. Choose the stations again.',
            400,
            requestId
        );
    }

    if (date && !isValidDate(date)) {
        return jsonError(
            'bad_request',
            'The selected date is invalid. Choose a date again.',
            400,
            requestId
        );
    }

    const queryDate = date || getTaipeiDate();
    const isToday = queryDate === getTaipeiDate();
    const requestedAt = new Date();
    const livePolicy = getLiveBoardPolicy(requestedAt);
    waitUntilLogged(
        ctx,
        recordRouteInterest(env, origin, dest, requestedAt),
        'Route interest update'
    );

    const [routeResult, liveBoardSnapshot] = await Promise.all([
        getCachedRouteTimetable(env, queryDate, origin, dest),
        isToday ? getLiveBoardSnapshot(env) : Promise.resolve(null),
    ]);
    let liveBoard = liveBoardSnapshot;
    let liveData = getLiveDataStatus(
        isToday,
        liveBoard,
        livePolicy.maxAgeSeconds
    );

    if (routeResult.cacheStatus === 'warming') {
        waitUntilLogged(
            ctx,
            ensureRouteTimetable(env, queryDate, origin, dest),
            'Route timetable warmup'
        );
    }

    const shouldAttemptLiveRefresh =
        liveData.status === 'stale' || liveData.status === 'unavailable';
    if (forceLiveRefresh && isToday && shouldAttemptLiveRefresh) {
        try {
            await refreshLiveBoardForManual(env, requestedAt);
            liveBoard = await getLiveBoardSnapshot(env);
            liveData = getLiveDataStatus(
                isToday,
                liveBoard,
                livePolicy.maxAgeSeconds
            );
        } catch (error) {
            console.error('Manual live board refresh failed:', error);
        }
    } else if (shouldAttemptLiveRefresh) {
        waitUntilLogged(
            ctx,
            refreshLiveBoardForAuto(env, origin, dest, requestedAt),
            'Live board refresh'
        );
    }

    const delayMap =
        liveData.status === 'fresh' && liveBoard
            ? new Map(Object.entries(liveBoard.data.delays))
            : new Map<string, number>();
    const trains = routeResult.timetables
        .map((t) => mapTrainToAppTrainInfo(t, origin, dest, delayMap))
        .filter((t): t is TrainInfo => t !== null)
        .sort((a, b) => a.departureTime.localeCompare(b.departureTime));
    const meta: ScheduleMeta = {
        scheduleCacheStatus: routeResult.cacheStatus,
        scheduleSnapshotFetchedAt: routeResult.snapshotFetchedAt,
        liveDataStatus: liveData.status,
        liveDataFetchedAt: liveData.fetchedAt,
        liveDataAgeSeconds: liveData.ageSeconds,
    };

    return json(
        {
            date: queryDate,
            origin: { id: origin, name: origin },
            destination: { id: dest, name: dest },
            trains,
            meta,
        },
        {
            status: routeResult.cacheStatus === 'warming' ? 202 : 200,
            headers: {
                'Cache-Control':
                    forceLiveRefresh || routeResult.cacheStatus === 'warming'
                        ? 'no-store'
                        : 'public, s-maxage=60, stale-while-revalidate=300',
            },
        }
    );
}

async function handleRefresh(request: Request, env: Env, requestId: string) {
    if (!env.REFRESH_SECRET) {
        return jsonError(
            'not_found',
            'This OnTrack endpoint is not available.',
            404,
            requestId
        );
    }

    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${env.REFRESH_SECRET}`) {
        return jsonError(
            'unauthorized',
            'This OnTrack request is not authorized.',
            401,
            requestId
        );
    }

    await Promise.all([
        refreshDailySnapshots(env),
        refreshLiveBoardForManual(env),
    ]);
    return json({ ok: true });
}

async function handleApi(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const requestId = getRequestId(request);

    try {
        if (url.pathname === '/api/stations') {
            return handleStations(env);
        }

        if (url.pathname === '/api/schedule') {
            return handleSchedule(url, env, ctx, requestId);
        }

        if (url.pathname === '/api/refresh') {
            return handleRefresh(request, env, requestId);
        }

        return jsonError(
            'not_found',
            'This OnTrack endpoint is not available.',
            404,
            requestId
        );
    } catch (error) {
        console.error(
            JSON.stringify({
                event: 'worker_api_error',
                requestId,
                path: url.pathname,
                errorName: error instanceof Error ? error.name : typeof error,
                errorMessage:
                    error instanceof Error ? error.message : String(error),
                errorStack: error instanceof Error ? error.stack : undefined,
            })
        );

        if (error instanceof TDXServiceError) {
            if (error.kind === 'capacity') {
                return jsonError(
                    'service_capacity',
                    'OnTrack railway data is temporarily at capacity. Please try again later.',
                    503,
                    requestId
                );
            }

            if (error.kind === 'upstream') {
                return jsonError(
                    'upstream_unavailable',
                    'Taiwan railway data is temporarily unavailable. OnTrack will work again when the data service recovers.',
                    503,
                    requestId
                );
            }
        }

        return jsonError(
            'service_unavailable',
            'OnTrack railway data is temporarily unavailable. Please try again later.',
            503,
            requestId
        );
    }
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        if (url.pathname.startsWith('/api/')) {
            return handleApi(request, env, ctx);
        }

        const response = await env.ASSETS.fetch(request);
        const headers = new Headers(response.headers);
        Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
            headers.set(key, value);
        });

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
        });
    },

    async scheduled(controller, env, ctx) {
        const refresh = LIVE_BOARD_REFRESH_CRONS.has(controller.cron)
            ? refreshLiveBoardForCron(env)
            : controller.cron === DAILY_REFRESH_CRON
              ? refreshDailySnapshots(env)
              : Promise.resolve();

        ctx.waitUntil(refresh);
    },
} satisfies ExportedHandler<Env>;
