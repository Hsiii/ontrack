const FREQUENT_DESTINATIONS_KEY = 'ontrack_frequent_destinations';
const LEGACY_RECENT_STATIONS_KEY = 'ontrack_recent_stations';
const LEGACY_RECENT_DEPARTURE_STATIONS_KEY =
    'ontrack_recent_departure_stations';
const MAX_FREQUENT_DESTINATIONS = 24;
const DECAY_DAYS = 45;

const HOUR_BUCKETS = [
    { key: '0-5', start: 0, end: 5 },
    { key: '6-9', start: 6, end: 9 },
    { key: '10-15', start: 10, end: 15 },
    { key: '16-19', start: 16, end: 19 },
    { key: '20-23', start: 20, end: 23 },
] as const;

const PRIOR_STATION_NAMES = [
    '新竹',
    '臺北',
    '台北',
    '板橋',
    '桃園',
    '臺中',
    '台中',
    '臺南',
    '台南',
    '高雄',
    '新左營',
    '松山',
    '彰化',
    '嘉義',
];

type DayType = 'weekday' | 'weekend';
type HourBucket = (typeof HOUR_BUCKETS)[number]['key'];
type TimeContextKey = `${DayType}:${HourBucket}`;

interface FrequentDestination {
    originId: string;
    id: string;
    count: number;
    updatedAt: number;
    contexts?: Partial<Record<TimeContextKey, DestinationTimeContext>>;
}

interface DestinationTimeContext {
    count: number;
    updatedAt: number;
}

interface DestinationCandidate {
    id: string;
    name?: string;
}

function canUseLocalStorage() {
    return typeof window !== 'undefined' && Boolean(window.localStorage);
}

function isValidStationId(id: string) {
    return /^[A-Z0-9-]*$/i.test(id) && id.length <= 10;
}

function readLegacyStationIds(key: string): string[] {
    try {
        const storedValue = localStorage.getItem(key);
        if (!storedValue) return [];

        const parsedValue = JSON.parse(storedValue);
        return Array.isArray(parsedValue)
            ? parsedValue.filter(
                  (item): item is string =>
                      typeof item === 'string' && isValidStationId(item)
              )
            : [];
    } catch {
        return [];
    }
}

function readFrequentDestinations(): FrequentDestination[] {
    try {
        const storedValue = localStorage.getItem(FREQUENT_DESTINATIONS_KEY);
        if (!storedValue) return [];

        const parsedValue = JSON.parse(storedValue);
        if (!Array.isArray(parsedValue)) return [];

        return parsedValue.flatMap((item): FrequentDestination[] => {
            if (
                typeof item !== 'object' ||
                item === null ||
                !('id' in item) ||
                !('count' in item) ||
                !('updatedAt' in item)
            ) {
                return [];
            }

            const originId =
                'originId' in item && typeof item.originId === 'string'
                    ? item.originId
                    : '';
            if (originId && !isValidStationId(originId)) {
                return [];
            }

            if (
                typeof item.id !== 'string' ||
                !isValidStationId(item.id) ||
                typeof item.count !== 'number' ||
                item.count <= 0 ||
                typeof item.updatedAt !== 'number'
            ) {
                return [];
            }

            const contexts =
                'contexts' in item ? readTimeContexts(item.contexts) : {};

            return [
                {
                    originId,
                    id: item.id,
                    count: item.count,
                    updatedAt: item.updatedAt,
                    ...(Object.keys(contexts).length > 0 ? { contexts } : {}),
                },
            ];
        });
    } catch {
        return [];
    }
}

function readFrequentDestinationsWithLegacy(): FrequentDestination[] {
    const storedRecords = readFrequentDestinations();
    if (storedRecords.length > 0) return storedRecords;

    const legacyIds = [
        ...readLegacyStationIds(LEGACY_RECENT_STATIONS_KEY),
        ...readLegacyStationIds(LEGACY_RECENT_DEPARTURE_STATIONS_KEY),
    ].filter((id, index, ids) => ids.indexOf(id) === index);

    return legacyIds.map((id, index) => ({
        originId: '',
        id,
        count: legacyIds.length - index,
        updatedAt: Date.now() - index,
    }));
}

function sortDestinations(destinations: FrequentDestination[]) {
    return [...destinations].sort(
        (a, b) => b.count - a.count || b.updatedAt - a.updatedAt
    );
}

