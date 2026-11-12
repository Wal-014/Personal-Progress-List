create or replace function private.charge_write_budget(rows integer)
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
    if total > 50000 then
        raise sqlstate 'PT429' using message = 'write_budget_exceeded';
    end if;
end;
$$;

create table public.level_tags (
    user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
    level_id text not null,
    tag_name text not null,
    position smallint not null default 0 check (position between 0 and 49),
    version integer not null default 1,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (user_id, level_id, tag_name),
    foreign key (user_id, level_id) references public.levels(user_id, id)
        on delete cascade deferrable initially deferred,
    foreign key (user_id, tag_name) references public.tags(user_id, name)
        on update cascade on delete cascade deferrable initially deferred
);

create index level_tags_tag_idx on public.level_tags(user_id, tag_name);

with missing_tags as (
    select distinct levels.user_id, tag.name
    from public.levels
    cross join lateral unnest(levels.tags) as tag(name)
    where not exists (
        select 1 from public.tags
        where tags.user_id = levels.user_id and tags.name = tag.name
    )
)
insert into public.tags (user_id, name, color, position)
select missing.user_id, missing.name, '#00e5ff', (
    coalesce((select max(tags.position) from public.tags where tags.user_id = missing.user_id), -1)
    + row_number() over (partition by missing.user_id order by missing.name)
)::integer
from missing_tags as missing;

-- Repeated names in the old array become one assignment at their first position.
insert into public.level_tags (user_id, level_id, tag_name, position)
select levels.user_id, levels.id, tag.name, (min(tag.ordinality) - 1)::smallint
from public.levels
cross join lateral unnest(levels.tags) with ordinality as tag(name, ordinality)
group by levels.user_id, levels.id, tag.name;

alter table public.levels drop column tags;
drop function private.valid_tag_names(text[]);

alter table public.level_tags enable row level security;
create policy owner_select on public.level_tags for select to authenticated
    using ((select auth.uid()) = user_id);
create policy owner_insert on public.level_tags for insert to authenticated
    with check ((select auth.uid()) = user_id);
create policy owner_update on public.level_tags for update to authenticated
    using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy owner_delete on public.level_tags for delete to authenticated
    using ((select auth.uid()) = user_id);

create trigger stamp_row before insert or update on public.level_tags
    for each row execute function private.stamp_row();
create trigger row_limit after insert on public.level_tags
    referencing new table as new_rows for each statement execute function private.enforce_row_limit('50000');
create trigger write_budget_insert after insert on public.level_tags
    referencing new table as new_rows for each statement execute function private.track_writes();
create trigger write_budget_update after update on public.level_tags
    referencing new table as new_rows for each statement execute function private.track_writes();

revoke all on public.level_tags from anon, authenticated;
grant select, insert, update, delete on public.level_tags to authenticated;

alter table public.levels drop constraint levels_level_id_check;
alter table public.levels alter column level_id type bigint using level_id::bigint;
alter table public.levels add check (level_id > 0);

alter table public.wishlist_items drop constraint wishlist_items_level_id_check;
alter table public.wishlist_items alter column level_id type bigint using level_id::bigint;
alter table public.wishlist_items add check (level_id > 0);

create table private.deleted_rows (
    id bigint generated always as identity primary key,
    user_id uuid not null,
    table_name text not null,
    row_data jsonb not null,
    deleted_at timestamptz not null default now()
);

create index deleted_rows_user_idx on private.deleted_rows(user_id, id);
create index deleted_rows_deleted_at_idx on private.deleted_rows(deleted_at);
revoke all on private.deleted_rows from public, anon, authenticated;

create function private.archive_deleted_rows()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    affected_user uuid;
begin
    for affected_user in select distinct user_id from old_rows order by user_id loop
        -- Serialize retention with other deletes and account removal for this user.
        perform 1 from public.profiles where id = affected_user for no key update;
        -- The profile is removed before its cascades; those deletes must not recreate an archive.
        if not found then
            continue;
        end if;

        insert into private.deleted_rows (user_id, table_name, row_data)
        select affected_user, tg_table_name, to_jsonb(deleted)
        from old_rows as deleted where deleted.user_id = affected_user;

        delete from private.deleted_rows
        where user_id = affected_user and id in (
            select id from private.deleted_rows
            where user_id = affected_user order by id desc offset 60000
        );
    end loop;
    return null;
end;
$$;

do $$
declare
    table_name text;
begin
    foreach table_name in array array[
        'levels', 'level_notes', 'level_tags', 'list_orders', 'wishlists', 'wishlist_items', 'tags'
    ] loop
        execute format('create trigger archive_deleted_rows after delete on public.%I
            referencing old table as old_rows for each statement execute function private.archive_deleted_rows()', table_name);
    end loop;
end;
$$;

create function private.purge_user_deleted_rows()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    delete from private.deleted_rows where user_id = old.id;
    return null;
end;
$$;

create trigger purge_user_deleted_rows after delete on public.profiles
    for each row execute function private.purge_user_deleted_rows();

create extension if not exists pg_cron;
select cron.schedule('purge-deleted-rows', '17 4 * * *', $$
    delete from private.deleted_rows where deleted_at < now() - interval '30 days';
$$);

create function public.archived_rows(target_user uuid)
returns table (id bigint, table_name text, row_data jsonb, deleted_at timestamptz)
language sql
security definer
set search_path = ''
as $$
    select archived.id, archived.table_name, archived.row_data, archived.deleted_at
    from private.deleted_rows as archived
    where archived.user_id = target_user
    order by archived.id desc;
$$;

revoke execute on function public.archived_rows(uuid) from public, anon, authenticated;
grant execute on function public.archived_rows(uuid) to service_role;

revoke execute on function private.archive_deleted_rows(), private.purge_user_deleted_rows(),
    private.charge_write_budget(integer) from public, anon, authenticated;

-- Check constraints call these as the writing role; administrators restoring archived rows write as service_role
grant execute on function private.valid_deaths(jsonb), private.valid_ids(text[]) to service_role;
