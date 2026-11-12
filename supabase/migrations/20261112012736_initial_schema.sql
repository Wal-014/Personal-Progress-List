create schema private;
revoke all on schema private from public, anon, authenticated;

create function private.valid_deaths(deaths jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
    select case when jsonb_typeof(deaths) = 'object' then (
        select count(*) <= 101 and coalesce(bool_and(
            entry.key ~ '^(100|[1-9]?[0-9])$'
            and case when jsonb_typeof(entry.value) = 'number' then
                entry.value::text::numeric between 0 and 10000000
                and trunc(entry.value::text::numeric) = entry.value::text::numeric
            else false end
        ), true)
        from jsonb_each(deaths) as entry
    ) else false end;
$$;

create function private.valid_tag_names(names text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
    select coalesce(cardinality(names) <= 50, false) and not exists (
        select 1 from unnest(names) as tag(name)
        where name is null or char_length(name) not between 1 and 40
            or name <> btrim(name) or name ~ '[[:cntrl:]]'
    );
$$;

create function private.valid_ids(ids text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
    select coalesce(cardinality(ids) <= 5000, false) and not exists (
        select 1 from unnest(ids) as entry(id)
        where id is null or id !~ '^[A-Za-z0-9_-]{1,40}$'
    );
$$;

create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    username text unique check (username ~ '^[a-z0-9_]{3,20}$'),
    display_name text not null check (
        char_length(display_name) between 1 and 40
        and display_name = btrim(display_name) and display_name !~ '[[:cntrl:]]'
    ),
    color text not null default '#ffe94d' check (color ~ '^#[0-9a-fA-F]{6}$'),
    secondary_color text not null default '#5ef0ff' check (secondary_color ~ '^#[0-9a-fA-F]{6}$'),
    bio text check (char_length(bio) <= 300),
    country text check (country ~ '^[A-Z]{2}$'),
    is_public boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (not is_public or username is not null)
);

create table public.user_settings (
    user_id uuid primary key default auth.uid() references public.profiles(id) on delete cascade,
    lang text check (lang in ('es', 'en')),
    theme text check (theme in ('blue', 'night', 'synth')),
    version integer not null default 1,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.levels (
    user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
    id text not null check (id ~ '^[A-Za-z0-9_-]{1,40}$'),
    kind text not null check (kind in ('classic', 'platform')),
    name text not null check (char_length(name) between 1 and 100 and name !~ '[[:cntrl:]]'),
    level_id text check (level_id ~ '^[0-9]{1,12}$'),
    creator text check (char_length(creator) <= 100 and creator !~ '[[:cntrl:]]'),
    difficulty text check (difficulty in (
        'Auto', 'Easy', 'Normal', 'Hard', 'Harder', 'Insane',
        'Easy Demon', 'Medium Demon', 'Hard Demon', 'Insane Demon', 'Extreme Demon'
    )),
    rating text check (rating in ('unrated', 'rated', 'featured', 'epic', 'legendary', 'mythic')),
    aredl_status text check (aredl_status in ('r', 'n', 'p')),
    aredl_position integer check (aredl_position between 1 and 100000),
    attempts_normal integer check (attempts_normal between 0 and 1000000000),
    attempts_copy integer check (attempts_copy between 0 and 1000000000),
    time_normal integer check (time_normal between 0 and 1000000000),
    time_practice integer check (time_practice between 0 and 1000000000),
    time_practice_copy integer check (time_practice_copy between 0 and 1000000000),
    completed_on date,
    video_url text check (char_length(video_url) <= 500 and video_url ~* '^https?://'),
    enjoyment smallint check (enjoyment between -10 and 10),
    liking smallint check (liking between -10 and 10),
    tags text[] not null default '{}' check (private.valid_tag_names(tags)),
    deaths jsonb not null default '{}' check (private.valid_deaths(deaths)),
    version integer not null default 1,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (user_id, id)
);

create table public.level_notes (
    user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
    level_id text not null check (level_id ~ '^[A-Za-z0-9_-]{1,40}$'),
    notes text not null check (char_length(notes) between 1 and 5000),
    version integer not null default 1,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (user_id, level_id),
    foreign key (user_id, level_id) references public.levels(user_id, id) on delete cascade
);

create table public.list_orders (
    user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
    kind text not null check (kind in ('classic', 'platform')),
    level_ids text[] not null default '{}' check (private.valid_ids(level_ids)),
    version integer not null default 1,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (user_id, kind)
);

create table public.wishlists (
    user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
    id text not null check (id ~ '^[A-Za-z0-9_-]{1,40}$'),
    name text not null check (char_length(name) between 1 and 100 and name !~ '[[:cntrl:]]'),
    position integer not null default 0 check (position >= 0),
    item_ids text[] not null default '{}' check (private.valid_ids(item_ids)),
    version integer not null default 1,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (user_id, id)
);

create table public.wishlist_items (
    user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
    id text not null check (id ~ '^[A-Za-z0-9_-]{1,40}$'),
    wishlist_id text not null check (wishlist_id ~ '^[A-Za-z0-9_-]{1,40}$'),
    name text not null check (char_length(name) between 1 and 100 and name !~ '[[:cntrl:]]'),
    level_id text check (level_id ~ '^[0-9]{1,12}$'),
    creator text check (char_length(creator) <= 100 and creator !~ '[[:cntrl:]]'),
    difficulty text check (difficulty in (
        'Auto', 'Easy', 'Normal', 'Hard', 'Harder', 'Insane',
        'Easy Demon', 'Medium Demon', 'Hard Demon', 'Insane Demon', 'Extreme Demon'
    )),
    rating text check (rating in ('unrated', 'rated', 'featured', 'epic', 'legendary', 'mythic')),
    kind text check (kind in ('classic', 'platform')),
    status text not null default 'todo' check (status in ('todo', 'prog', 'done')),
    progress smallint check (progress between 0 and 100),
    enrich_checked boolean not null default false,
    version integer not null default 1,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (user_id, id),
    foreign key (user_id, wishlist_id) references public.wishlists(user_id, id)
        on delete cascade deferrable initially deferred
);

create index wishlist_items_wishlist_idx on public.wishlist_items(user_id, wishlist_id);

create table public.tags (
    user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
    name text not null check (
        char_length(name) between 1 and 40 and name = btrim(name) and name !~ '[[:cntrl:]]'
    ),
    color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
    position integer not null default 0 check (position >= 0),
    version integer not null default 1,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (user_id, name)
);

create function private.stamp_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if tg_op = 'INSERT' then
        new.created_at := now();
        if tg_table_name <> 'profiles' then
            new.version := 1;
        end if;
    else
        new.created_at := old.created_at;
        if tg_table_name <> 'profiles' then
            new.version := old.version + 1;
        end if;
    end if;
    new.updated_at := now();
    return new;
end;
$$;

create function private.enforce_row_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
    affected_user uuid;
    row_count bigint;
begin
    for affected_user in select distinct user_id from new_rows order by user_id loop
        -- Serialize counts for an account without blocking foreign-key key-share locks.
        perform 1 from public.profiles where id = affected_user for no key update;
        execute format('select count(*) from public.%I where user_id = $1', tg_table_name)
            into row_count using affected_user;
        if row_count > tg_argv[0]::integer then
            raise check_violation using message = 'row_limit:' || tg_table_name;
        end if;
    end loop;
    return null;
end;
$$;

create trigger row_limit after insert on public.levels
    referencing new table as new_rows for each statement execute function private.enforce_row_limit('5000');
create trigger row_limit after insert on public.wishlists
    referencing new table as new_rows for each statement execute function private.enforce_row_limit('200');
create trigger row_limit after insert on public.wishlist_items
    referencing new table as new_rows for each statement execute function private.enforce_row_limit('5000');
create trigger row_limit after insert on public.tags
    referencing new table as new_rows for each statement execute function private.enforce_row_limit('300');

create table private.write_budget (
    user_id uuid primary key,
    window_start timestamptz not null,
    rows_written integer not null
);
revoke all on private.write_budget from public, anon, authenticated;

create function private.charge_write_budget(rows integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    caller uuid := auth.uid();
    total integer;
begin
    if caller is null then
        return;
    end if;
    insert into private.write_budget as budget (user_id, window_start, rows_written)
    values (caller, now(), rows)
    on conflict (user_id) do update set
        window_start = case when budget.window_start < now() - interval '60 seconds'
            then now() else budget.window_start end,
        rows_written = case when budget.window_start < now() - interval '60 seconds'
            then excluded.rows_written else budget.rows_written + excluded.rows_written end
    returning rows_written into total;
    if total > 20000 then
        raise sqlstate 'PT429' using message = 'write_budget_exceeded';
    end if;
end;
$$;

-- The trigger needs owner rights to call the counter function whose execute grant is revoked.
-- Deletes are not charged: they cannot fill the database, and charging them could stop an account from being deleted.
create function private.track_writes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    written integer;
begin
    select count(*) into written from new_rows;
    perform private.charge_write_budget(written);
    return null;
end;
$$;

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (id, display_name)
    values (new.id, coalesce(
        nullif(btrim(left(regexp_replace(new.raw_user_meta_data->>'display_name', '[[:cntrl:]]', '', 'g'), 40)), ''),
        nullif(btrim(left(regexp_replace(new.raw_user_meta_data->>'full_name', '[[:cntrl:]]', '', 'g'), 40)), ''),
        nullif(btrim(left(regexp_replace(new.raw_user_meta_data->>'name', '[[:cntrl:]]', '', 'g'), 40)), ''),
        'Player'
    ))
    on conflict (id) do nothing;
    return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
    for each row execute function private.handle_new_user();

do $$
declare
    table_name text;
    owner_column text;
begin
    foreach table_name in array array[
        'profiles', 'user_settings', 'levels', 'level_notes', 'list_orders', 'wishlists', 'wishlist_items', 'tags'
    ] loop
        owner_column := case when table_name = 'profiles' then 'id' else 'user_id' end;
        execute format('alter table public.%I enable row level security', table_name);
        execute format('create policy owner_select on public.%I for select to authenticated
            using ((select auth.uid()) = %I)', table_name, owner_column);
        execute format('create policy owner_insert on public.%I for insert to authenticated
            with check ((select auth.uid()) = %I)', table_name, owner_column);
        execute format('create policy owner_update on public.%I for update to authenticated
            using ((select auth.uid()) = %I) with check ((select auth.uid()) = %I)',
            table_name, owner_column, owner_column);
        if table_name not in ('profiles', 'user_settings') then
            execute format('create policy owner_delete on public.%I for delete to authenticated
                using ((select auth.uid()) = %I)', table_name, owner_column);
        end if;

        execute format('create trigger stamp_row before insert or update on public.%I
            for each row execute function private.stamp_row()', table_name);
        execute format('create trigger write_budget_insert after insert on public.%I
            referencing new table as new_rows for each statement execute function private.track_writes()', table_name);
        execute format('create trigger write_budget_update after update on public.%I
            referencing new table as new_rows for each statement execute function private.track_writes()', table_name);
    end loop;
end;
$$;

revoke all on public.profiles, public.user_settings, public.levels, public.level_notes,
    public.list_orders, public.wishlists, public.wishlist_items, public.tags from anon, authenticated;
grant select, insert, update on public.profiles, public.user_settings to authenticated;
grant select, insert, update, delete on public.levels, public.level_notes,
    public.list_orders, public.wishlists, public.wishlist_items, public.tags to authenticated;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.valid_deaths(jsonb), private.valid_tag_names(text[]), private.valid_ids(text[]) to anon, authenticated;
