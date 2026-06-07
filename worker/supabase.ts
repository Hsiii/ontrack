import type { Env, Snapshot } from './types';

function restUrl(env: Env, path: string) {
    return `${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${path}`;
}

function headers(env: Env, extra: HeadersInit = {}) {
    return {
        apikey: env.SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
        ...extra,
    };
}

export async function getSnapshot<T>(
    env: Env,
    key: string
): Promise<Snapshot<T> | null> {
    const url = new URL(restUrl(env, 'tdx_snapshots'));
    url.searchParams.set('key', `eq.${key}`);
    url.searchParams.set('select', 'key,data,last_modified,fetched_at');
    url.searchParams.set('limit', '1');

    const response = await fetch(url.toString(), {
        headers: headers(env, { Accept: 'application/json' }),
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Supabase read failed: ${response.status} ${body}`);
    }

    const rows = (await response.json()) as Snapshot<T>[];
    return rows[0] ?? null;
}

export async function upsertSnapshot<T>(
    env: Env,
    key: string,
    data: T,
    lastModified: string | null
) {
    const url = new URL(restUrl(env, 'tdx_snapshots'));
    url.searchParams.set('on_conflict', 'key');

    const response = await fetch(url.toString(), {
        method: 'POST',
        headers: headers(env, {
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates,return=minimal',
        }),
        body: JSON.stringify({
            key,
            data,
            last_modified: lastModified,
            fetched_at: new Date().toISOString(),
        }),
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Supabase upsert failed: ${response.status} ${body}`);
    }
}
