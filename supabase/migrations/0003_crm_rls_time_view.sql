-- CRM RLS policies for time view (all authenticated can read)

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

drop policy if exists crm_select_authenticated_all on app.crm_records;
drop policy if exists crm_insert_own on app.crm_records;
drop policy if exists crm_update_own_or_admin on app.crm_records;
drop policy if exists crm_delete_own_or_admin on app.crm_records;

drop policy if exists allow_select_all_authenticated on app.crm_records;
drop policy if exists allow_insert_own on app.crm_records;
drop policy if exists allow_update_own_or_admin on app.crm_records;
drop policy if exists allow_delete_own_or_admin on app.crm_records;

create policy allow_select_all_authenticated on app.crm_records
for select using (auth.role() = 'authenticated');

create policy allow_insert_own on app.crm_records
for insert with check (seller_id = auth.uid());

create policy allow_update_own_or_admin on app.crm_records
for update using (seller_id = auth.uid() or app.is_admin(auth.uid()))
with check (seller_id = auth.uid() or app.is_admin(auth.uid()));

create policy allow_delete_own_or_admin on app.crm_records
for delete using (seller_id = auth.uid() or app.is_admin(auth.uid()));
