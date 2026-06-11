alter table tdx_snapshots
add column storage_kind text not null default 'inline';

alter table tdx_snapshots
add column chunk_count integer not null default 0;

create table if not exists tdx_snapshot_chunks (
    snapshot_key text not null,
    chunk_index integer not null,
    data text not null,
    primary key (snapshot_key, chunk_index),
    foreign key (snapshot_key) references tdx_snapshots(key) on delete cascade
);
