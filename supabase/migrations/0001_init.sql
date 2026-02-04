-- CRM Fenix MVP v0.3 schema (Supabase)

create extension if not exists "pgcrypto";

create schema if not exists config;
create schema if not exists app;
create schema if not exists historico;

-- Enums
create type app.user_role as enum ('VENDEDOR','GESTOR','AGENDAMENTO','ADMIN');
create type app.crm_tipo as enum ('VENDA','LEAD','MIGRACAO','INADIMPLENCIA','REATIVACAO');
create type app.crm_status as enum ('PENDENTE','AGENDADO','REAGENDAR','INSTALADO','CANCELADO','INVIAVEL');
create type app.crm_inviabilidade as enum ('REGIAO','PORTA');
create type app.appointment_status as enum ('AGENDADO','REAGENDAMENTO','CONCLUIDO','CANCELADO');
create type app.turno as enum ('MANHA','TARDE');

-- Config tables
create table config.regions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table config.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region_id uuid not null references config.regions(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (name, region_id)
);

create table config.channels (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- App tables
create table app.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role app.user_role not null,
  primary_region_id uuid references config.regions(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table app.crm_records (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users(id),
  updated_by uuid default auth.uid() references auth.users(id),
  competencia_month date not null,
  data_registro date not null,
  qnt integer not null,
  tipo app.crm_tipo not null,
  status app.crm_status not null,
  inviabilidade app.crm_inviabilidade,
  cancel_subtype text,
  nota text,
  nome_completo text not null,
  contato text not null,
  bairro text not null,
  city_id uuid not null references config.cities(id),
  region_id uuid not null references config.regions(id),
  contrato text,
  channel_id uuid references config.channels(id),
  seller_id uuid not null references app.profiles(id),
  valor_plano numeric(12,2) not null,
  valor_migracao numeric(12,2),
  metragem_m numeric(10,2),
  observacao_agenda text,
  data_instalacao date,
  constraint crm_records_qnt_chk check (qnt > 0),
  constraint crm_records_competencia_chk check (competencia_month = date_trunc('month', competencia_month)::date),
  constraint crm_records_inviabilidade_chk check (status <> 'INVIAVEL' or inviabilidade is not null)
);

create table app.appointments (
  id uuid primary key default gen_random_uuid(),
  crm_id uuid not null references app.crm_records(id) on delete cascade,
  region_id uuid not null references config.regions(id),
  date date not null,
  turno app.turno not null,
  slot integer not null,
  status app.appointment_status not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users(id),
  updated_by uuid default auth.uid() references auth.users(id)
);

create table app.sales_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app.profiles(id),
  competencia_month date not null,
  meta_financeira numeric(12,2) not null,
  meta_quantidade integer not null,
  meta_instalacao integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users(id),
  updated_by uuid default auth.uid() references auth.users(id),
  constraint sales_targets_unique unique (user_id, competencia_month),
  constraint sales_targets_competencia_chk check (competencia_month = date_trunc('month', competencia_month)::date)
);

create table app.upgrades (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users(id),
  updated_by uuid default auth.uid() references auth.users(id),
  competencia_month date not null,
  data_registro date not null,
  contrato text not null,
  nome_completo text not null,
  bairro text not null,
  city_id uuid not null references config.cities(id),
  region_id uuid not null references config.regions(id),
  seller_id uuid not null references app.profiles(id),
  valor_plano_atual numeric(12,2) not null,
  valor_plano_novo numeric(12,2) not null,
  diferenca numeric(12,2) not null,
  nota text,
  constraint upgrades_competencia_chk check (competencia_month = date_trunc('month', competencia_month)::date)
);

-- Historico tables
create table historico.crm_status_history (
  id uuid primary key default gen_random_uuid(),
  crm_id uuid not null references app.crm_records(id) on delete cascade,
  from_status app.crm_status,
  to_status app.crm_status not null,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id),
  note text
);

create table historico.appointment_history (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references app.appointments(id) on delete cascade,
  event_type text not null,
  payload jsonb,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id)
);

