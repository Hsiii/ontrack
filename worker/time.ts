const TAIPEI_TIME_ZONE = 'Asia/Taipei';
const TAIPEI_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
    timeZone: TAIPEI_TIME_ZONE,
});
const TAIPEI_HOUR_FORMATTER = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    hour12: false,
    hourCycle: 'h23',
    timeZone: TAIPEI_TIME_ZONE,
});
const TAIPEI_WEEKDAY_FORMATTER = new Intl.DateTimeFormat('en-US', {
    timeZone: TAIPEI_TIME_ZONE,
    weekday: 'short',
});

export function getTaipeiDate(date = new Date()) {
    return TAIPEI_DATE_FORMATTER.format(date);
}

export function getNextTaipeiDate(date = new Date()) {
    return getTaipeiDate(new Date(date.getTime() + 24 * 60 * 60 * 1000));
}

export function getTaipeiHour(date = new Date()) {
    return Number(TAIPEI_HOUR_FORMATTER.format(date)) % 24;
}

export function isTaipeiWeekend(date = new Date()) {
    const weekday = TAIPEI_WEEKDAY_FORMATTER.format(date);
    return weekday === 'Sat' || weekday === 'Sun';
}

export function getLookbackIso(days: number, date = new Date()) {
    return new Date(date.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}
