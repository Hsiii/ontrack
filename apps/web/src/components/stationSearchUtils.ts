import type { Station } from '../types';

const TAIPEI_MAIN_NAME = '臺北';
const TAIPEI_CIRCULAR_NAME = '臺北(環島)';
const CIRCULAR_SEARCH_PATTERN =
    /環島|circular|circle|loop|round(?:\s|-)?island|around\s+island/i;

export function normalizeSearchValue(value: string): string {
    return value.replace(/台/g, '臺').trim();
}

export function normalizeEnglishStationName(value: string): string {
    return value.replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function isExplicitCircularSearch(value: string): boolean {
    return CIRCULAR_SEARCH_PATTERN.test(normalizeSearchValue(value));
}

export function resolvePreferredStation(
    station: Station | undefined,
    stations: Station[],
    searchValue = ''
): Station | undefined {
    if (!station) return undefined;
    if (
        station.name !== TAIPEI_CIRCULAR_NAME ||
        isExplicitCircularSearch(searchValue)
    ) {
        return station;
    }

    return stations.find((candidate) => candidate.name === TAIPEI_MAIN_NAME);
}

export function resolvePreferredStationId(
    stationId: string,
    stations: Station[],
    searchValue = ''
): string {
    const preferredStation = resolvePreferredStation(
        stations.find((station) => station.id === stationId),
        stations,
        searchValue
    );

    return preferredStation?.id ?? stationId;
}

export function filterStationsBySearch(
    stations: Station[],
    searchValue: string
): Station[] {
    const normalizedSearch = normalizeSearchValue(searchValue);
    const explicitCircularSearch = isExplicitCircularSearch(searchValue);
    const normalizedEnglishSearch = normalizeEnglishStationName(searchValue);

    return stations.filter((station) => {
        const matchesSearch =
            station.name.includes(searchValue) ||
            station.name.includes(normalizedSearch) ||
            normalizeEnglishStationName(station.nameEn).includes(
                normalizedEnglishSearch
            );

        if (!matchesSearch) return false;
        if (explicitCircularSearch) return true;

        return station.name !== TAIPEI_CIRCULAR_NAME;
    });
}