function readTimeContexts(value: unknown) {
    if (typeof value !== 'object' || value === null) {
        return {};
    }

    return Object.entries(value).reduce<
        Partial<Record<TimeContextKey, DestinationTimeContext>>
    >((contexts, [key, context]) => {
        if (
            !isTimeContextKey(key) ||
            typeof context !== 'object' ||
            context === null ||
            !('count' in context) ||
            !('updatedAt' in context) ||
            typeof context.count !== 'number' ||
            context.count <= 0 ||
            typeof context.updatedAt !== 'number'
        ) {
            return contexts;
        }

        contexts[key] = {
            count: context.count,
            updatedAt: context.updatedAt,
        };
        return contexts;
    }, {});
}

function isTimeContextKey(value: string): value is TimeContextKey {
    return /^(weekday|weekend):(0-5|6-9|10-15|16-19|20-23)$/.test(value);
}

function getTimeContext(date: Date): TimeContextKey {
    const dayType: DayType =
        date.getDay() === 0 || date.getDay() === 6 ? 'weekend' : 'weekday';
    const hour = date.getHours();
    const bucket = HOUR_BUCKETS.find(
        ({ start, end }) => hour >= start && hour <= end
    );

    return `${dayType}:${bucket?.key ?? '20-23'}`;
}

function getDecayedCount(count: number, updatedAt: number, now: number) {
    const ageDays = Math.max(0, now - updatedAt) / 86_400_000;
    return count * Math.exp(-ageDays / DECAY_DAYS);
}

function getMaxValue(values: Map<string, number>) {
    return Math.max(0, ...values.values());
}

function getNormalizedScore(values: Map<string, number>, id: string) {
    const maxValue = getMaxValue(values);
    if (maxValue <= 0) return 0;

    return (values.get(id) ?? 0) / maxValue;
}

function normalizeStationName(name?: string) {
    return name?.replace(/台/g, '臺') ?? '';
}

function getPriorScore(candidate: DestinationCandidate, index: number) {
    const normalizedName = normalizeStationName(candidate.name);
    const priorIndex =
        PRIOR_STATION_NAMES.map(normalizeStationName).indexOf(normalizedName);

    if (priorIndex >= 0) {
        return 1 - priorIndex / PRIOR_STATION_NAMES.length;
    }

    return Math.max(0, 0.1 - index * 0.002);
}

function incrementScore(
    scores: Map<string, number>,
    id: string,
    score: number
) {
    scores.set(id, (scores.get(id) ?? 0) + score);
}

function getDestinationCandidates(
    records: FrequentDestination[],
    stations: DestinationCandidate[]
) {
    const candidates = new Map<string, DestinationCandidate>();

    stations.forEach((station) => {
        if (isValidStationId(station.id)) {
            candidates.set(station.id, station);
        }
    });

    if (candidates.size === 0) {
        records.forEach((destination) => {
            candidates.set(destination.id, { id: destination.id });
        });
    }

    return [...candidates.values()];
}

function getWeighting(originSamples: number, globalSamples: number) {
    if (originSamples >= 3) {
        return {
            userOD: 0.55,
            timeContext: 0.2,
            userGlobal: 0.18,
            prior: 0.07,
        };
    }

    if (globalSamples >= 3) {
        return {
            userOD: 0.2,
            timeContext: 0.15,
            userGlobal: 0.5,
            prior: 0.15,
        };
    }

    return {
        userOD: 0,
        timeContext: 0,
        userGlobal: 0.35,
        prior: 0.65,
    };
}

