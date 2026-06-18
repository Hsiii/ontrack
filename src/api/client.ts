import type { ScheduleResponse, Station } from '../types';

// In-flight request cache to prevent duplicate simultaneous requests
const inflightRequests = new Map<string, Promise<unknown>>();

const STATIONS_STORAGE_KEY = 'ontrack_stations_cache';
interface PersistedCache<T> {
    data: T;
    expires: number;
}

// Client-side cache for stations (rarely change, cache for 24 hours)
let stationsCache: { data: Station[]; expires: number } | null = null;
const STATIONS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function hasLocalStorage() {
    return (
        typeof window !== 'undefined' &&
        typeof window.localStorage !== 'undefined'
    );
}

function readPersistedCache<T>(key: string): PersistedCache<T> | null {
    if (!hasLocalStorage()) {
        return null;
    }

    try {
        const rawValue = localStorage.getItem(key);
        if (!rawValue) {
            return null;
        }

        const parsed = JSON.parse(rawValue) as PersistedCache<T>;

        if (
            typeof parsed !== 'object' ||
            parsed === null ||
            !('data' in parsed) ||
            typeof parsed.expires !== 'number'
        ) {
            return null;
        }

        return parsed;
    } catch {
        return null;
    }
}

function writePersistedCache<T>(key: string, value: PersistedCache<T>) {
    if (!hasLocalStorage()) {
        return;
    }

    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.warn('Failed to persist cache', error);
    }
}

interface GetStationsOptions {
    bypassCache?: boolean;
}

async function fetchJson<T>(url: string, retryCount = 0): Promise<T> {
    // Check if there's already an in-flight request for this URL
    const cacheKey = `${url}-${retryCount}`;
    if (inflightRequests.has(cacheKey)) {
        console.log('Reusing in-flight request for:', url);
        return inflightRequests.get(cacheKey) as Promise<T>;
    }

    // Create new request and cache it
    const requestPromise = (async () => {
        try {
            const response = await fetch(url);

            // Handle 429 Too Many Requests with exponential backoff
            if (response.status === 429 && retryCount < 3) {
                const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
                console.warn(
                    `Rate limited (429). Retrying in ${delay}ms (attempt ${retryCount + 1}/3)`
                );
                await new Promise((resolve) => setTimeout(resolve, delay));
                // Clear cache before retry
                inflightRequests.delete(cacheKey);
                return fetchJson<T>(url, retryCount + 1);
            }

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`API Error ${response.status}: ${errorBody}`);
            }

            return response.json();
        } finally {
            // Clean up cache after request completes (success or failure)
            inflightRequests.delete(cacheKey);
        }
    })();

    inflightRequests.set(cacheKey, requestPromise);
    return requestPromise;
}

export const api = {
    getCachedStations: (): Station[] => {
        const now = Date.now();

        if (stationsCache && stationsCache.expires > now) {
            return stationsCache.data;
        }

        const persisted = readPersistedCache<Station[]>(STATIONS_STORAGE_KEY);
        if (!persisted || persisted.expires <= now) {
            return [];
        }

        stationsCache = persisted;
        return persisted.data;
    },

    getStations: async (
        options: GetStationsOptions = {}
    ): Promise<Station[]> => {
        const { bypassCache = false } = options;
        const now = Date.now();

        // Return cached data if still valid
        if (!bypassCache && stationsCache && stationsCache.expires > now) {
            return stationsCache.data;
        }

        if (!bypassCache && !stationsCache) {
            const persisted =
                readPersistedCache<Station[]>(STATIONS_STORAGE_KEY);
            if (persisted && persisted.expires > now) {
                stationsCache = persisted;
                return persisted.data;
            }
        }

        const params = new URLSearchParams();
        if (bypassCache) {
            params.set('_nocache', String(Date.now()));
        }

        const requestUrl = params.size
            ? `/api/stations?${params.toString()}`
            : '/api/stations';

        // Fetch fresh data
        const data = await fetchJson<Station[]>(requestUrl);

        stationsCache = { data, expires: Date.now() + STATIONS_CACHE_TTL };
        writePersistedCache(STATIONS_STORAGE_KEY, stationsCache);
        return data;
    },

    getSchedule: async (origin: string, dest: string, date?: string) => {
        const params = new URLSearchParams({ origin, dest });
        if (date) params.append('date', date);

        return fetchJson<ScheduleResponse>(
            `/api/schedule?${params.toString()}`
        );
    },
};