-- Indexes
create index crm_records_competencia_idx on app.crm_records (competencia_month);
create index crm_records_seller_competencia_idx on app.crm_records (seller_id, competencia_month);
create index crm_records_region_competencia_idx on app.crm_records (region_id, competencia_month);
create index crm_records_status_idx on app.crm_records (status);
create index crm_records_city_idx on app.crm_records (city_id);
create index crm_records_contrato_idx on app.crm_records (contrato);

create index appointments_region_date_idx on app.appointments (region_id, date);
create index appointments_crm_idx on app.appointments (crm_id);
create index appointments_slot_idx on app.appointments (date, turno, slot);

create unique index appointments_unique_slot_agendado
  on app.appointments (region_id, date, turno, slot)
  where status = 'AGENDADO';

create unique index appointments_unique_crm_agendado
  on app.appointments (crm_id)
  where status = 'AGENDADO';

-- Helper functions
create or replace function app.current_role()
returns app.user_role
language sql
stable
security definer
set search_path = app, public
as $$
  select role from app.profiles where id = auth.uid();
$$;

create or replace function app.current_region_id()
returns uuid
language sql
stable
security definer
set search_path = app, public
as $$
  select primary_region_id from app.profiles where id = auth.uid();
$$;

create or replace function app.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(app.current_role() = 'ADMIN', false);
$$;

create or replace function app.is_gestor()
returns boolean
language sql
stable
as $$
  select coalesce(app.current_role() = 'GESTOR', false);
$$;

create or replace function app.is_agendamento()
returns boolean
language sql
stable
as $$
  select coalesce(app.current_role() = 'AGENDAMENTO', false);
$$;

create or replace function app.is_vendedor()
returns boolean
language sql
stable
as $$
  select coalesce(app.current_role() = 'VENDEDOR', false);
$$;

create or replace function app.profile_region_id(p_user_id uuid)
returns uuid
language sql
security definer
set search_path = app, public
as $$
  select primary_region_id from app.profiles where id = p_user_id;
$$;

-- Triggers: region_id, competencia_month, updated_at/updated_by
create or replace function app.set_region_from_city()
returns trigger
language plpgsql
as $$
begin
  if new.city_id is null then
    raise exception 'city_id is required';
  end if;

  select c.region_id into new.region_id
  from config.cities c
  where c.id = new.city_id;

  if new.region_id is null then
    raise exception 'city_id % not found in config.cities', new.city_id;
  end if;

  return new;
end;
$$;

create or replace function app.set_competencia_month_from_data()
returns trigger
language plpgsql
as $$
begin
  if new.data_registro is null then
    raise exception 'data_registro is required';
  end if;
  new.competencia_month := date_trunc('month', new.data_registro)::date;
  return new;
end;
$$;

create or replace function app.set_updated_at_updated_by()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

create or replace function app.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function historico.log_crm_status_change()
returns trigger
language plpgsql
security definer
set search_path = historico, app, public
as $$
begin
  if new.status is distinct from old.status then
    insert into historico.crm_status_history (
      crm_id,
      from_status,
      to_status,
      changed_at,
      changed_by,
      note
    ) values (
      new.id,
      old.status,
      new.status,
      now(),
      auth.uid(),
      null
    );
  end if;
  return new;
end;
$$;

create trigger crm_records_set_region
before insert or update of city_id on app.crm_records
for each row execute function app.set_region_from_city();

create trigger upgrades_set_region
before insert or update of city_id on app.upgrades
for each row execute function app.set_region_from_city();

create trigger crm_records_set_competencia
before insert or update of data_registro on app.crm_records
for each row execute function app.set_competencia_month_from_data();

create trigger upgrades_set_competencia
before insert or update of data_registro on app.upgrades
for each row execute function app.set_competencia_month_from_data();

create trigger crm_records_set_updated
before update on app.crm_records
for each row execute function app.set_updated_at_updated_by();

create trigger appointments_set_updated
before update on app.appointments
for each row execute function app.set_updated_at_updated_by();

create trigger sales_targets_set_updated
before update on app.sales_targets
for each row execute function app.set_updated_at_updated_by();

create trigger upgrades_set_updated
before update on app.upgrades
for each row execute function app.set_updated_at_updated_by();

create trigger profiles_set_updated
before update on app.profiles
for each row execute function app.set_updated_at();

create trigger crm_status_history_insert
after update of status on app.crm_records
for each row execute function historico.log_crm_status_change();

