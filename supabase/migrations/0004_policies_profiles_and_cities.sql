-- Policies for profiles select and cities update (MVP)

create or replace function app.is_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public
as $$
  select coalesce(
    (select role = 'ADMIN' from app.profiles where id = p_user_id),
    false
  );
$$;

drop policy if exists allow_select_profiles_authenticated on app.profiles;
create policy allow_select_profiles_authenticated on app.profiles
for select using (auth.role() = 'authenticated');

drop policy if exists allow_update_cities_admin on config.cities;
drop policy if exists cities_update_admin on config.cities;

create policy allow_update_cities_admin on config.cities
for update using (app.is_admin(auth.uid()))
with check (app.is_admin(auth.uid()));
