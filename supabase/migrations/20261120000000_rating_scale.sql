begin;

alter table public.levels
    drop constraint levels_enjoyment_check,
    drop constraint levels_liking_check,
    alter column enjoyment type numeric(3,1),
    alter column liking type numeric(3,1);

update public.levels
set enjoyment = (enjoyment + 10) / 2,
    liking = (liking + 10) / 2
where enjoyment is not null or liking is not null;

alter table public.levels
    add constraint levels_enjoyment_check check (enjoyment between 0 and 10),
    add constraint levels_liking_check check (liking between 0 and 10);

commit;
