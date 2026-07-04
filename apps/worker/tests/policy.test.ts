import { describe, expect, test } from 'bun:test';

import { normalizeScheduleDate } from '../src/policy';

const NOW = new Date('2026-07-04T04:00:00.000Z');

describe('normalizeScheduleDate', () => {
    test('defaults to the current Taipei date', () => {
        expect(normalizeScheduleDate(null, NOW)).toBe('2026-07-04');
    });

    test('accepts dates inside the supported seven-day window', () => {
        expect(normalizeScheduleDate('2026-07-04', NOW)).toBe('2026-07-04');
        expect(normalizeScheduleDate('2026-07-11', NOW)).toBe('2026-07-11');
    });

    test('rejects past and out-of-window dates', () => {
        expect(normalizeScheduleDate('2026-07-03', NOW)).toBeNull();
        expect(normalizeScheduleDate('2026-07-12', NOW)).toBeNull();
    });

    test('rejects impossible and malformed dates', () => {
        expect(normalizeScheduleDate('2026-02-31', NOW)).toBeNull();
        expect(normalizeScheduleDate('not-a-date', NOW)).toBeNull();
        expect(normalizeScheduleDate('2026-7-4', NOW)).toBeNull();
    });
});