function scoreDestinationIds(
    records: FrequentDestination[],
    originId: string,
    excludedId: string,
    stations: DestinationCandidate[],
    nowDate: Date
) {
    const now = nowDate.getTime();
    const timeContext = getTimeContext(nowDate);
    const userODScores = new Map<string, number>();
    const userGlobalScores = new Map<string, number>();
    const originTimeScores = new Map<string, number>();
    const globalTimeScores = new Map<string, number>();
    const updatedAtById = new Map<string, number>();
    let originSamples = 0;
    let globalSamples = 0;

    records.forEach((destination) => {
        const decayedCount = getDecayedCount(
            destination.count,
            destination.updatedAt,
            now
        );
        globalSamples += destination.count;
        incrementScore(userGlobalScores, destination.id, decayedCount);
        updatedAtById.set(
            destination.id,
            Math.max(
                updatedAtById.get(destination.id) ?? 0,
                destination.updatedAt
            )
        );

        if (destination.originId === originId) {
            originSamples += destination.count;
            incrementScore(userODScores, destination.id, decayedCount);
        }

        const context = destination.contexts?.[timeContext];
        if (!context) return;

        const decayedContextCount = getDecayedCount(
            context.count,
            context.updatedAt,
            now
        );
        incrementScore(globalTimeScores, destination.id, decayedContextCount);

        if (destination.originId === originId) {
            incrementScore(
                originTimeScores,
                destination.id,
                decayedContextCount
            );
        }
    });

    const candidates = getDestinationCandidates(records, stations).filter(
        (candidate) => candidate.id !== excludedId
    );
    const weights = getWeighting(originSamples, globalSamples);
    const activeTimeScores =
        originSamples >= 3 || getMaxValue(originTimeScores) > 0
            ? originTimeScores
            : globalTimeScores;

    return candidates
        .map((candidate, index) => {
            const score =
                weights.userOD *
                    getNormalizedScore(userODScores, candidate.id) +
                weights.timeContext *
                    getNormalizedScore(activeTimeScores, candidate.id) +
                weights.userGlobal *
                    getNormalizedScore(userGlobalScores, candidate.id) +
                weights.prior * getPriorScore(candidate, index);

            return {
                id: candidate.id,
                score,
                updatedAt: updatedAtById.get(candidate.id) ?? 0,
                index,
            };
        })
        .sort(
            (a, b) =>
                b.score - a.score ||
                b.updatedAt - a.updatedAt ||
                a.index - b.index
        )
        .map((candidate) => candidate.id);
}

export function getFrequentDestinationIds(
    excludedId = '',
    now = new Date()
): string[] {
    if (!canUseLocalStorage()) return [];

    return scoreDestinationIds(
        readFrequentDestinationsWithLegacy(),
        '',
        excludedId,
        [],
        now
    );
}

export function getFrequentDestinationIdsForOrigin(
    originId: string,
    excludedId = '',
    stations: DestinationCandidate[] = [],
    now = new Date()
): string[] {
    if (!canUseLocalStorage() || !isValidStationId(originId)) {
        return getFrequentDestinationIds(excludedId);
    }

    const destinations = readFrequentDestinationsWithLegacy();

    return scoreDestinationIds(
        destinations,
        originId,
        excludedId,
        stations,
        now
    );
}

export function getAutoFillDestinationId(
    originId: string,
    stations: DestinationCandidate[],
    now = new Date()
) {
    return (
        getFrequentDestinationIdsForOrigin(
            originId,
            originId,
            stations,
            now
        )[0] ?? ''
    );
}

export function persistFrequentDestinationId(
    originId: string,
    stationId: string,
    stations: DestinationCandidate[] = [],
    nowDate = new Date()
) {
    if (
        !canUseLocalStorage() ||
        !isValidStationId(originId) ||
        !isValidStationId(stationId)
    ) {
        return getFrequentDestinationIdsForOrigin(originId, '', stations);
    }

    const now = nowDate.getTime();
    const timeContext = getTimeContext(nowDate);
    const destinations = readFrequentDestinationsWithLegacy();
    const existingDestination = destinations.find(
        (destination) =>
            destination.originId === originId && destination.id === stationId
    );

    const nextDestinations = existingDestination
        ? destinations.map((destination) =>
              destination.originId === originId && destination.id === stationId
                  ? {
                        ...destination,
                        count: destination.count + 1,
                        updatedAt: now,
                        contexts: {
                            ...destination.contexts,
                            [timeContext]: {
                                count:
                                    (destination.contexts?.[timeContext]
                                        ?.count ?? 0) + 1,
                                updatedAt: now,
                            },
                        },
                    }
                  : destination
          )
        : [
              {
                  originId,
                  id: stationId,
                  count: 1,
                  updatedAt: now,
                  contexts: {
                      [timeContext]: {
                          count: 1,
                          updatedAt: now,
                      },
                  },
              },
              ...destinations,
          ];

    const sortedDestinations = sortDestinations(nextDestinations).slice(
        0,
        MAX_FREQUENT_DESTINATIONS
    );

    localStorage.setItem(
        FREQUENT_DESTINATIONS_KEY,
        JSON.stringify(sortedDestinations)
    );
    localStorage.removeItem(LEGACY_RECENT_STATIONS_KEY);
    localStorage.removeItem(LEGACY_RECENT_DEPARTURE_STATIONS_KEY);

    return getFrequentDestinationIdsForOrigin(originId, '', stations, nowDate);
}
