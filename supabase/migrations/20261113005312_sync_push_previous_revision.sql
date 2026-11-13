create or replace function public.sync_push(changes jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
    caller uuid;
    previous_revision text := public.sync_revision();
    change jsonb;
    change_table text;
    change_key jsonb;
    change_row jsonb;
    expected_version integer;
    current_version integer;
    current_row jsonb;
    column_names text[];
    key_columns text[];
    key_predicate text;
    insert_columns text;
    insert_values text;
    update_assignments text;
    affected_rows bigint;
    applied jsonb := '[]'::jsonb;
    conflicts jsonb := '[]'::jsonb;
    rejected jsonb := '[]'::jsonb;
begin
    set constraints all immediate;
    caller := auth.uid();
    if caller is null then
        raise sqlstate '42501' using message = 'Authentication required';
    end if;
    if jsonb_typeof(changes) is distinct from 'array' then
        raise sqlstate '22023' using message = 'batch_too_large';
    end if;
    if jsonb_array_length(changes) > 500 then
        raise sqlstate '22023' using message = 'batch_too_large';
    end if;

    for change in select value from jsonb_array_elements(changes) loop
        change_table := change->>'table';
        change_key := change->'key';
        change_row := nullif(change->'row', 'null'::jsonb);
        begin
            if change_table is null or change_table not in (
                'levels', 'level_notes', 'level_tags', 'list_orders',
                'wishlists', 'wishlist_items', 'tags', 'user_settings'
            ) then
                raise sqlstate '22023' using message = 'invalid_table';
            end if;

            select array_agg(attribute.attname::text order by attribute.attnum),
                coalesce(array_agg(attribute.attname::text order by attribute.attnum) filter (
                    where attribute.attnum = any(primary_index.indkey) and attribute.attname <> 'user_id'
                ), '{}'::text[])
            into column_names, key_columns
            from pg_catalog.pg_attribute as attribute
            join pg_catalog.pg_class as relation on relation.oid = attribute.attrelid
            join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
            join pg_catalog.pg_index as primary_index
                on primary_index.indrelid = relation.oid and primary_index.indisprimary
            where namespace.nspname = 'public' and relation.relname = change_table
                and attribute.attnum > 0 and not attribute.attisdropped;

            if jsonb_typeof(change_key) is distinct from 'object' then
                raise sqlstate '22023' using message = 'invalid_key';
            end if;
            if not (change_key ?& key_columns)
                or (select count(*) from jsonb_object_keys(change_key)) <> cardinality(key_columns)
                or exists (select 1 from jsonb_each(change_key) as field where field.value = 'null'::jsonb)
            then
                raise sqlstate '22023' using message = 'invalid_key';
            end if;

            if change_row is not null then
                if jsonb_typeof(change_row) is distinct from 'object' then
                    raise sqlstate '22023' using message = 'invalid_row';
                end if;
                if change_row ?| array['user_id', 'version', 'created_at', 'updated_at']
                    or exists (
                        select 1 from jsonb_object_keys(change_row) as field(name)
                        where not (field.name = any(column_names))
                    )
                    or exists (
                        select 1 from unnest(key_columns) as field(name)
                        where change_row->field.name is distinct from change_key->field.name
                    )
                then
                    raise sqlstate '22023' using message = 'invalid_row_columns';
                end if;
            end if;

            expected_version := null;
            if change->'version' is not null and change->'version' <> 'null'::jsonb then
                if jsonb_typeof(change->'version') <> 'number' then
                    raise sqlstate '22023' using message = 'invalid_version';
                end if;
                if (change->>'version')::numeric <> trunc((change->>'version')::numeric)
                    or (change->>'version')::numeric not between -2147483648 and 2147483647
                then
                    raise sqlstate '22023' using message = 'invalid_version';
                end if;
                expected_version := (change->>'version')::numeric::integer;
            end if;
            if change_row is null and expected_version is null then
                raise sqlstate '22023' using message = 'missing_row_and_version';
            end if;

            select coalesce(string_agg(format(
                'target.%1$I = (jsonb_populate_record(null::public.%2$I, $3)).%1$I', field.name, change_table
            ), ' and '), 'true')
            into key_predicate from unnest(key_columns) as field(name);
            current_version := null;
            affected_rows := 0;

            if change_row is not null and expected_version is null then
                select string_agg(format('%I', field.name), ', ' order by field.name),
                    string_agg(format('incoming.%I', field.name), ', ' order by field.name)
                into insert_columns, insert_values
                from jsonb_object_keys(change_row) as field(name);
                -- An existing key is a conflict, not an error; skipping it avoids a second subtransaction per change
                execute format('insert into public.%I as target (%s)
                    select %s from jsonb_populate_record(null::public.%I, $2) as incoming
                    on conflict do nothing
                    returning target.version', change_table,
                    concat_ws(', ', 'user_id', insert_columns), concat_ws(', ', '$1', insert_values), change_table)
                into current_version using caller, change_row;
                get diagnostics affected_rows = row_count;
            elsif change_row is not null then
                select coalesce(string_agg(format('%1$I = incoming.%1$I', field.name), ', ' order by field.name),
                    'version = target.version')
                into update_assignments
                from jsonb_object_keys(change_row) as field(name)
                where not (field.name = any(key_columns));
                execute format('update public.%I as target set %s
                    from jsonb_populate_record(null::public.%I, $2) as incoming
                    where target.user_id = $1 and %s and target.version = $4
                    returning target.version', change_table, update_assignments, change_table, key_predicate)
                into current_version using caller, change_row, change_key, expected_version;
                get diagnostics affected_rows = row_count;
            else
                execute format('delete from public.%I as target
                    where target.user_id = $1 and %s and target.version = $4', change_table, key_predicate)
                using caller, change_row, change_key, expected_version;
                get diagnostics affected_rows = row_count;
            end if;

            if affected_rows = 0 then
                execute format('select to_jsonb(target) from public.%I as target
                    where target.user_id = $1 and %s', change_table, key_predicate)
                into current_row using caller, change_row, change_key;
                if change_row is not null or current_row is not null then
                    conflicts := conflicts || jsonb_build_array(jsonb_build_object(
                        'table', change_table, 'key', change_key, 'row', current_row
                    ));
                    continue;
                end if;
            end if;
            applied := applied || jsonb_build_array(jsonb_build_object(
                'table', change_table, 'key', change_key, 'version', current_version
            ));
        exception
            when sqlstate 'PT429' then
                raise;
            when others then
                rejected := rejected || jsonb_build_array(jsonb_build_object(
                    'table', change_table, 'key', change_key, 'code', sqlstate, 'message', sqlerrm
                ));
        end;
    end loop;

    return jsonb_build_object(
        'applied', applied, 'conflicts', conflicts, 'rejected', rejected, 'previous_revision', previous_revision, 'revision', public.sync_revision()
    );
end;
$$;

revoke execute on function public.sync_push(jsonb), public.sync_pull(), public.sync_revision() from public, anon;
grant execute on function public.sync_push(jsonb), public.sync_pull(), public.sync_revision() to authenticated;
