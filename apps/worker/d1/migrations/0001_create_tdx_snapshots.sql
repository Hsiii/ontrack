create table if not exists tdx_snapshots (
    key text primary key,
    data text not null check (json_valid(data)),
    last_modified text,
    fetched_at text not null,
    created_at text not null default current_timestamp,
    updated_at text not null default current_timestamp
);
