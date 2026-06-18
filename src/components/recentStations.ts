const RECENT_STATIONS_KEY = 'ontrack_recent_stations';
const LEGACY_RECENT_DEPARTURE_STATIONS_KEY =
    'ontrack_recent_departure_stations';
const MAX_RECENT_STATIONS = 6;

function canUseLocalStorage() {
    return typeof window !== 'undefined' && Boolean(window.localStorage);
}

function isValidStationId(id: string) {
    return /^[A-Z0-9-]*$/i.test(id) && id.length <= 10;
}

function readStationIds(key: string): string[] {
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

export function getRecentStationIds(): string[] {
    if (!canUseLocalStorage()) return [];

    return [
        ...readStationIds(RECENT_STATIONS_KEY),
        ...readStationIds(LEGACY_RECENT_DEPARTURE_STATIONS_KEY),
    ].filter((id, index, ids) => ids.indexOf(id) === index);
}

export function persistRecentStationId(stationId: string) {
    if (!canUseLocalStorage() || !isValidStationId(stationId)) {
        return getRecentStationIds();
    }

    const nextIds = [
        stationId,
        ...getRecentStationIds().filter((item) => item !== stationId),
    ].slice(0, MAX_RECENT_STATIONS);

    localStorage.setItem(RECENT_STATIONS_KEY, JSON.stringify(nextIds));
    localStorage.removeItem(LEGACY_RECENT_DEPARTURE_STATIONS_KEY);

    return nextIds;
}