-- RLS
alter table config.regions enable row level security;
alter table config.cities enable row level security;
alter table config.channels enable row level security;

alter table app.profiles enable row level security;
alter table app.crm_records enable row level security;
alter table app.appointments enable row level security;
alter table app.sales_targets enable row level security;
alter table app.upgrades enable row level security;

alter table historico.crm_status_history enable row level security;
alter table historico.appointment_history enable row level security;

-- Config policies
create policy regions_select_auth on config.regions
for select using (auth.role() = 'authenticated');

create policy regions_write_admin on config.regions
for insert with check (app.is_admin());

create policy regions_update_admin on config.regions
for update using (app.is_admin()) with check (app.is_admin());

create policy regions_delete_admin on config.regions
for delete using (app.is_admin());

create policy cities_select_auth on config.cities
for select using (auth.role() = 'authenticated');

create policy cities_write_admin on config.cities
for insert with check (app.is_admin());

create policy cities_update_admin on config.cities
for update using (app.is_admin()) with check (app.is_admin());

create policy cities_delete_admin on config.cities
for delete using (app.is_admin());

create policy channels_select_auth on config.channels
for select using (auth.role() = 'authenticated');

create policy channels_write_admin on config.channels
for insert with check (app.is_admin());

create policy channels_update_admin on config.channels
for update using (app.is_admin()) with check (app.is_admin());

create policy channels_delete_admin on config.channels
for delete using (app.is_admin());

-- Profiles policies
create policy profiles_select_self on app.profiles
for select using (id = auth.uid());

create policy profiles_select_admin on app.profiles
for select using (app.is_admin());

create policy profiles_select_region on app.profiles
for select using (
  (app.is_gestor() or app.is_agendamento())
  and primary_region_id = app.current_region_id()
);

create policy profiles_insert_admin on app.profiles
for insert with check (app.is_admin());

create policy profiles_update_admin on app.profiles
for update using (app.is_admin()) with check (app.is_admin());

-- CRM records policies
create policy crm_select_admin on app.crm_records
for select using (app.is_admin());

create policy crm_select_gestor on app.crm_records
for select using (app.is_gestor() and region_id = app.current_region_id());

create policy crm_select_agendamento on app.crm_records
for select using (app.is_agendamento() and region_id = app.current_region_id());

create policy crm_select_vendedor on app.crm_records
for select using (app.is_vendedor() and seller_id = auth.uid());

create policy crm_insert_admin on app.crm_records
for insert with check (app.is_admin());

create policy crm_insert_gestor on app.crm_records
for insert with check (app.is_gestor() and region_id = app.current_region_id());

create policy crm_insert_vendedor on app.crm_records
for insert with check (app.is_vendedor() and seller_id = auth.uid());

create policy crm_update_admin on app.crm_records
for update using (app.is_admin()) with check (app.is_admin());

create policy crm_update_gestor on app.crm_records
for update using (app.is_gestor() and region_id = app.current_region_id())
with check (app.is_gestor() and region_id = app.current_region_id());

create policy crm_update_vendedor on app.crm_records
for update using (app.is_vendedor() and seller_id = auth.uid())
with check (app.is_vendedor() and seller_id = auth.uid());

create policy crm_delete_admin on app.crm_records
for delete using (app.is_admin());

-- Appointments policies
create policy appointments_select_admin on app.appointments
for select using (app.is_admin());

create policy appointments_select_gestor on app.appointments
for select using (app.is_gestor() and region_id = app.current_region_id());

create policy appointments_select_agendamento on app.appointments
for select using (app.is_agendamento() and region_id = app.current_region_id());

create policy appointments_select_vendedor on app.appointments
for select using (
  app.is_vendedor()
  and exists (
    select 1 from app.crm_records c
    where c.id = crm_id and c.seller_id = auth.uid()
  )
);

create policy appointments_insert_admin on app.appointments
for insert with check (app.is_admin());

create policy appointments_insert_gestor on app.appointments
for insert with check (app.is_gestor() and region_id = app.current_region_id());

create policy appointments_insert_agendamento on app.appointments
for insert with check (app.is_agendamento() and region_id = app.current_region_id());

create policy appointments_update_admin on app.appointments
for update using (app.is_admin()) with check (app.is_admin());

