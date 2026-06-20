const FREQUENT_DESTINATIONS_KEY = 'ontrack_frequent_destinations';
const LEGACY_RECENT_STATIONS_KEY = 'ontrack_recent_stations';
const LEGACY_RECENT_DEPARTURE_STATIONS_KEY =
    'ontrack_recent_departure_stations';
const MAX_FREQUENT_DESTINATIONS = 12;

interface FrequentDestination {
    id: string;
    count: number;
    updatedAt: number;
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

        return parsedValue.filter(
            (item): item is FrequentDestination =>
                typeof item === 'object' &&
                item !== null &&
                typeof item.id === 'string' &&
                isValidStationId(item.id) &&
                typeof item.count === 'number' &&
                item.count > 0 &&
                typeof item.updatedAt === 'number'
        );
    } catch {
        return [];
    }
}

function readFrequentDestinationsWithLegacy() {
    const storedRecords = readFrequentDestinations();
    if (storedRecords.length > 0) return storedRecords;

    const legacyIds = [
        ...readLegacyStationIds(LEGACY_RECENT_STATIONS_KEY),
        ...readLegacyStationIds(LEGACY_RECENT_DEPARTURE_STATIONS_KEY),
    ].filter((id, index, ids) => ids.indexOf(id) === index);

    return legacyIds.map((id, index) => ({
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

export function getFrequentDestinationIds(excludedId = ''): string[] {
    if (!canUseLocalStorage()) return [];

    return sortDestinations(readFrequentDestinationsWithLegacy())
        .filter((destination) => destination.id !== excludedId)
        .map((destination) => destination.id);
}

export function persistFrequentDestinationId(stationId: string) {
    if (!canUseLocalStorage() || !isValidStationId(stationId)) {
        return getFrequentDestinationIds();
    }

    const now = Date.now();
    const destinations = readFrequentDestinationsWithLegacy();
    const existingDestination = destinations.find(
        (destination) => destination.id === stationId
    );

    const nextDestinations = existingDestination
        ? destinations.map((destination) =>
              destination.id === stationId
                  ? {
                        ...destination,
                        count: destination.count + 1,
                        updatedAt: now,
                    }
                  : destination
          )
        : [{ id: stationId, count: 1, updatedAt: now }, ...destinations];

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

    return sortedDestinations.map((destination) => destination.id);
}
