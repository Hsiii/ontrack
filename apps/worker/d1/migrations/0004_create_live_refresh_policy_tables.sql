create table if not exists route_time_interest (
    route_hour_key text primary key,
    origin text not null,
    dest text not null,
    taipei_hour integer not null check (taipei_hour between 0 and 23),
    request_count integer not null default 0,
    last_seen_at text not null,
    created_at text not null default current_timestamp,
    updated_at text not null default current_timestamp
);

create index if not exists route_time_interest_hour_recent
on route_time_interest(taipei_hour, last_seen_at);

create index if not exists route_time_interest_origin_hour_recent
on route_time_interest(taipei_hour, origin, last_seen_at);

create index if not exists route_time_interest_dest_hour_recent
on route_time_interest(taipei_hour, dest, last_seen_at);

insert or ignore into route_time_interest (
    route_hour_key,
    origin,
    dest,
    taipei_hour,
    request_count,
    last_seen_at
)
select
    origin || ':' || dest || ':' || cast(cast(strftime('%H', last_seen_at, '+8 hours') as integer) as text),
    origin,
    dest,
    cast(strftime('%H', last_seen_at, '+8 hours') as integer),
    request_count,
    last_seen_at
from route_interest
where last_seen_at is not null;

create table if not exists tdx_call_budget (
    budget_key text primary key,
    taipei_date text not null,
    bucket text not null,
    request_count integer not null default 0,
    created_at text not null default current_timestamp,
    updated_at text not null default current_timestamp
);

create index if not exists tdx_call_budget_date_bucket
on tdx_call_budget(taipei_date, bucket);
