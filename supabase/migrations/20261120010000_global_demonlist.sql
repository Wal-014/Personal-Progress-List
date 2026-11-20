alter table public.levels
    add column gdl_position integer check (gdl_position between 1 and 100000);