create policy appointments_update_gestor on app.appointments
for update using (app.is_gestor() and region_id = app.current_region_id())
with check (app.is_gestor() and region_id = app.current_region_id());

create policy appointments_update_agendamento on app.appointments
for update using (app.is_agendamento() and region_id = app.current_region_id())
with check (app.is_agendamento() and region_id = app.current_region_id());

create policy appointments_delete_admin on app.appointments
for delete using (app.is_admin());

create policy appointments_delete_gestor on app.appointments
for delete using (app.is_gestor() and region_id = app.current_region_id());

create policy appointments_delete_agendamento on app.appointments
for delete using (app.is_agendamento() and region_id = app.current_region_id());

-- Sales targets policies
create policy targets_select_admin on app.sales_targets
for select using (app.is_admin());

create policy targets_select_gestor on app.sales_targets
for select using (
  app.is_gestor()
  and app.profile_region_id(user_id) = app.current_region_id()
);

create policy targets_select_vendedor on app.sales_targets
for select using (app.is_vendedor() and user_id = auth.uid());

create policy targets_insert_admin on app.sales_targets
for insert with check (app.is_admin());

create policy targets_insert_gestor on app.sales_targets
for insert with check (
  app.is_gestor()
  and app.profile_region_id(user_id) = app.current_region_id()
);

create policy targets_update_admin on app.sales_targets
for update using (app.is_admin()) with check (app.is_admin());

create policy targets_update_gestor on app.sales_targets
for update using (
  app.is_gestor()
  and app.profile_region_id(user_id) = app.current_region_id()
) with check (
  app.is_gestor()
  and app.profile_region_id(user_id) = app.current_region_id()
);

create policy targets_delete_admin on app.sales_targets
for delete using (app.is_admin());

-- Upgrades policies
create policy upgrades_select_admin on app.upgrades
for select using (app.is_admin());

create policy upgrades_select_gestor on app.upgrades
for select using (app.is_gestor() and region_id = app.current_region_id());

create policy upgrades_select_vendedor on app.upgrades
for select using (app.is_vendedor() and seller_id = auth.uid());

create policy upgrades_insert_admin on app.upgrades
for insert with check (app.is_admin());

create policy upgrades_insert_gestor on app.upgrades
for insert with check (app.is_gestor() and region_id = app.current_region_id());

create policy upgrades_insert_vendedor on app.upgrades
for insert with check (app.is_vendedor() and seller_id = auth.uid());

create policy upgrades_update_admin on app.upgrades
for update using (app.is_admin()) with check (app.is_admin());

create policy upgrades_update_gestor on app.upgrades
for update using (app.is_gestor() and region_id = app.current_region_id())
with check (app.is_gestor() and region_id = app.current_region_id());

create policy upgrades_update_vendedor on app.upgrades
for update using (app.is_vendedor() and seller_id = auth.uid())
with check (app.is_vendedor() and seller_id = auth.uid());

create policy upgrades_delete_admin on app.upgrades
for delete using (app.is_admin());

-- Historico policies
create policy crm_status_select_admin on historico.crm_status_history
for select using (app.is_admin());

create policy crm_status_select_gestor on historico.crm_status_history
for select using (
  app.is_gestor() and exists (
    select 1 from app.crm_records c
    where c.id = crm_id and c.region_id = app.current_region_id()
  )
);

create policy crm_status_select_agendamento on historico.crm_status_history
for select using (
  app.is_agendamento() and exists (
    select 1 from app.crm_records c
    where c.id = crm_id and c.region_id = app.current_region_id()
  )
);

create policy crm_status_select_vendedor on historico.crm_status_history
for select using (
  app.is_vendedor() and exists (
    select 1 from app.crm_records c
    where c.id = crm_id and c.seller_id = auth.uid()
  )
);

create policy appointment_history_select_admin on historico.appointment_history
for select using (app.is_admin());

create policy appointment_history_select_gestor on historico.appointment_history
for select using (
  app.is_gestor() and exists (
    select 1 from app.appointments a
    where a.id = appointment_id and a.region_id = app.current_region_id()
  )
);

create policy appointment_history_select_agendamento on historico.appointment_history
for select using (
  app.is_agendamento() and exists (
    select 1 from app.appointments a
    where a.id = appointment_id and a.region_id = app.current_region_id()
  )
);

