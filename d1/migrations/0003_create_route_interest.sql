create table if not exists route_interest (
    route_key text primary key,
    origin text not null,
    dest text not null,
    request_count integer not null default 0,
    last_seen_at text not null,
    created_at text not null default current_timestamp,
    updated_at text not null default current_timestamp
);

create index if not exists route_interest_rank
on route_interest(request_count desc, last_seen_at desc);
