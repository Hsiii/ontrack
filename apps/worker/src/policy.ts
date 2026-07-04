import { getTaipeiDate } from './time';
import type { Station } from './types';

export const SCHEDULE_FUTURE_DAY_LIMIT = 7;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function addUtcDays(date: Date, days: number) {
    const nextDate = new Date(date);
    nextDate.setUTCDate(nextDate.getUTCDate() + days);
    return nextDate;
}

function dateStringToUtcDate(date: string) {
    const match = DATE_PATTERN.exec(date);
    if (!match) {
        return null;
    }

    const [, year, month, day] = match;
    const parsedDate = new Date(
        Date.UTC(Number(year), Number(month) - 1, Number(day))
    );

    return parsedDate.toISOString().slice(0, 10) === date ? parsedDate : null;
}

export function normalizeScheduleDate(
    date: string | null,
    now = new Date()
): string | null {
    if (!date) {
        return getTaipeiDate(now);
    }

    const parsedDate = dateStringToUtcDate(date);
    if (!parsedDate) {
        return null;
    }

    const today = getTaipeiDate(now);
    const maxDate = addUtcDays(
        dateStringToUtcDate(today) ?? new Date(),
        SCHEDULE_FUTURE_DAY_LIMIT
    )
        .toISOString()
        .slice(0, 10);

    return date >= today && date <= maxDate ? date : null;
}

export function resolveScheduleStations(
    stations: Station[],
    origin: string,
    dest: string
) {
    const stationMap = new Map(
        stations.map((station) => [station.id, station])
    );
    const originStation = stationMap.get(origin);
    const destinationStation = stationMap.get(dest);

    return originStation && destinationStation
        ? { originStation, destinationStation }
        : null;
}
