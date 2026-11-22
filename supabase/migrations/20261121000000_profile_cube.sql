alter table public.profiles add column cube_id smallint check (cube_id between 1 and 485);

create or replace function public.public_profile(target_username text)
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
            'cube_id', profile.cube_id,
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
