import type { Env, Snapshot } from './types';

interface SnapshotRow {
    key: string;
    data: string;
    last_modified: string | null;
    fetched_at: string;
}

function toSnapshot<T>(row: SnapshotRow): Snapshot<T> {
    return {
        key: row.key,
        data: JSON.parse(row.data) as T,
        last_modified: row.last_modified,
        fetched_at: row.fetched_at,
    };
}

export async function getSnapshot<T>(
    env: Env,
    key: string
): Promise<Snapshot<T> | null> {
    const row = await env.DB.prepare(
        `
            select key, data, last_modified, fetched_at
            from tdx_snapshots
            where key = ?
            limit 1
        `
    )
        .bind(key)
        .first<SnapshotRow>();

    return row ? toSnapshot<T>(row) : null;
}

export async function upsertSnapshot<T>(
    env: Env,
    key: string,
    data: T,
    lastModified: string | null
) {
    await env.DB.prepare(
        `
            insert into tdx_snapshots (
                key,
                data,
                last_modified,
                fetched_at,
                updated_at
            )
            values (?, ?, ?, ?, current_timestamp)
            on conflict(key) do update set
                data = excluded.data,
                last_modified = excluded.last_modified,
                fetched_at = excluded.fetched_at,
                updated_at = current_timestamp
        `
    )
        .bind(key, JSON.stringify(data), lastModified, new Date().toISOString())
        .run();
}
