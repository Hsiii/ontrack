import {
    ensureRouteTimetable,
    ensureStations,
    getLiveBoard,
    getTaipeiDate,
    refreshDailySnapshots,
    refreshLiveBoard,
} from './refresh';
import type {
    DelaySnapshot,
    Env,
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
    '*/5 0-15,21-23 * * *',
    '*/10 16,20 * * *',
]);
const DAILY_REFRESH_CRON = '50 19 * * *';

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

async function handleSchedule(url: URL, env: Env) {
    const origin = url.searchParams.get('origin');
    const dest = url.searchParams.get('dest');
    const date = url.searchParams.get('date');

    if (!origin || !dest) {
        return json(
            { error: 'Missing origin or dest parameters' },
            { status: 400 }
        );
    }

    if (!isValidStationId(origin) || !isValidStationId(dest)) {
        return json({ error: 'Invalid station ID format' }, { status: 400 });
    }

    if (date && !isValidDate(date)) {
        return json(
            { error: 'Invalid date format. Use YYYY-MM-DD' },
            { status: 400 }
        );
    }

    const queryDate = date || getTaipeiDate();
    const isToday = queryDate === getTaipeiDate();
    const [routeTrains, liveBoard] = await Promise.all([
        ensureRouteTimetable(env, queryDate, origin, dest),
        isToday
            ? getLiveBoard(env)
            : Promise.resolve<DelaySnapshot>({ delays: {} }),
    ]);
    const delayMap = new Map(Object.entries(liveBoard.delays));
    const trains = routeTrains
        .map((t) => mapTrainToAppTrainInfo(t, origin, dest, delayMap))
        .filter((t): t is TrainInfo => t !== null)
        .sort((a, b) => a.departureTime.localeCompare(b.departureTime));

    return json(
        {
            date: queryDate,
            origin: { id: origin, name: origin },
            destination: { id: dest, name: dest },
            trains,
        },
        {
            headers: {
                'Cache-Control':
                    'public, s-maxage=60, stale-while-revalidate=300',
            },
        }
    );
}

async function handleRefresh(request: Request, env: Env) {
    if (!env.REFRESH_SECRET) {
        return json({ error: 'Manual refresh disabled' }, { status: 404 });
    }

    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${env.REFRESH_SECRET}`) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    await Promise.all([refreshDailySnapshots(env), refreshLiveBoard(env)]);
    return json({ ok: true });
}

async function handleApi(request: Request, env: Env) {
    const url = new URL(request.url);

    try {
        if (url.pathname === '/api/stations') {
            return handleStations(env);
        }

        if (url.pathname === '/api/schedule') {
            return handleSchedule(url, env);
        }

        if (url.pathname === '/api/refresh') {
            return handleRefresh(request, env);
        }

        return json({ error: 'Not found' }, { status: 404 });
    } catch (error) {
        console.error('Worker API error:', error);
        return json(
            { error: 'Failed to fetch schedule data. Please try again.' },
            { status: 500 }
        );
    }
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname.startsWith('/api/')) {
            return handleApi(request, env);
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
            ? refreshLiveBoard(env)
            : controller.cron === DAILY_REFRESH_CRON
              ? refreshDailySnapshots(env)
              : Promise.resolve();

        ctx.waitUntil(refresh);
    },
} satisfies ExportedHandler<Env>;
