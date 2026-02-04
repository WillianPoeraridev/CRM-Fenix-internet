# Supabase Setup (MVP v0.3)

## 1) Criar projeto e pegar credenciais
1. Acesse o dashboard do Supabase e abra o projeto.
2. Va em Project Settings -> API.
3. Copie:
   - Project URL
   - Publishable key (anon public)

## 2) Configurar .env.local (nao comitar)
Arquivo .env.local ja esta no .gitignore.

Exemplo:

NEXT_PUBLIC_SUPABASE_URL=coloque_aqui_sua_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=coloque_aqui_sua_publishable_key

Se precisar no servidor (API routes/Edge):
SUPABASE_SERVICE_ROLE_KEY=coloque_aqui_sua_service_role_key

## 3) Aplicar migrations e seed
Opcao A: SQL Editor no Supabase
1. Abra o SQL Editor.
2. Rode o arquivo supabase/migrations/0001_init.sql
3. Rode o arquivo supabase/seed/seed.sql

Opcao B: Supabase CLI
1. Linkar o projeto: supabase link --project-ref <seu_project_ref>
2. Aplicar migrations: supabase db push
3. Aplicar seed: supabase db seed --file supabase/seed/seed.sql

## 4) Criar primeiro usuario e profile
1. No dashboard, va em Authentication -> Users -> Add user.
2. Copie o UUID do usuario criado.
3. Crie o profile via SQL (ajuste nome, role e region):

insert into app.profiles (id, full_name, role, primary_region_id, is_active)
values (
  '<USER_UUID>',
  'Nome do Usuario',
  'ADMIN',
  null,
  true
);

Para outros perfis, use primary_region_id:
select id from config.regions where name = 'MATRIZ';

Dica: para vendedor/gestor/agendamento use primary_region_id preenchido.

