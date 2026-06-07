create table if not exists public.tdx_snapshots (
    key text primary key,
    data jsonb not null,
    last_modified text,
    fetched_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists set_tdx_snapshots_updated_at on public.tdx_snapshots;

create trigger set_tdx_snapshots_updated_at
before update on public.tdx_snapshots
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.tdx_snapshots enable row level security;

revoke all on table public.tdx_snapshots from anon;
revoke all on table public.tdx_snapshots from authenticated;
grant all on table public.tdx_snapshots to service_role;
