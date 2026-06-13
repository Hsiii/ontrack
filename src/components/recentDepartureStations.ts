const RECENT_DEPARTURE_STATIONS_KEY = 'ontrack_recent_departure_stations';
const MAX_RECENT_DEPARTURE_STATIONS = 3;

function canUseLocalStorage() {
    return typeof window !== 'undefined' && Boolean(window.localStorage);
}

function isValidStationId(id: string) {
    return /^[A-Z0-9-]*$/i.test(id) && id.length <= 10;
}

export function getRecentDepartureStationIds(): string[] {
    if (!canUseLocalStorage()) return [];

    try {
        const storedValue = localStorage.getItem(RECENT_DEPARTURE_STATIONS_KEY);
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

export function persistRecentDepartureStationId(stationId: string) {
    if (!canUseLocalStorage() || !isValidStationId(stationId)) {
        return getRecentDepartureStationIds();
    }

    const nextIds = [
        stationId,
        ...getRecentDepartureStationIds().filter((item) => item !== stationId),
    ].slice(0, MAX_RECENT_DEPARTURE_STATIONS);

    localStorage.setItem(
        RECENT_DEPARTURE_STATIONS_KEY,
        JSON.stringify(nextIds)
    );

    return nextIds;
}
