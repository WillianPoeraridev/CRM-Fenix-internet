-- CRM RLS adjustments for time view (all authenticated can read)

-- Drop previous CRM policies if they exist
drop policy if exists crm_select_admin on app.crm_records;
drop policy if exists crm_select_gestor on app.crm_records;
drop policy if exists crm_select_agendamento on app.crm_records;
drop policy if exists crm_select_vendedor on app.crm_records;

drop policy if exists crm_insert_admin on app.crm_records;
drop policy if exists crm_insert_gestor on app.crm_records;
drop policy if exists crm_insert_vendedor on app.crm_records;

drop policy if exists crm_update_admin on app.crm_records;
drop policy if exists crm_update_gestor on app.crm_records;
drop policy if exists crm_update_vendedor on app.crm_records;

drop policy if exists crm_delete_admin on app.crm_records;

-- New policies
create policy crm_select_authenticated_all on app.crm_records
for select using (auth.role() = 'authenticated');

create policy crm_insert_own on app.crm_records
for insert with check (seller_id = auth.uid());

create policy crm_update_own_or_admin on app.crm_records
for update using (seller_id = auth.uid() or app.is_admin())
with check (seller_id = auth.uid() or app.is_admin());

create policy crm_delete_own_or_admin on app.crm_records
for delete using (seller_id = auth.uid() or app.is_admin());
