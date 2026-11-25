-- Levels tagged "Pre-Extremes" used to be listed apart under "First steps". The section is gone: those levels
-- lose the tag and their rank, so they show as unplaced. The client cleans local profiles the same way once.
begin;

update public.list_orders as list_order
set level_ids = array(
    select ranked.id
    from unnest(list_order.level_ids) with ordinality as ranked(id, position)
    where not exists (
        select 1 from public.level_tags
        where level_tags.user_id = list_order.user_id and level_tags.level_id = ranked.id and level_tags.tag_name = 'Pre-Extremes'
    )
    order by ranked.position
)
where exists (
    select 1 from public.level_tags
    where level_tags.user_id = list_order.user_id and level_tags.tag_name = 'Pre-Extremes'
        and level_tags.level_id = any(list_order.level_ids)
);

delete from public.tags where name = 'Pre-Extremes';

commit;
