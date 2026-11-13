drop policy owner_select on public.profiles;
create policy select_own_or_public on public.profiles for select to authenticated
    using ((select auth.uid()) = id or is_public);
create policy public_select on public.profiles for select to anon
    using (is_public);

do $$
declare
    table_name text;
begin
    foreach table_name in array array[
        'levels', 'level_tags', 'list_orders', 'wishlists', 'wishlist_items', 'tags'
    ] loop
        execute format('drop policy owner_select on public.%I', table_name);
        execute format('create policy select_own_or_public on public.%1$I for select to authenticated
            using ((select auth.uid()) = user_id or exists (
                select 1 from public.profiles as owner
                where owner.id = %1$I.user_id and owner.is_public
            ))', table_name);
        execute format('create policy public_select on public.%1$I for select to anon
            using (exists (
                select 1 from public.profiles as owner
                where owner.id = %1$I.user_id and owner.is_public
            ))', table_name);
    end loop;
end;
$$;

grant select on public.profiles, public.levels, public.level_tags, public.list_orders,
    public.wishlists, public.wishlist_items, public.tags to anon;

create function public.public_profile(target_username text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
    select jsonb_build_object(
        'profile', jsonb_build_object(
            'id', profile.id,
            'username', profile.username,
            'display_name', profile.display_name,
            'color', profile.color,
            'secondary_color', profile.secondary_color,
            'bio', profile.bio,
            'country', profile.country,
            'created_at', profile.created_at
        ),
        'levels', (select coalesce(jsonb_agg(level), '[]'::jsonb)
            from public.levels as level where level.user_id = profile.id),
        'level_tags', (select coalesce(jsonb_agg(assignment), '[]'::jsonb)
            from public.level_tags as assignment where assignment.user_id = profile.id),
        'list_orders', (select coalesce(jsonb_agg(list_order), '[]'::jsonb)
            from public.list_orders as list_order where list_order.user_id = profile.id),
        'wishlists', (select coalesce(jsonb_agg(wishlist), '[]'::jsonb)
            from public.wishlists as wishlist where wishlist.user_id = profile.id),
        'wishlist_items', (select coalesce(jsonb_agg(item), '[]'::jsonb)
            from public.wishlist_items as item where item.user_id = profile.id),
        'tags', (select coalesce(jsonb_agg(tag), '[]'::jsonb)
            from public.tags as tag where tag.user_id = profile.id)
    )
    from public.profiles as profile
    where profile.username = target_username and profile.is_public;
$$;

revoke execute on function public.public_profile(text) from public;
grant execute on function public.public_profile(text) to anon, authenticated;