create policy appointment_history_select_vendedor on historico.appointment_history
for select using (
  app.is_vendedor() and exists (
    select 1 from app.appointments a
    join app.crm_records c on c.id = a.crm_id
    where a.id = appointment_id and c.seller_id = auth.uid()
  )
);

create policy appointment_history_insert_admin on historico.appointment_history
for insert with check (app.is_admin());

create policy appointment_history_insert_gestor on historico.appointment_history
for insert with check (
  app.is_gestor() and exists (
    select 1 from app.appointments a
    where a.id = appointment_id and a.region_id = app.current_region_id()
  )
);

create policy appointment_history_insert_agendamento on historico.appointment_history
for insert with check (
  app.is_agendamento() and exists (
    select 1 from app.appointments a
    where a.id = appointment_id and a.region_id = app.current_region_id()
  )
);

create policy appointment_history_insert_vendedor on historico.appointment_history
for insert with check (
  app.is_vendedor() and exists (
    select 1 from app.appointments a
    join app.crm_records c on c.id = a.crm_id
    where a.id = appointment_id and c.seller_id = auth.uid()
  )
);

-- RPCs for team ranking and targets (no PII)
create or replace function app.rpc_team_ranking(
  p_competencia_month date,
  p_region_id uuid default null
)
returns table (
  seller_id uuid,
  seller_name text,
  total_qnt integer,
  total_valor numeric(12,2),
  total_instalado integer
)
language plpgsql
security definer
set search_path = app, config, public
as $$
declare
  v_role app.user_role;
  v_region uuid;
begin
  select role, primary_region_id into v_role, v_region
  from app.profiles
  where id = auth.uid();

  if v_role is null then
    raise exception 'not authenticated';
  end if;

  if v_role <> 'ADMIN' then
    if p_region_id is null then
      p_region_id := v_region;
    elsif p_region_id <> v_region then
      raise exception 'not allowed';
    end if;
  end if;

  return query
  select
    c.seller_id,
    p.full_name as seller_name,
    sum(c.qnt)::integer as total_qnt,
    coalesce(sum(c.valor_plano), 0)::numeric(12,2) as total_valor,
    sum(case when c.status = 'INSTALADO' then c.qnt else 0 end)::integer as total_instalado
  from app.crm_records c
  join app.profiles p on p.id = c.seller_id
  where c.competencia_month = p_competencia_month
    and (p_region_id is null or c.region_id = p_region_id)
  group by c.seller_id, p.full_name
  order by total_valor desc, total_qnt desc;
end;
$$;

create or replace function app.rpc_team_targets(
  p_competencia_month date,
  p_region_id uuid default null
)
returns table (
  seller_id uuid,
  seller_name text,
  meta_financeira numeric(12,2),
  meta_quantidade integer,
  meta_instalacao integer
)
language plpgsql
security definer
set search_path = app, config, public
as $$
declare
  v_role app.user_role;
  v_region uuid;
begin
  select role, primary_region_id into v_role, v_region
  from app.profiles
  where id = auth.uid();

  if v_role is null then
    raise exception 'not authenticated';
  end if;

  if v_role <> 'ADMIN' then
    if p_region_id is null then
      p_region_id := v_region;
    elsif p_region_id <> v_region then
      raise exception 'not allowed';
    end if;
  end if;

  return query
  select
    t.user_id as seller_id,
    p.full_name as seller_name,
    t.meta_financeira,
    t.meta_quantidade,
    t.meta_instalacao
  from app.sales_targets t
  join app.profiles p on p.id = t.user_id
  where t.competencia_month = p_competencia_month
    and (p_region_id is null or p.primary_region_id = p_region_id)
  order by p.full_name;
end;
$$;

grant execute on function app.rpc_team_ranking(date, uuid) to authenticated;
grant execute on function app.rpc_team_targets(date, uuid) to authenticated;
grant execute on function app.profile_region_id(uuid) to authenticated;

-- Grants
grant usage on schema config, app, historico to authenticated;

grant select, insert, update, delete on all tables in schema config to authenticated;
grant select, insert, update, delete on all tables in schema app to authenticated;
grant select, insert, update, delete on all tables in schema historico to authenticated;


