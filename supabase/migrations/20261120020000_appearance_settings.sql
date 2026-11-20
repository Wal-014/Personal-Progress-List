begin;

alter table public.user_settings drop constraint user_settings_theme_check;
update public.user_settings set theme = case theme
    when 'blue' then 'nebula'
    when 'night' then 'graphite'
    when 'synth' then 'crimson'
    else theme end;
alter table public.user_settings add constraint user_settings_theme_check
    check (theme in ('nebula', 'graphite', 'ocean', 'amber', 'crimson', 'porcelain'));
alter table public.user_settings add column background text
    check (background in ('grid', 'aurora', 'celestial', 'orbital'));

commit;
