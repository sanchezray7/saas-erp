-- ============================================================
-- Migracion combinada: SaaS Empresarial
-- Generado: 2026-07-20T13:11:11.853Z
-- ============================================================

-- Desactivar validacion de bodies de funciones (orden circular tablas -> funciones -> RLS)
SET check_function_bodies = false;

-- ============================================================
-- HELPER FUNCTIONS (deben ir antes de las tablas para RLS)
-- ============================================================
-- Helpers security definer (bypasean RLS — mismo patrón que saas-school)
create or replace function public.is_member_of(target_company uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.company_members
    where user_id = auth.uid() and company_id = target_company
  );
$$;

drop function if exists public.is_admin_of(uuid) cascade;
create function public.is_admin_of(company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.company_members
    where company_id = $1 and user_id = auth.uid() and role = 'admin'
  );
$$;


-- ============================================================
-- crm-setup.sql
-- ============================================================
-- SaaS CRM — Esquema de base de datos
-- Ejecutar en Supabase SQL Editor después de crear el proyecto

-- 1. EXTENSIONES
create extension if not exists "pgcrypto";

-- 2. TABLAS BASE

-- Empresas (tenant)
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rif text,
  plan text not null default 'free',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table companies enable row level security;

drop policy if exists "companies_select" on companies;
create policy "companies_select" on companies for select
  using (public.is_member_of(id));

drop policy if exists "Cualquiera inserta empresas" on companies;
create policy "Cualquiera inserta empresas" on companies
  for insert with check (true);

-- Miembros de empresa (relación usuario ↔ empresa)
create table if not exists company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin', 'vendedor', 'supervisor', 'viewer')),
  created_at timestamptz not null default now(),
  unique(company_id, user_id)
);
alter table company_members enable row level security;

drop policy if exists "cm_select" on company_members;
create policy "cm_select" on company_members
  for select using (user_id = auth.uid());

drop policy if exists "cm_insert" on company_members;
create policy "cm_insert" on company_members
  for insert with check (public.is_admin_of(company_id));

drop policy if exists "cm_update" on company_members;
create policy "cm_update" on company_members
  for update using (public.is_admin_of(company_id));

drop policy if exists "cm_delete" on company_members;
create policy "cm_delete" on company_members
  for delete using (public.is_admin_of(company_id));

-- Organizaciones (empresas cliente del CRM)
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  website text,
  description text,
  industry text,
  ruc text,
  direccion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table organizations enable row level security;

drop policy if exists "org_select" on organizations;
create policy "org_select" on organizations for select
  using (public.is_member_of(company_id));
drop policy if exists "org_insert" on organizations;
create policy "org_insert" on organizations for insert
  with check (public.is_member_of(company_id));
drop policy if exists "org_update" on organizations;
create policy "org_update" on organizations for update
  using (public.is_member_of(company_id));
drop policy if exists "org_delete" on organizations;
create policy "org_delete" on organizations for delete
  using (public.is_member_of(company_id));

create index if not exists idx_organizations_company on organizations(company_id);

-- Contactos
create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  organization_id uuid references organizations(id) on delete set null,
  name text not null,
  email text,
  phone text,
  position text,
  source text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table contacts enable row level security;

drop policy if exists "contacts_select" on contacts;
create policy "contacts_select" on contacts for select
  using (public.is_member_of(company_id));
drop policy if exists "contacts_insert" on contacts;
create policy "contacts_insert" on contacts for insert
  with check (public.is_member_of(company_id));
drop policy if exists "contacts_update" on contacts;
create policy "contacts_update" on contacts for update
  using (public.is_member_of(company_id));
drop policy if exists "contacts_delete" on contacts;
create policy "contacts_delete" on contacts for delete
  using (public.is_member_of(company_id));

create index if not exists idx_contacts_company on contacts(company_id);

-- Pipelines (embudos de venta)
create table if not exists pipelines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table pipelines enable row level security;

drop policy if exists "pipelines_select" on pipelines;
create policy "pipelines_select" on pipelines for select
  using (public.is_member_of(company_id));
drop policy if exists "pipelines_insert" on pipelines;
create policy "pipelines_insert" on pipelines for insert
  with check (public.is_member_of(company_id));
drop policy if exists "pipelines_update" on pipelines;
create policy "pipelines_update" on pipelines for update
  using (public.is_member_of(company_id));
drop policy if exists "pipelines_delete" on pipelines;
create policy "pipelines_delete" on pipelines for delete
  using (public.is_member_of(company_id));

-- Etapas de pipeline
create table if not exists stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references pipelines(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  probability integer default 0,
  color text default '#6366f1',
  created_at timestamptz not null default now()
);
alter table stages enable row level security;

drop policy if exists "stages_select" on stages;
create policy "stages_select" on stages for select
  using (
    exists (
      select 1 from public.pipelines p
      where p.id = pipeline_id and public.is_member_of(p.company_id)
    )
  );
drop policy if exists "stages_insert" on stages;
create policy "stages_insert" on stages for insert
  with check (
    exists (
      select 1 from public.pipelines p
      where p.id = pipeline_id and public.is_member_of(p.company_id)
    )
  );
drop policy if exists "stages_update" on stages;
create policy "stages_update" on stages for update
  using (
    exists (
      select 1 from public.pipelines p
      where p.id = pipeline_id and public.is_member_of(p.company_id)
    )
  );
drop policy if exists "stages_delete" on stages;
create policy "stages_delete" on stages for delete
  using (
    exists (
      select 1 from public.pipelines p
      where p.id = pipeline_id and public.is_member_of(p.company_id)
    )
  );

-- Deals (oportunidades de venta)
create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  pipeline_id uuid not null references pipelines(id) on delete cascade,
  stage_id uuid not null references stages(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  organization_id uuid references organizations(id) on delete set null,
  title text not null,
  value numeric(12,2) default 0,
  probability integer default 0,
  expected_close_date date,
  notes text,
  position integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table deals enable row level security;

drop policy if exists "deals_select" on deals;
create policy "deals_select" on deals for select
  using (public.is_member_of(company_id));
drop policy if exists "deals_insert" on deals;
create policy "deals_insert" on deals for insert
  with check (public.is_member_of(company_id));
drop policy if exists "deals_update" on deals;
create policy "deals_update" on deals for update
  using (public.is_member_of(company_id));
drop policy if exists "deals_delete" on deals;
create policy "deals_delete" on deals for delete
  using (public.is_member_of(company_id));

create index if not exists idx_deals_company on deals(company_id);
create index if not exists idx_deals_stage on deals(stage_id);

-- Actividades (llamadas, correos, reuniones, notas)
create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  contact_id uuid references contacts(id) on delete cascade,
  deal_id uuid references deals(id) on delete cascade,
  type text not null check (type in ('call', 'email', 'meeting', 'note', 'task')),
  subject text not null,
  description text,
  due_date timestamptz,
  done boolean not null default false,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table activities enable row level security;

drop policy if exists "activities_select" on activities;
create policy "activities_select" on activities for select
  using (public.is_member_of(company_id));
drop policy if exists "activities_insert" on activities;
create policy "activities_insert" on activities for insert
  with check (public.is_member_of(company_id));
drop policy if exists "activities_update" on activities;
create policy "activities_update" on activities for update
  using (public.is_member_of(company_id));
drop policy if exists "activities_delete" on activities;
create policy "activities_delete" on activities for delete
  using (public.is_member_of(company_id));

create index if not exists idx_activities_company on activities(company_id);

-- 3. FUNCIÓN DE ACTUALIZACIÓN
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_companies_updated_at on companies;
create trigger trg_companies_updated_at before update on companies
  for each row execute function update_updated_at();
drop trigger if exists trg_organizations_updated_at on organizations;
create trigger trg_organizations_updated_at before update on organizations
  for each row execute function update_updated_at();
drop trigger if exists trg_contacts_updated_at on contacts;
create trigger trg_contacts_updated_at before update on contacts
  for each row execute function update_updated_at();
drop trigger if exists trg_pipelines_updated_at on pipelines;
create trigger trg_pipelines_updated_at before update on pipelines
  for each row execute function update_updated_at();
drop trigger if exists trg_deals_updated_at on deals;
create trigger trg_deals_updated_at before update on deals
  for each row execute function update_updated_at();
drop trigger if exists trg_activities_updated_at on activities;
create trigger trg_activities_updated_at before update on activities
  for each row execute function update_updated_at();

-- Tabla de configuración white-label por empresa
create table if not exists company_config (
  company_id uuid primary key references companies(id) on delete cascade,
  logo_url text,
  app_name text,
  primary_color text default '#2c7be5',
  favicon_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table company_config enable row level security;

drop policy if exists "cc_select" on company_config;
create policy "cc_select" on company_config for select
  using (public.is_member_of(company_id));

drop policy if exists "cc_insert" on company_config;
create policy "cc_insert" on company_config for insert
  with check (public.is_admin_of(company_id));

drop policy if exists "cc_update" on company_config;
create policy "cc_update" on company_config for update
  using (public.is_admin_of(company_id));

-- 4. FUNCIÓN crear_empresa_crm (con user_id y rif opcionales)
create or replace function crear_empresa_crm(
  empresa_nombre text,
  p_user_id uuid default auth.uid(),
  p_rif text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_company_id uuid;
  v_pipeline_id uuid;
  v_user_id uuid;
begin
  v_user_id := coalesce(p_user_id, auth.uid());

  if v_user_id is null then
    raise exception 'No se puede identificar al usuario. Registrate primero.';
  end if;

  -- Crear empresa
  insert into companies (name, rif) values (empresa_nombre, p_rif)
    returning id into v_company_id;

  -- Asignar usuario como admin
  insert into company_members (company_id, user_id, role)
    values (v_company_id, v_user_id, 'admin');

  -- Crear config white-label por defecto
  insert into company_config (company_id, app_name)
    values (v_company_id, empresa_nombre);

  -- Crear pipeline por defecto
  insert into pipelines (company_id, name, description)
    values (v_company_id, 'Pipeline por defecto', 'Pipeline principal de ventas')
    returning id into v_pipeline_id;

  -- Crear etapas por defecto
  insert into stages (pipeline_id, name, position, probability, color) values
    (v_pipeline_id, 'Nuevo',           0, 10,  '#6366f1'),
    (v_pipeline_id, 'Contactado',      1, 25,  '#3b82f6'),
    (v_pipeline_id, 'Propuesta',       2, 50,  '#f59e0b'),
    (v_pipeline_id, 'Negociación',     3, 75,  '#f97316'),
    (v_pipeline_id, 'Cerrado ganado',  4, 100, '#22c55e'),
    (v_pipeline_id, 'Cerrado perdido', 5, 0,   '#ef4444');

  return v_company_id;
end;
$$;

-- 5. MIGRACIÓN: agregar columnas a companies si la tabla ya existe
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name = 'companies' and column_name = 'rif') then
    alter table companies add column rif text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'companies' and column_name = 'plan') then
    alter table companies add column plan text not null default 'free';
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'companies' and column_name = 'status') then
    alter table companies add column status text not null default 'active';
  end if;
end $$;

-- Índice único para RIF (debe ir después de la migración que agrega la columna)
create unique index if not exists companies_rif_idx on companies (rif) where rif is not null;

-- 6. CUSTOM ACCESS TOKEN HOOK
-- Inyecta companies y roles por company en el JWT al hacer login.
-- HABILITAR MANUALMENTE: Supabase Dashboard → Auth → Hooks → Custom Access Token → trigger function custom_access_token_hook
-- (evento: auth / type: access_token / method: function)

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
as $$
declare
  claims jsonb;
  uid uuid;
  companies_json jsonb;
  roles_json jsonb;
begin
  uid := (event->>'user_id')::uuid;

  select coalesce(
            jsonb_agg(distinct jsonb_build_object('id', c.id, 'name', c.name, 'plan', c.plan)),
           '[]'::jsonb
         )
    into companies_json
  from public.company_members cm
  join public.companies c on c.id = cm.company_id
  where cm.user_id = uid;

  select coalesce(
           jsonb_object_agg(company_id, roles),
           '{}'::jsonb
         )
    into roles_json
  from (
    select company_id::text as company_id, jsonb_agg(role) as roles
    from public.company_members
    where user_id = uid
    group by company_id
  ) t;

  claims := event->'claims';
  claims := jsonb_set(claims, '{companies}', companies_json);
  claims := jsonb_set(claims, '{roles_by_company}', roles_json);

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- El hook corre como `supabase_auth_admin`. Sin estos GRANT falla en silencio.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
grant select on public.company_members to supabase_auth_admin;
grant select on public.companies to supabase_auth_admin;

drop policy if exists "auth admin lee company_members" on public.company_members;
create policy "auth admin lee company_members"
  on public.company_members for select to supabase_auth_admin
  using (true);

drop policy if exists "auth admin lee companies" on public.companies;
create policy "auth admin lee companies"
  on public.companies for select to supabase_auth_admin
  using (true);

-- 7. TABLA role_permissions — mapeo rol → permisos (para la Edge Function get-user-permissions)
create table if not exists role_permissions (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  permission text not null,
  unique(role, permission)
);
alter table role_permissions enable row level security;

-- Policy: solo lectura para usuarios autenticados (la EF usa service_role, pero por si acaso)
drop policy if exists "role_permissions select autenticado" on role_permissions;
create policy "role_permissions select autenticado" on role_permissions
  for select using (auth.role() = 'authenticated');

-- Seed: permisos por rol (CRM)
insert into role_permissions (role, permission) values
  -- admin: todo
  ('admin', 'contact:ver'), ('admin', 'contact:crear'), ('admin', 'contact:editar'), ('admin', 'contact:eliminar'),
  ('admin', 'organization:ver'), ('admin', 'organization:crear'), ('admin', 'organization:editar'), ('admin', 'organization:eliminar'),
  ('admin', 'deal:ver'), ('admin', 'deal:crear'), ('admin', 'deal:editar'), ('admin', 'deal:eliminar'),
  ('admin', 'pipeline:ver'), ('admin', 'pipeline:crear'), ('admin', 'pipeline:editar'), ('admin', 'pipeline:eliminar'),
  ('admin', 'activity:ver'), ('admin', 'activity:crear'),
  ('admin', 'reporte:ver'),
  ('admin', 'usuario:ver'), ('admin', 'usuario:crear'), ('admin', 'usuario:editar'),
  ('admin', 'config:ver'), ('admin', 'config:crear'),
  -- vendedor
  ('vendedor', 'contact:ver'), ('vendedor', 'contact:crear'), ('vendedor', 'contact:editar'),
  ('vendedor', 'organization:ver'), ('vendedor', 'organization:crear'), ('vendedor', 'organization:editar'),
  ('vendedor', 'deal:ver'), ('vendedor', 'deal:crear'), ('vendedor', 'deal:editar'),
  ('vendedor', 'pipeline:ver'),
  ('vendedor', 'activity:ver'), ('vendedor', 'activity:crear'),
  -- supervisor
  ('supervisor', 'contact:ver'), ('supervisor', 'contact:crear'), ('supervisor', 'contact:editar'), ('supervisor', 'contact:eliminar'),
  ('supervisor', 'organization:ver'), ('supervisor', 'organization:crear'), ('supervisor', 'organization:editar'), ('supervisor', 'organization:eliminar'),
  ('supervisor', 'deal:ver'), ('supervisor', 'deal:crear'), ('supervisor', 'deal:editar'), ('supervisor', 'deal:eliminar'),
  ('supervisor', 'pipeline:ver'), ('supervisor', 'pipeline:crear'), ('supervisor', 'pipeline:editar'),
  ('supervisor', 'activity:ver'), ('supervisor', 'activity:crear'),
  ('supervisor', 'reporte:ver'),
  -- viewer: solo lectura
  ('viewer', 'contact:ver'),
  ('viewer', 'organization:ver'),
  ('viewer', 'deal:ver'),
  ('viewer', 'pipeline:ver'),
  ('viewer', 'activity:ver')
on conflict (role, permission) do nothing;

-- 8. RPC: obtener empresas del usuario (security definer — bypasea RLS)
create or replace function get_user_companies()
returns jsonb
language plpgsql
security definer
stable
as $$
declare
  result jsonb;
begin
  select coalesce(
    jsonb_agg(    jsonb_build_object('id', cm.company_id, 'name', c.name, 'role', cm.role, 'plan', c.plan)),
    '[]'::jsonb
  )
  into result
  from public.company_members cm
  join public.companies c on c.id = cm.company_id
  where cm.user_id = auth.uid();

  return result;
end;
$$;


-- ============================================================
-- contacts-setup.sql
-- ============================================================
-- Campos fiscales para contactos (facturación electrónica)
-- Ejecutar después de crm-setup.sql

alter table contacts add column if not exists ruc text;
alter table contacts add column if not exists dv text;
alter table contacts add column if not exists tipo_documento int;
alter table contacts add column if not exists num_documento text;
alter table contacts add column if not exists pais text default 'PRY';
alter table contacts add column if not exists direccion text;
alter table contacts add column if not exists codigo_cliente text;


-- ============================================================
-- leads-setup.sql
-- ============================================================
-- ============================================================
-- Webhook leads: tabla webhook_tokens + RLS + RPCs
-- Ejecutar después de crm-setup.sql
-- ============================================================

-- 0. Agregar columnas faltantes a contacts (necesarias para triggers de notificaciones)
alter table contacts add column if not exists assigned_to uuid references auth.users(id) on delete set null;
alter table contacts add column if not exists created_by uuid references auth.users(id) on delete set null;

create index if not exists idx_contacts_assigned_to on contacts(assigned_to);

-- 1. TABLA webhook_tokens
create table if not exists public.webhook_tokens (
  company_id uuid primary key references public.companies(id) on delete cascade,
  token      uuid not null default gen_random_uuid() unique,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.webhook_tokens enable row level security;

-- RLS: miembros pueden leer, admin puede actualizar
drop policy if exists "wt_select" on public.webhook_tokens;
create policy "wt_select" on public.webhook_tokens for select
  using (public.is_member_of(company_id));

drop policy if exists "wt_update" on public.webhook_tokens;
create policy "wt_update" on public.webhook_tokens for update
  using (public.is_admin_of(company_id));

-- 2. RPC: obtener token webhook de la empresa activa
create or replace function public.obtener_token_webhook(p_company_id uuid)
returns jsonb
language plpgsql
security definer
stable
as $$
declare
  v_token uuid;
  v_active boolean;
begin
  select wt.token, wt.is_active into v_token, v_active
  from public.webhook_tokens wt
  where wt.company_id = p_company_id;

  if not found then
    -- auto-crear si no existe
    insert into public.webhook_tokens (company_id)
    values (p_company_id)
    returning token, is_active into v_token, v_active;
  end if;

  return jsonb_build_object(
    'token', v_token,
    'is_active', v_active
  );
end;
$$;

-- 3. RPC: regenerar token
create or replace function public.regenerar_token_webhook(p_company_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_new uuid := gen_random_uuid();
begin
  insert into public.webhook_tokens (company_id, token)
  values (p_company_id, v_new)
  on conflict (company_id)
  do update set token = v_new, updated_at = now();
  return v_new;
end;
$$;

-- 4. RPC: activar/desactivar webhook
create or replace function public.toggle_webhook_activo(p_company_id uuid, p_active boolean)
returns void
language plpgsql
security definer
as $$
begin
  update public.webhook_tokens
  set is_active = p_active, updated_at = now()
  where company_id = p_company_id;
end;
$$;

-- 5. Auto-crear token al crear empresa (modificar función)
-- Reemplazar crear_empresa_crm para que también inserte webhook_tokens
create or replace function public.crear_empresa_crm(
  empresa_nombre text,
  p_user_id uuid default auth.uid(),
  p_rif text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_company_id uuid;
  v_pipeline_id uuid;
  v_user_id uuid;
begin
  v_user_id := coalesce(p_user_id, auth.uid());

  if v_user_id is null then
    raise exception 'No se puede identificar al usuario. Registrate primero.';
  end if;

  insert into companies (name, rif) values (empresa_nombre, p_rif)
    returning id into v_company_id;

  insert into company_members (company_id, user_id, role)
    values (v_company_id, v_user_id, 'admin');

  insert into company_config (company_id, app_name)
    values (v_company_id, empresa_nombre);

  insert into pipelines (company_id, name, description)
    values (v_company_id, 'Pipeline por defecto', 'Pipeline principal de ventas')
    returning id into v_pipeline_id;

  insert into stages (pipeline_id, name, position, probability, color) values
    (v_pipeline_id, 'Nuevo',           0, 10,  '#6366f1'),
    (v_pipeline_id, 'Contactado',      1, 25,  '#3b82f6'),
    (v_pipeline_id, 'Propuesta',       2, 50,  '#f59e0b'),
    (v_pipeline_id, 'Negociación',     3, 75,  '#f97316'),
    (v_pipeline_id, 'Cerrado ganado',  4, 100, '#22c55e'),
    (v_pipeline_id, 'Cerrado perdido', 5, 0,   '#ef4444');

  -- Auto-crear webhook token
  insert into webhook_tokens (company_id, token)
  values (v_company_id, gen_random_uuid());

  return v_company_id;
end;
$$;


-- ============================================================
-- cold-leads-setup.sql
-- ============================================================
-- Cold Lead Alerts: columna last_activity_at + trigger
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar columna a contacts y deals
alter table contacts add column if not exists last_activity_at timestamptz;
alter table deals add column if not exists last_activity_at timestamptz;

-- 2. Función trigger: actualiza last_activity_at en contact y deal vinculados
create or replace function update_last_activity_at()
returns trigger
language plpgsql
security definer
as $$
begin
  if NEW.contact_id is not null then
    update contacts set last_activity_at = NEW.created_at
    where id = NEW.contact_id and (last_activity_at is null or last_activity_at < NEW.created_at);
  end if;
  if NEW.deal_id is not null then
    update deals set last_activity_at = NEW.created_at
    where id = NEW.deal_id and (last_activity_at is null or last_activity_at < NEW.created_at);
  end if;
  return NEW;
end;
$$;

-- 3. Trigger sobre activities
drop trigger if exists trg_activities_last_activity on activities;
create trigger trg_activities_last_activity
  after insert on activities
  for each row
  execute function update_last_activity_at();

-- 4. Backfill: poblar last_activity_at con datos existentes
update contacts c
set last_activity_at = (
  select max(a.created_at) from activities a
  where a.contact_id = c.id and a.company_id = c.company_id
)
where exists (select 1 from activities a where a.contact_id = c.id);

update deals d
set last_activity_at = (
  select max(a.created_at) from activities a
  where a.deal_id = d.id and a.company_id = d.company_id
)
where exists (select 1 from activities a where a.deal_id = d.id);


-- ============================================================
-- industries-setup.sql
-- ============================================================
-- Industries: tabla para catálogo de industrias por empresa
-- Ejecutar en Supabase SQL Editor

create table if not exists industries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique(company_id, name)
);
alter table industries enable row level security;

drop policy if exists "ind_select" on industries;
create policy "ind_select" on industries for select
  using (public.is_member_of(company_id));

drop policy if exists "ind_insert" on industries;
create policy "ind_insert" on industries for insert
  with check (public.is_member_of(company_id));

drop policy if exists "ind_update" on industries;
create policy "ind_update" on industries for update
  using (public.is_member_of(company_id));

drop policy if exists "ind_delete" on industries;
create policy "ind_delete" on industries for delete
  using (public.is_member_of(company_id));

-- Función RPC para seed (usada desde Edge Function company-signup)
create or replace function seed_default_industries(p_company_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  insert into industries (company_id, name) values
    (p_company_id, 'Tecnología'),
    (p_company_id, 'Salud'),
    (p_company_id, 'Educación'),
    (p_company_id, 'Finanzas'),
    (p_company_id, 'Comercio'),
    (p_company_id, 'Manufactura'),
    (p_company_id, 'Consultoría'),
    (p_company_id, 'Inmobiliario'),
    (p_company_id, 'Logística'),
    (p_company_id, 'Alimentos'),
    (p_company_id, 'Entretenimiento'),
    (p_company_id, 'Energía'),
    (p_company_id, 'Agricultura'),
    (p_company_id, 'Construcción'),
    (p_company_id, 'Telecomunicaciones'),
    (p_company_id, 'Automotriz'),
    (p_company_id, 'Turismo'),
    (p_company_id, 'Legal')
  on conflict (company_id, name) do nothing;
end;
$$;

-- Seed para empresas existentes
do $$
declare
  rec record;
begin
  for rec in select id from companies loop
    perform seed_default_industries(rec.id);
  end loop;
end;
$$;


-- ============================================================
-- tags-setup.sql
-- ============================================================
-- Tags para contactos y oportunidades
-- Ejecutar después de crm-setup.sql

create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  nombre text not null,
  color text not null default '#6366f1',
  created_at timestamptz not null default now(),
  unique(company_id, nombre)
);

alter table tags enable row level security;

drop policy if exists "tags_select" on tags;
create policy "tags_select" on tags for select
  using (public.is_member_of(company_id));

drop policy if exists "tags_insert" on tags;
create policy "tags_insert" on tags for insert
  with check (public.is_member_of(company_id));

drop policy if exists "tags_delete" on tags;
create policy "tags_delete" on tags for delete
  using (public.is_member_of(company_id));

create table if not exists contact_tags (
  contact_id uuid not null references contacts(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (contact_id, tag_id)
);

alter table contact_tags enable row level security;

drop policy if exists "contact_tags_select" on contact_tags;
create policy "contact_tags_select" on contact_tags for select
  using (exists (select 1 from contacts c where c.id = contact_id and public.is_member_of(c.company_id)));

drop policy if exists "contact_tags_insert" on contact_tags;
create policy "contact_tags_insert" on contact_tags for insert
  with check (exists (select 1 from contacts c where c.id = contact_id and public.is_member_of(c.company_id)));

drop policy if exists "contact_tags_delete" on contact_tags;
create policy "contact_tags_delete" on contact_tags for delete
  using (exists (select 1 from contacts c where c.id = contact_id and public.is_member_of(c.company_id)));

-- Extensión a deals (opcional, misma estructura)
create table if not exists deal_tags (
  deal_id uuid not null references deals(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (deal_id, tag_id)
);

alter table deal_tags enable row level security;

drop policy if exists "deal_tags_select" on deal_tags;
create policy "deal_tags_select" on deal_tags for select
  using (exists (select 1 from deals d where d.id = deal_id and public.is_member_of(d.company_id)));

drop policy if exists "deal_tags_insert" on deal_tags;
create policy "deal_tags_insert" on deal_tags for insert
  with check (exists (select 1 from deals d where d.id = deal_id and public.is_member_of(d.company_id)));

drop policy if exists "deal_tags_delete" on deal_tags;
create policy "deal_tags_delete" on deal_tags for delete
  using (exists (select 1 from deals d where d.id = deal_id and public.is_member_of(d.company_id)));


-- ============================================================
-- ruc-setup.sql
-- ============================================================
-- RUC y dirección para organizations (búsqueda por API pública)
alter table organizations add column if not exists ruc text;
alter table organizations add column if not exists direccion text;

create index if not exists idx_organizations_ruc on organizations(company_id, ruc);


-- ============================================================
-- metas-setup.sql
-- ============================================================
-- Metas de ventas por vendedor
-- Ejecutar después de crm-setup.sql

create table if not exists metas_ventas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  anio integer not null,
  mes integer not null,
  monto_objetivo numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  unique(company_id, user_id, anio, mes)
);

alter table metas_ventas enable row level security;

drop policy if exists "metas_select" on metas_ventas;
create policy "metas_select" on metas_ventas for select
  using (public.is_member_of(company_id));

drop policy if exists "metas_insert" on metas_ventas;
create policy "metas_insert" on metas_ventas for insert
  with check (public.is_member_of(company_id));

drop policy if exists "metas_update" on metas_ventas;
create policy "metas_update" on metas_ventas for update
  using (public.is_member_of(company_id));

drop policy if exists "metas_delete" on metas_ventas;
create policy "metas_delete" on metas_ventas for delete
  using (public.is_member_of(company_id));

create index if not exists idx_metas_company on metas_ventas(company_id, anio, mes);

-- RPC para obtener progreso de metas
create or replace function obtener_progreso_meta(
  p_company_id uuid,
  p_anio integer,
  p_mes integer
)
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
begin
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'user_id', t.user_id,
      'email', t.email,
      'nombre', t.nombre,
      'monto_objetivo', t.monto_objetivo,
      'monto_alcanzado', t.monto_alcanzado,
      'porcentaje', case when t.monto_objetivo > 0 then round((t.monto_alcanzado / t.monto_objetivo) * 100) else 0 end,
      'deals_ganados', t.deals_ganados
    ) order by t.nombre
  ), '[]'::jsonb)
  into result
  from (
    select
      m.user_id,
      u.email::text,
      u.raw_user_meta_data->>'full_name' as nombre,
      m.monto_objetivo,
      coalesce(
        (select sum(d.value)
         from deals d
         join stages s on s.id = d.stage_id
         where d.company_id = p_company_id
           and d.assigned_to = m.user_id
           and s.name = 'Cerrado ganado'
           and extract(year from d.closed_at) = p_anio
           and extract(month from d.closed_at) = p_mes
        ), 0
      ) as monto_alcanzado,
      (
        select count(*)
        from deals d
        join stages s on s.id = d.stage_id
        where d.company_id = p_company_id
          and d.assigned_to = m.user_id
          and s.name = 'Cerrado ganado'
          and extract(year from d.closed_at) = p_anio
          and extract(month from d.closed_at) = p_mes
      ) as deals_ganados
    from metas_ventas m
    join auth.users u on u.id = m.user_id
    where m.company_id = p_company_id
      and m.anio = p_anio
      and m.mes = p_mes
  ) t;

  return result;
end;
$$;


-- ============================================================
-- email-templates-setup.sql
-- ============================================================
-- ============================================================
-- Plantillas de correo dinámicas
-- Ejecutar después de crm-setup.sql
-- ============================================================

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  subject text not null,
  body text not null,
  context text not null default 'contact'
    check (context in ('contact', 'deal', 'lead')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.email_templates enable row level security;

drop policy if exists "et_select" on public.email_templates;
create policy "et_select" on public.email_templates for select
  using (public.is_member_of(company_id));

drop policy if exists "et_insert" on public.email_templates;
create policy "et_insert" on public.email_templates for insert
  with check (public.is_member_of(company_id));

drop policy if exists "et_update" on public.email_templates;
create policy "et_update" on public.email_templates for update
  using (public.is_member_of(company_id));

drop policy if exists "et_delete" on public.email_templates;
create policy "et_delete" on public.email_templates for delete
  using (public.is_member_of(company_id));

create index if not exists idx_email_templates_company on public.email_templates(company_id);


-- ============================================================
-- notificaciones-setup.sql
-- ============================================================
-- Notificaciones in-app — tabla + RLS + RPCs + triggers
-- Ejecutar después de crm-setup.sql

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'info',
  title text not null,
  message text,
  link text,
  read boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table notifications enable row level security;

-- RLS: cada usuario solo ve sus propias notificaciones
drop policy if exists "notificaciones_select" on notifications;
create policy "notificaciones_select" on notifications
  for select using (user_id = auth.uid());

drop policy if exists "notificaciones_insert" on notifications;
create policy "notificaciones_insert" on notifications
  for insert with check (public.is_member_of(company_id));

drop policy if exists "notificaciones_update" on notifications;
create policy "notificaciones_update" on notifications
  for update using (user_id = auth.uid());

drop policy if exists "notificaciones_delete" on notifications;
create policy "notificaciones_delete" on notifications
  for delete using (user_id = auth.uid());

-- RPC: listar notificaciones del usuario
create or replace function listar_notificaciones(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'id', n.id,
      'company_id', n.company_id,
      'user_id', n.user_id,
      'type', n.type,
      'title', n.title,
      'message', n.message,
      'link', n.link,
      'read', n.read,
      'created_by', n.created_by,
      'created_at', n.created_at
    ) order by n.created_at desc),
    '[]'::jsonb
  )
  into result
  from notifications n
  where n.company_id = p_company_id and n.user_id = auth.uid();

  return result;
end;
$$;

-- RPC: contar no leídas
create or replace function contar_no_leidas(p_company_id uuid)
returns bigint
language sql
security definer
set search_path = public
as $$
  select count(*)::bigint
  from notifications
  where company_id = p_company_id and user_id = auth.uid() and not read;
$$;

-- RPC: marcar como leída
create or replace function marcar_leida(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update notifications set read = true where id = p_id and user_id = auth.uid();
$$;

-- RPC: marcar todas como leídas
create or replace function marcar_todas_leidas(p_company_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update notifications set read = true
  where company_id = p_company_id and user_id = auth.uid() and not read;
$$;

-- RPC: crear notificación manual (solo admin)
create or replace function crear_notificacion(p_company_id uuid, p_user_id uuid, p_type text, p_title text, p_message text, p_link text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin_of(p_company_id) then
    raise exception 'Solo administradores pueden crear notificaciones';
  end if;

  insert into notifications (company_id, user_id, type, title, message, link, created_by)
  values (p_company_id, p_user_id, p_type, p_title, p_message, p_link, auth.uid())
  returning row_to_json(notifications)::jsonb into result;

  return result;
end;
$$;

-- RPC: crear notificación para todos los miembros (solo admin)
create or replace function crear_notificacion_todos(p_company_id uuid, p_type text, p_title text, p_message text, p_link text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_of(p_company_id) then
    raise exception 'Solo administradores pueden crear notificaciones';
  end if;

  insert into notifications (company_id, user_id, type, title, message, link, created_by)
  select p_company_id, cm.user_id, p_type, p_title, p_message, p_link, auth.uid()
  from public.company_members cm
  where cm.company_id = p_company_id;
end;
$$;

-- Trigger: notificar al asignado de un contacto (round robin / asignación manual)
create or replace function public.notify_contact_assigned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assigned_to is not null and (old is null or old.assigned_to is distinct from new.assigned_to) then
    insert into notifications (company_id, user_id, type, title, message, link, created_by)
    values (
      new.company_id,
      new.assigned_to,
      'contacto_asignado',
      'Nuevo contacto asignado',
      'Se te ha asignado el contacto: ' || new.name,
      '/contacts/' || new.id,
      new.created_by
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_contact_assigned on contacts;
create trigger trg_notify_contact_assigned
  after insert or update of assigned_to on contacts
  for each row execute function public.notify_contact_assigned();

-- Trigger: notificar cambio de etapa en deal
create or replace function public.notify_deal_stage_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  stage_name text;
  assignees uuid[];
begin
  if old.stage_id is distinct from new.stage_id then
    select name into stage_name from stages where id = new.stage_id;

    -- Notificar al creador/asignado del deal
    assignees := array[new.created_by, new.assigned_to];

    insert into notifications (company_id, user_id, type, title, message, link, created_by)
    select
      new.company_id,
      unnest(assignees),
      'deal_stage_change',
      'Cambio de etapa',
      'La oportunidad "' || new.title || '" pasó a: ' || coalesce(stage_name, 'sin etapa'),
      '/deals/' || new.id,
      new.updated_by
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_deal_stage_change on deals;
create trigger trg_notify_deal_stage_change
  after update of stage_id on deals
  for each row execute function public.notify_deal_stage_change();


-- ============================================================
-- round-robin-setup.sql
-- ============================================================
-- Round Robin: asignación automática de leads a vendedores
-- Ejecutar en Supabase SQL Editor

-- 1. Columna assigned_to en contacts
alter table contacts add column if not exists assigned_to uuid references auth.users(id);

-- 2. Cursor del round-robin en company_config
alter table company_config add column if not exists last_assigned_user_id uuid references auth.users(id);

-- 3. Tabla de configuración de routing
create table if not exists lead_routing (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  orden integer not null default 0,
  activo boolean not null default true,
  unique(company_id, user_id)
);
alter table lead_routing enable row level security;

drop policy if exists "lr_select" on lead_routing;
create policy "lr_select" on lead_routing for select
  using (public.is_member_of(company_id));

drop policy if exists "lr_insert" on lead_routing;
create policy "lr_insert" on lead_routing for insert
  with check (public.is_admin_of(company_id));

drop policy if exists "lr_update" on lead_routing;
create policy "lr_update" on lead_routing for update
  using (public.is_admin_of(company_id));

drop policy if exists "lr_delete" on lead_routing;
create policy "lr_delete" on lead_routing for delete
  using (public.is_admin_of(company_id));

-- 4. Función de asignación round-robin
create or replace function asignar_siguiente_vendedor(p_company_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_last_id uuid;
begin
  select last_assigned_user_id into v_last_id
  from company_config where company_id = p_company_id;

  select lr.user_id into v_user_id
  from lead_routing lr
  where lr.company_id = p_company_id and lr.activo = true
  order by lr.orden
  offset (
    select coalesce(
      (select lr2.orden from lead_routing lr2
       where lr2.company_id = p_company_id and lr2.user_id = v_last_id),
      -1
    ) + 1
  )
  limit 1;

  if v_user_id is null then
    select lr.user_id into v_user_id
    from lead_routing lr
    where lr.company_id = p_company_id and lr.activo = true
    order by lr.orden
    limit 1;
  end if;

  update company_config set last_assigned_user_id = v_user_id
  where company_id = p_company_id;

  return v_user_id;
end;
$$;

-- 5. RPC: listar miembros de la empresa (solo admins)
create or replace function listar_miembros_empresa(p_company_id uuid)
returns table (user_id uuid, email text, nombre text, telefono text, role text)
language plpgsql
security definer
as $$
begin
  if not public.is_admin_of(p_company_id) then
    raise exception 'No eres admin de esta empresa';
  end if;
  return query
    select cm.user_id, u.email, u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'phone', cm.role
    from company_members cm
    join auth.users u on u.id = cm.user_id
    where cm.company_id = p_company_id
    order by cm.created_at;
end;
$$;

-- 6. Trigger: asignar al crear contacto sin assigned_to
create or replace function trg_assign_lead()
returns trigger as $$
begin
  if NEW.assigned_to is null then
    NEW.assigned_to := asignar_siguiente_vendedor(NEW.company_id);
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_contacts_assign on contacts;
create trigger trg_contacts_assign
  before insert on contacts
  for each row
  execute function trg_assign_lead();

-- 7. RPC para listar routing con email del usuario (bypass schema cross)
create or replace function listar_routing(p_company_id uuid)
returns table (id uuid, company_id uuid, user_id uuid, email text, orden integer, activo boolean)
language plpgsql
security definer
as $$
begin
  return query
    select lr.id, lr.company_id, lr.user_id, u.email::text, lr.orden, lr.activo
    from lead_routing lr
    left join auth.users u on u.id = lr.user_id
    where lr.company_id = p_company_id
    order by lr.orden;
end;
$$;

-- 8. Vista contactos con email del asignado (RLS heredada via security_invoker)
create or replace view contactos_view with (security_invoker = true) as
select c.*, u.email as assigned_email
from contacts c
left join auth.users u on u.id = c.assigned_to;

-- 9. RPC: agregar miembro a la empresa (admin busca por email)
create or replace function agregar_miembro_por_email(
  p_company_id uuid,
  p_email text,
  p_role text default 'vendedor'
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_existing record;
begin
  if not public.is_admin_of(p_company_id) then
    raise exception 'No eres admin de esta empresa';
  end if;

  select id into v_user_id from auth.users where email = p_email;
  if v_user_id is null then
    raise exception 'No existe un usuario con el correo %', p_email;
  end if;

  select * into v_existing from company_members
    where company_id = p_company_id and user_id = v_user_id;
  if found then
    raise exception 'El usuario ya es miembro de esta empresa';
  end if;

  insert into company_members (company_id, user_id, role)
    values (p_company_id, v_user_id, p_role);

  return jsonb_build_object('user_id', v_user_id, 'email', p_email, 'role', p_role);
end;
$$;

-- 10. RPC: eliminar miembro de la empresa
create or replace function eliminar_miembro(p_company_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if not public.is_admin_of(p_company_id) then
    raise exception 'No eres admin de esta empresa';
  end if;

  delete from company_members
    where company_id = p_company_id and user_id = p_user_id;
end;
$$;

-- 11. RPC para obtener un contacto con asignado + organización (JSONB, security definer)
create or replace function obtener_contacto_con_asignado(p_contact_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'id', c.id, 'company_id', c.company_id, 'organization_id', c.organization_id,
    'name', c.name, 'email', c.email, 'phone', c.phone, 'position', c.position,
    'source', c.source, 'notes', c.notes,
    'assigned_to', case when c.assigned_to is not null then jsonb_build_object('id', c.assigned_to, 'email', u.email) else null end,
    'created_at', c.created_at, 'updated_at', c.updated_at, 'last_activity_at', c.last_activity_at,
    'organization', case when org.id is not null then jsonb_build_object('name', org.name) else null end
  ) into v_result
  from contacts c
  left join auth.users u on u.id = c.assigned_to
  left join organizations org on org.id = c.organization_id
  where c.id = p_contact_id;

  return v_result;
end;
$$;


-- ============================================================
-- agenda-setup.sql
-- ============================================================
-- Daily Agenda: columna assigned_to para activities
alter table activities add column if not exists assigned_to uuid references auth.users(id) on delete set null;

create index if not exists idx_activities_assigned_to on activities(company_id, assigned_to, due_date);


-- ============================================================
-- timeline-setup.sql
-- ============================================================
-- Timeline: trigger para registrar cambios de etapa como actividades
-- Ejecutar en Supabase SQL Editor

-- Función: inserta actividad cuando un deal cambia de etapa
create or replace function log_stage_change()
returns trigger
language plpgsql
security definer
as $$
declare
  v_stage_name text;
begin
  if OLD.stage_id is distinct from NEW.stage_id then
    select name into v_stage_name from stages where id = NEW.stage_id;
    insert into activities (company_id, contact_id, deal_id, type, subject, description, created_by, created_at)
    values (
      NEW.company_id,
      NEW.contact_id,
      NEW.id,
      'note',
      'Cambio de etapa',
      'Oportunidad movida a: ' || coalesce(v_stage_name, 'desconocida'),
      NEW.updated_by,
      NEW.updated_at
    );
  end if;
  return NEW;
end;
$$;

-- Trigger sobre deals
drop trigger if exists trg_deals_stage_change on deals;
create trigger trg_deals_stage_change
  after update of stage_id on deals
  for each row
  execute function log_stage_change();

-- Agregar columna updated_by a deals si no existe (para saber quién movió)
alter table deals add column if not exists updated_by uuid references auth.users(id);


-- ============================================================
-- dashboard-kpi-setup.sql
-- ============================================================
-- Dashboard KPI: columna closed_at para deals ganados
alter table deals add column if not exists closed_at timestamptz;

-- Índice opcional para consultas de rango de fechas
create index if not exists idx_deals_closed_at on deals(company_id, closed_at);
create index if not exists idx_deals_expected_close on deals(company_id, expected_close_date);


-- ============================================================
-- ai-setup.sql
-- ============================================================
-- 5. Actualizar RPC para incluir campos de IA
create or replace function obtener_contacto_con_asignado(p_contact_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'id', c.id, 'company_id', c.company_id, 'organization_id', c.organization_id,
    'name', c.name, 'email', c.email, 'phone', c.phone, 'position', c.position,
    'source', c.source, 'notes', c.notes,
    'assigned_to', case when c.assigned_to is not null then jsonb_build_object('id', c.assigned_to, 'email', u.email) else null end,
    'created_at', c.created_at, 'updated_at', c.updated_at, 'last_activity_at', c.last_activity_at,
    'ai_summary', c.ai_summary, 'summary_updated_at', c.summary_updated_at,
    'score', c.score, 'score_reasoning', c.score_reasoning, 'last_scored_at', c.last_scored_at,
    'organization', case when org.id is not null then jsonb_build_object('name', org.name) else null end
  ) into v_result
  from contacts c
  left join auth.users u on u.id = c.assigned_to
  left join organizations org on org.id = c.organization_id
  where c.id = p_contact_id;

  return v_result;
end;
$$;


-- ============================================================
-- reports-setup.sql
-- ============================================================
-- =============================================================================
-- Reportes / Analytics — RPCs para el módulo de reportes
-- Ejecutar en Supabase SQL Editor
-- =============================================================================

-- 1. Resumen de ventas por etapa
create or replace function obtener_resumen_ventas(p_company_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'stage_id', s.id,
        'stage_name', s.name,
        'color', s.color,
        'probability', s.probability,
        'count', coalesce(d.count, 0),
        'total_value', coalesce(d.total_value, 0)
      ) order by s.position
    ),
    '[]'::jsonb
  )
  into result
  from stages s
  left join (
    select stage_id, count(*) as count, sum(value) as total_value
    from deals
    where company_id = p_company_id
    group by stage_id
  ) d on d.stage_id = s.id
  where s.pipeline_id in (
    select id from pipelines where company_id = p_company_id
  );

  return result;
end;
$$;

-- 2. Ingresos mensuales (deals cerrados ganados, probability = 100)
create or replace function obtener_ingresos_mensuales(p_company_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'year', d.year,
        'month', d.month,
        'total', d.total
      ) order by d.year, d.month
    ),
    '[]'::jsonb
  )
  into result
  from (
    select
      extract(year from updated_at)::int as year,
      extract(month from updated_at)::int as month,
      sum(value) as total
    from deals
    where company_id = p_company_id
      and probability = 100
      and updated_at >= now() - interval '12 months'
    group by year, month
  ) d;

  return result;
end;
$$;

-- 3. Actividades por tipo en un rango de fechas
create or replace function obtener_actividades_por_tipo(
  p_company_id uuid,
  p_desde timestamptz default now() - interval '30 days',
  p_hasta timestamptz default now()
)
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object('type', a.type, 'count', a.count)
    ),
    '[]'::jsonb
  )
  into result
  from (
    select type, count(*) as count
    from activities
    where company_id = p_company_id
      and created_at >= p_desde
      and created_at <= p_hasta
    group by type
    order by count desc
  ) a;

  return result;
end;
$$;

-- 4. Top vendedores por valor de deals (vinculados via contacts.assigned_to)
create or replace function obtener_top_vendedores(p_company_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', t.user_id,
        'email', t.email,
        'nombre', t.nombre,
        'total_deals', t.total_deals,
        'total_value', t.total_value
      ) order by t.total_value desc
    ),
    '[]'::jsonb
  )
  into result
  from (
    select
      u.id as user_id,
      u.email::text,
      u.raw_user_meta_data->>'full_name' as nombre,
      count(d.id)::int as total_deals,
      coalesce(sum(d.value), 0) as total_value
    from auth.users u
    join contacts c on c.assigned_to = u.id
    join deals d on d.contact_id = c.id
    where d.company_id = p_company_id
    group by u.id, u.email, u.raw_user_meta_data
    order by total_value desc
    limit 10
  ) t;

  return result;
end;
$$;

-- 5. Tasa de conversión entre etapas (deals activos por etapa, ordenados por posición)
create or replace function obtener_conversion_etapas(p_company_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'stage_id', s.id,
        'stage_name', s.name,
        'position', s.position,
        'color', s.color,
        'count', coalesce(d.c, 0)
      ) order by s.position
    ),
    '[]'::jsonb
  )
  into result
  from stages s
  left join (
    select stage_id, count(*) as c
    from deals
    where company_id = p_company_id
    group by stage_id
  ) d on d.stage_id = s.id
  where s.pipeline_id in (
    select id from pipelines where company_id = p_company_id
  );

  return result;
end;
$$;

-- 6. Velocidad de ventas (días promedio para ganar/perder/activos)
create or replace function obtener_velocidad_ventas(p_company_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'ganados', coalesce((
      select round(avg(extract(epoch from (closed_at - created_at)) / 86400))::int
      from deals
      where company_id = p_company_id and stage_id in (
        select id from stages where name = 'Cerrado ganado' and pipeline_id in (
          select id from pipelines where company_id = p_company_id
        )
      ) and closed_at is not null
    ), 0),
    'perdidos', coalesce((
      select round(avg(extract(epoch from (closed_at - created_at)) / 86400))::int
      from deals
      where company_id = p_company_id and stage_id in (
        select id from stages where name = 'Cerrado perdido' and pipeline_id in (
          select id from pipelines where company_id = p_company_id
        )
      ) and closed_at is not null
    ), 0),
    'activos', coalesce((
      select round(avg(extract(epoch from (now() - created_at)) / 86400))::int
      from deals
      where company_id = p_company_id and stage_id not in (
        select id from stages where name in ('Cerrado ganado', 'Cerrado perdido') and pipeline_id in (
          select id from pipelines where company_id = p_company_id
        )
      )
    ), 0)
  ) into result;

  return result;
end;
$$;


-- ============================================================
-- push-setup.sql
-- ============================================================
-- Notificaciones Push (PWA)
-- Ejecutar después de crm-setup.sql

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription jsonb not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique(user_id)
);

alter table push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_select" on push_subscriptions;
create policy "push_subscriptions_select" on push_subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "push_subscriptions_insert" on push_subscriptions;
create policy "push_subscriptions_insert" on push_subscriptions for insert
  with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions_delete" on push_subscriptions;
create policy "push_subscriptions_delete" on push_subscriptions for delete
  using (auth.uid() = user_id);


-- ============================================================
-- paises-setup.sql
-- ============================================================
-- Países soportados por el CRM LATAM
-- Ejecutar después de crm-setup.sql

create table if not exists paises (
  codigo text primary key,
  nombre text not null,
  tax_id_label text not null,
  moneda text not null,
  locale text not null default 'es',
  bandera text not null,
  activo boolean not null default true
);

alter table paises enable row level security;

-- Cualquiera puede leer paises (público)
drop policy if exists "paises_select" on paises;
create policy "paises_select" on paises for select
  using (true);

-- Seed data
insert into paises (codigo, nombre, tax_id_label, moneda, locale, bandera) values
  ('PY', 'Paraguay', 'RUC', 'PYG', 'es', '🇵🇾'),
  ('AR', 'Argentina', 'CUIT', 'ARS', 'es', '🇦🇷'),
  ('CL', 'Chile', 'RUT', 'CLP', 'es', '🇨🇱'),
  ('CO', 'Colombia', 'NIT', 'COP', 'es', '🇨🇴'),
  ('PE', 'Perú', 'RUC', 'PEN', 'es', '🇵🇪'),
  ('UY', 'Uruguay', 'RUT', 'UYU', 'es', '🇺🇾'),
  ('BO', 'Bolivia', 'NIT', 'BOB', 'es', '🇧🇴'),
  ('EC', 'Ecuador', 'RUC', 'USD', 'es', '🇪🇨'),
  ('VE', 'Venezuela', 'RIF', 'USD', 'es', '🇻🇪'),
  ('MX', 'México', 'RFC', 'MXN', 'es', '🇲🇽'),
  ('BR', 'Brasil', 'CNPJ', 'BRL', 'pt-BR', '🇧🇷')
on conflict (codigo) do nothing;

-- RPC para listar países activos
create or replace function listar_paises()
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'codigo', p.codigo,
      'nombre', p.nombre,
      'tax_id_label', p.tax_id_label,
      'moneda', p.moneda,
      'locale', p.locale,
      'bandera', p.bandera
    ) order by p.nombre
  ), '[]'::jsonb)
  from paises p
  where p.activo = true;
$$;


-- ============================================================
-- localizacion-setup.sql
-- ============================================================
-- Localización por país para CRM LATAM
-- Ejecutar después de crm-setup.sql

-- 1. Agregar columna pais a companies
alter table companies add column if not exists pais text not null default 'PY';

-- 2. Actualizar función crear_empresa_crm para aceptar pais
create or replace function public.crear_empresa_crm(
  empresa_nombre text,
  p_user_id uuid default auth.uid(),
  p_rif text default null,
  p_pais text default 'PY'
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_company_id uuid;
  v_pipeline_id uuid;
  v_user_id uuid;
begin
  v_user_id := coalesce(p_user_id, auth.uid());
  if v_user_id is null then
    raise exception 'No se puede identificar al usuario. Registrate primero.';
  end if;
  insert into companies (name, rif, pais) values (empresa_nombre, p_rif, p_pais)
    returning id into v_company_id;
  insert into company_members (company_id, user_id, role)
    values (v_company_id, v_user_id, 'admin');
  insert into company_config (company_id, app_name)
    values (v_company_id, empresa_nombre);
  insert into pipelines (company_id, name, description)
    values (v_company_id, 'Pipeline por defecto', 'Pipeline principal de ventas')
    returning id into v_pipeline_id;
  insert into stages (pipeline_id, name, position, probability, color) values
    (v_pipeline_id, 'Nuevo',           0, 10,  '#6366f1'),
    (v_pipeline_id, 'Contactado',      1, 25,  '#3b82f6'),
    (v_pipeline_id, 'Propuesta',       2, 50,  '#f59e0b'),
    (v_pipeline_id, 'Negociación',     3, 75,  '#f97316'),
    (v_pipeline_id, 'Cerrado ganado',  4, 100, '#22c55e'),
    (v_pipeline_id, 'Cerrado perdido', 5, 0,   '#ef4444');
  insert into webhook_tokens (company_id, token)
  values (v_company_id, gen_random_uuid());
  return v_company_id;
end;
$$;

-- [NO ENCONTRADO] moneda-setup.sql

-- ============================================================
-- perfil-empresa-setup.sql
-- ============================================================
-- Perfil de empresa para CRM LATAM
-- Agrega campos de contacto/dirección a la tabla companies
-- Ejecutar después de crm-setup.sql y localizacion-setup.sql

alter table companies add column if not exists direccion text;
alter table companies add column if not exists telefono text;
alter table companies add column if not exists email_empresa text;
alter table companies add column if not exists logo_url text;

-- Facturación electrónica (e-kuatia/SIFEN)
alter table companies add column if not exists ruc_factura text;
alter table companies add column if not exists dv_factura text;
alter table companies add column if not exists timbrado text;
alter table companies add column if not exists establecimiento text;
alter table companies add column if not exists punto_expedicion text;
alter table companies add column if not exists csc text;
alter table companies add column if not exists id_csc text;
alter table companies add column if not exists actividad_economica text;
alter table companies add column if not exists des_actividad_economica text;


-- ============================================================
-- empresa-rpc-setup.sql
-- ============================================================
-- RPC para actualizar perfil de empresa (bypass RLS con security definer)

alter table companies add column if not exists payment_terms_days integer not null default 30;

create or replace function actualizar_empresa(p_company_id uuid, p_data jsonb)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_admin boolean;
  v_result jsonb;
begin
  -- Verificar admin
  select exists (
    select 1 from public.company_members
    where company_id = p_company_id and user_id = auth.uid() and role = 'admin'
  ) into v_admin;

  if not v_admin then
    return jsonb_build_object('error', 'No eres administrador de esta empresa', 'user_id', auth.uid());
  end if;

  -- Actualizar
  update companies
  set
    name = coalesce(p_data->>'name', name),
    rif = coalesce(p_data->>'rif', rif),
    pais = coalesce(p_data->>'pais', pais),
    direccion = coalesce(p_data->>'direccion', direccion),
    telefono = coalesce(p_data->>'telefono', telefono),
    email_empresa = coalesce(p_data->>'email_empresa', email_empresa),
    ruc_factura = coalesce(p_data->>'ruc_factura', ruc_factura),
    dv_factura = coalesce(p_data->>'dv_factura', dv_factura),
    timbrado = coalesce(p_data->>'timbrado', timbrado),
    establecimiento = coalesce(p_data->>'establecimiento', establecimiento),
    punto_expedicion = coalesce(p_data->>'punto_expedicion', punto_expedicion),
    csc = coalesce(p_data->>'csc', csc),
    id_csc = coalesce(p_data->>'id_csc', id_csc),
    actividad_economica = coalesce(p_data->>'actividad_economica', actividad_economica),
    des_actividad_economica = coalesce(p_data->>'des_actividad_economica', des_actividad_economica),
    payment_terms_days = coalesce((p_data->>'payment_terms_days')::integer, payment_terms_days)
  where id = p_company_id;

  return jsonb_build_object('ok', true);
end;
$$;


-- ============================================================
-- actividades-setup.sql
-- ============================================================
-- Actividades económicas para facturación electrónica SIFEN
-- Basado en clasificación MIC Paraguay

create table if not exists actividades_economicas (
  codigo text primary key,
  descripcion text not null,
  activo boolean not null default true
);

alter table actividades_economicas enable row level security;

drop policy if exists "actividades_select" on actividades_economicas;
create policy "actividades_select" on actividades_economicas for select
  using (true);

-- Seed data
insert into actividades_economicas (codigo, descripcion) values
  ('01111', 'Cultivo de cereales'),
  ('01112', 'Cultivo de oleaginosas'),
  ('01211', 'Cultivo de hortalizas'),
  ('47211', 'Venta al por menor de alimentos'),
  ('47110', 'Comercio al por menor en supermercados'),
  ('46510', 'Comercio al por mayor de equipos informáticos'),
  ('46530', 'Comercio al por mayor de máquinas y herramientas'),
  ('47411', 'Comercio al por menor de computadoras'),
  ('47521', 'Comercio al por menor de ferretería'),
  ('47611', 'Comercio al por menor de libros'),
  ('47711', 'Comercio al por menor de prendas de vestir'),
  ('55101', 'Hoteles y alojamiento'),
  ('56101', 'Restaurantes'),
  ('62010', 'Consultoría informática'),
  ('62020', 'Desarrollo de software'),
  ('63110', 'Procesamiento de datos'),
  ('68200', 'Alquiler de bienes inmuebles'),
  ('69200', 'Servicios contables y auditoría'),
  ('70200', 'Consultoría de gestión empresarial'),
  ('71100', 'Servicios de arquitectura e ingeniería'),
  ('73100', 'Publicidad'),
  ('74900', 'Servicios profesionales y técnicos'),
  ('74901', 'Servicios de asesoramiento empresarial'),
  ('79110', 'Agencias de viajes'),
  ('80100', 'Servicios de seguridad privada'),
  ('81210', 'Limpieza general de edificios'),
  ('82190', 'Servicios administrativos'),
  ('85100', 'Enseñanza preescolar'),
  ('85210', 'Enseñanza secundaria'),
  ('85300', 'Enseñanza superior'),
  ('85400', 'Enseñanza cultural y deportiva'),
  ('85500', 'Enseñanza de idiomas'),
  ('86100', 'Servicios hospitalarios'),
  ('86210', 'Servicios médicos generales'),
  ('86220', 'Servicios odontológicos'),
  ('86901', 'Servicios de salud humana'),
  ('93110', 'Clubes deportivos'),
  ('95110', 'Reparación de computadoras'),
  ('96030', 'Servicios funerarios'),
  ('96090', 'Servicios personales')
on conflict (codigo) do nothing;

-- RPC para listar actividades activas
create or replace function listar_actividades_economicas()
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object('codigo', a.codigo, 'descripcion', a.descripcion)
    order by a.codigo
  ), '[]'::jsonb)
  from actividades_economicas a
  where a.activo = true;
$$;


-- ============================================================
-- plan-limites-setup.sql
-- ============================================================
-- Plan de límites por suscripción
-- Ejecutar después de crm-setup.sql

-- 1. Features por plan (módulos habilitados/deshabilitados)
create table if not exists plan_features (
  plan text not null,
  feature_key text not null,
  enabled boolean not null default false,
  primary key (plan, feature_key)
);

-- 2. Cuotas numéricas por plan
create table if not exists plan_quotas (
  plan text not null,
  quota_key text not null,
  max_value integer not null default 0,
  primary key (plan, quota_key)
);

-- RLS
alter table plan_features enable row level security;
alter table plan_quotas enable row level security;

drop policy if exists "plan_features_select" on plan_features;
create policy "plan_features_select" on plan_features for select using (true);
drop policy if exists "plan_quotas_select" on plan_quotas;
create policy "plan_quotas_select" on plan_quotas for select using (true);

-- 3. Seed data — Features por plan
insert into plan_features (plan, feature_key, enabled) values
  -- Free
  ('free', 'catalogo', true),
  ('free', 'crm', true),
  ('free', 'facturacion', true),
  ('free', 'notas_cd', false),
  ('free', 'srm', false),
  ('free', 'inventario', false),
  ('free', 'contabilidad', false),
  ('free', 'contabilidad_avanzada', false),
  ('free', 'asientos_automaticos_facturas', false),
  ('free', 'asientos_automaticos_nomina', false),
  ('free', 'rrhh', false),
  ('free', 'nomina', false),
  ('free', 'whatsapp', false),
  ('free', 'reportes', false),
  ('free', 'reportes_avanzados', false),
  -- Starter
  ('starter', 'catalogo', true),
  ('starter', 'crm', true),
  ('starter', 'facturacion', true),
  ('starter', 'notas_cd', true),
  ('starter', 'srm', true),
  ('starter', 'inventario', true),
  ('starter', 'contabilidad', true),
  ('starter', 'contabilidad_avanzada', false),
  ('starter', 'asientos_automaticos_facturas', true),
  ('starter', 'asientos_automaticos_nomina', false),
  ('starter', 'rrhh', false),
  ('starter', 'nomina', false),
  ('starter', 'whatsapp', false),
  ('starter', 'reportes', true),
  ('starter', 'reportes_avanzados', false),
  -- Business
  ('business', 'catalogo', true),
  ('business', 'crm', true),
  ('business', 'facturacion', true),
  ('business', 'notas_cd', true),
  ('business', 'srm', true),
  ('business', 'inventario', true),
  ('business', 'contabilidad', false),
  ('business', 'contabilidad_avanzada', true),
  ('business', 'asientos_automaticos_facturas', true),
  ('business', 'asientos_automaticos_nomina', true),
  ('business', 'rrhh', true),
  ('business', 'nomina', true),
  ('business', 'whatsapp', true),
  ('business', 'reportes', false),
  ('business', 'reportes_avanzados', true)
on conflict (plan, feature_key) do nothing;

-- 4. Seed data — Cuotas por plan
insert into plan_quotas (plan, quota_key, max_value) values
  ('free', 'usuarios', 2),
  ('free', 'productos', 50),
  ('free', 'contactos', 100),
  ('free', 'oportunidades', 50),
  ('free', 'facturas_mes', 50),
  ('starter', 'usuarios', 10),
  ('starter', 'productos', -1),
  ('starter', 'contactos', -1),
  ('starter', 'oportunidades', -1),
  ('starter', 'facturas_mes', -1),
  ('business', 'usuarios', -1),
  ('business', 'productos', -1),
  ('business', 'contactos', -1),
  ('business', 'oportunidades', -1),
  ('business', 'facturas_mes', -1)
on conflict (plan, quota_key) do nothing;

-- 5. Función helper: verificar si una feature está habilitada para una empresa
create or replace function check_feature_enabled(p_company_id uuid, p_feature_key text)
returns boolean
language plpgsql
security definer
stable
as $$
declare
  v_plan text;
  v_enabled boolean;
begin
  select plan into v_plan from companies where id = p_company_id;
  if v_plan is null then return false; end if;
  select enabled into v_enabled from plan_features where plan = v_plan and feature_key = p_feature_key;
  return coalesce(v_enabled, false);
end;
$$;

-- 6. Función helper: verificar cuota disponible para una empresa
create or replace function check_quota(p_company_id uuid, p_quota_key text)
returns jsonb
language plpgsql
security definer
stable
as $$
declare
  v_plan text;
  v_max integer;
  v_current integer := 0;
begin
  select plan into v_plan from companies where id = p_company_id;
  if v_plan is null then
    return jsonb_build_object('current', 0, 'max', 0, 'remaining', 0);
  end if;

  select max_value into v_max from plan_quotas where plan = v_plan and quota_key = p_quota_key;
  if v_max is null then
    return jsonb_build_object('current', 0, 'max', 0, 'remaining', 0);
  end if;

  -- -1 significa ilimitado
  if v_max = -1 then
    return jsonb_build_object('current', 0, 'max', -1, 'remaining', -1);
  end if;

  -- Contar registros actuales según la cuota
  if p_quota_key = 'usuarios' then
    select count(*) into v_current from company_members where company_id = p_company_id;
  elsif p_quota_key = 'productos' then
    select count(*) into v_current from catalogo_productos where company_id = p_company_id;
  elsif p_quota_key = 'contactos' then
    select count(*) into v_current from contacts where company_id = p_company_id;
  elsif p_quota_key = 'oportunidades' then
    select count(*) into v_current from deals where company_id = p_company_id;
  elsif p_quota_key = 'facturas_mes' then
    select count(*) into v_current
    from facturas
    where company_id = p_company_id
      and date_trunc('month', created_at) = date_trunc('month', now());
  end if;

  return jsonb_build_object('current', v_current, 'max', v_max, 'remaining', greatest(v_max - v_current, 0));
end;
$$;

-- 7. Dar permisos
grant usage on schema public to supabase_auth_admin;
grant execute on function check_feature_enabled(uuid, text) to supabase_auth_admin;
grant execute on function check_quota(uuid, text) to supabase_auth_admin;
grant select on plan_features to supabase_auth_admin;
grant select on plan_quotas to supabase_auth_admin;


-- ============================================================
-- catalogo-setup.sql
-- ============================================================
-- Catálogo de productos/servicios
-- Ejecutar después de crm-setup.sql

create table if not exists catalogo_productos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  codigo text,
  nombre text not null,
  descripcion text,
  precio_venta numeric(12,2) not null default 0,
  precio_compra numeric(12,2) not null default 0,
  moneda text not null default 'PYG',
  unidad_medida text default 'UNI',
  cod_unidad int default 77,
  activo boolean not null default true,
  tipo text not null default 'producto' check (tipo in ('producto', 'servicio')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table catalogo_productos enable row level security;

drop policy if exists "catalogo_select" on catalogo_productos;
create policy "catalogo_select" on catalogo_productos for select
  using (public.is_member_of(company_id));

drop policy if exists "catalogo_insert" on catalogo_productos;
create policy "catalogo_insert" on catalogo_productos for insert
  with check (public.is_member_of(company_id));

drop policy if exists "catalogo_update" on catalogo_productos;
create policy "catalogo_update" on catalogo_productos for update
  using (public.is_member_of(company_id));

drop policy if exists "catalogo_delete" on catalogo_productos;
create policy "catalogo_delete" on catalogo_productos for delete
  using (public.is_member_of(company_id));

create index if not exists idx_catalogo_company on catalogo_productos(company_id, nombre);


-- ============================================================
-- unidades-setup.sql
-- ============================================================
-- Unidades de medida para productos/servicios
-- Basado en codificación SIFEN (TABLA 5)

create table if not exists unidades_medida (
  codigo int primary key,
  sigla text not null,
  nombre text not null,
  activo boolean not null default true
);

alter table unidades_medida enable row level security;

drop policy if exists "unidades_medida_select" on unidades_medida;
create policy "unidades_medida_select" on unidades_medida for select
  using (true);

-- Seed data
insert into unidades_medida (codigo, sigla, nombre) values
  (1, 'KG', 'Kilogramo'),
  (2, 'GR', 'Gramo'),
  (3, 'LT', 'Litro'),
  (4, 'ML', 'Mililitro'),
  (5, 'M', 'Metro'),
  (6, 'M2', 'Metro cuadrado'),
  (7, 'M3', 'Metro cúbico'),
  (8, 'CM', 'Centímetro'),
  (9, 'UNI', 'Unidad'),
  (10, 'PAR', 'Par'),
  (11, 'DOC', 'Docena'),
  (12, 'CAJ', 'Caja'),
  (13, 'PAQ', 'Paquete'),
  (14, 'BOL', 'Bolsa'),
  (15, 'TAR', 'Tarjeta'),
  (16, 'KIT', 'Kit'),
  (17, 'HR', 'Hora'),
  (18, 'DIA', 'Día'),
  (19, 'MES', 'Mes'),
  (20, 'SER', 'Servicio'),
  (21, 'CON', 'Consultoría'),
  (22, 'PRO', 'Proyecto'),
  (23, 'LTS', 'Lote'),
  (24, 'CIL', 'Cilindro'),
  (25, 'TON', 'Tonelada')
on conflict (codigo) do nothing;

-- RPC
create or replace function listar_unidades_medida()
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object('codigo', u.codigo, 'sigla', u.sigla, 'nombre', u.nombre)
    order by u.sigla
  ), '[]'::jsonb)
  from unidades_medida u
  where u.activo = true;
$$;


-- ============================================================
-- categorias-setup.sql
-- ============================================================
-- Categorías de productos/servicios
-- Ejecutar después de catalogo-setup.sql

create table if not exists categorias (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  nombre text not null,
  tipo text not null check (tipo in ('producto', 'servicio')),
  parent_id uuid references categorias(id) on delete cascade,
  color text not null default '#6366f1',
  icono text not null default '📦',
  unique(company_id, tipo, nombre)
);

alter table catalogo_productos add column if not exists categoria_id uuid references categorias(id) on delete set null;
alter table catalogo_productos alter column tipo set default 'producto';

alter table categorias enable row level security;
drop policy if exists "categorias_select" on categorias;
create policy "categorias_select" on categorias for select using (public.is_member_of(company_id));
drop policy if exists "categorias_insert" on categorias;
create policy "categorias_insert" on categorias for insert with check (public.is_member_of(company_id));
drop policy if exists "categorias_update" on categorias;
create policy "categorias_update" on categorias for update using (public.is_member_of(company_id));
drop policy if exists "categorias_delete" on categorias;
create policy "categorias_delete" on categorias for delete using (public.is_member_of(company_id));


-- ============================================================
-- precio-compra-venta-setup.sql
-- ============================================================
-- Migración: precio de compra y venta en catálogo
-- Ejecutar después de catalogo-setup.sql

-- 1. Renombrar precio_unitario a precio_venta
alter table catalogo_productos rename column precio_unitario to precio_venta;

-- 2. Agregar precio_compra
alter table catalogo_productos add column if not exists precio_compra numeric(12,2) not null default 0;

-- 3. Inicializar precio_compra con el mismo valor que precio_venta (para no romper datos existentes)
update catalogo_productos set precio_compra = precio_venta where precio_compra = 0;


-- ============================================================
-- srm-setup.sql
-- ============================================================
-- SRM — Supplier Relationship Management
-- Ejecutar después de crm-setup.sql y catalogo-setup.sql

-- 1. Proveedores
create table if not exists proveedores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  nombre text not null,
  ruc text,
  email text,
  telefono text,
  direccion text,
  sitio_web text,
  categoria text,
  estado text not null default 'activo' check (estado in ('activo', 'inactivo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table proveedores enable row level security;

drop policy if exists "proveedores_select" on proveedores;
create policy "proveedores_select" on proveedores for select using (public.is_member_of(company_id));
drop policy if exists "proveedores_insert" on proveedores;
create policy "proveedores_insert" on proveedores for insert with check (public.is_member_of(company_id));
drop policy if exists "proveedores_update" on proveedores;
create policy "proveedores_update" on proveedores for update using (public.is_member_of(company_id));
drop policy if exists "proveedores_delete" on proveedores;
create policy "proveedores_delete" on proveedores for delete using (public.is_member_of(company_id));

create index if not exists idx_proveedores_company on proveedores(company_id, nombre);

-- 2. Precios de productos por proveedor
create table if not exists proveedor_productos (
  proveedor_id uuid not null references proveedores(id) on delete cascade,
  producto_id uuid not null references catalogo_productos(id) on delete cascade,
  precio_proveedor numeric(12,2) default 0,
  moneda text default 'PYG',
  created_at timestamptz not null default now(),
  primary key (proveedor_id, producto_id)
);

alter table proveedor_productos enable row level security;
drop policy if exists "proveedor_productos_select" on proveedor_productos;
create policy "proveedor_productos_select" on proveedor_productos for select
  using (exists (select 1 from proveedores p where p.id = proveedor_id and public.is_member_of(p.company_id)));
drop policy if exists "proveedor_productos_insert" on proveedor_productos;
create policy "proveedor_productos_insert" on proveedor_productos for insert
  with check (exists (select 1 from proveedores p where p.id = proveedor_id and public.is_member_of(p.company_id)));
drop policy if exists "proveedor_productos_delete" on proveedor_productos;
create policy "proveedor_productos_delete" on proveedor_productos for delete
  using (exists (select 1 from proveedores p where p.id = proveedor_id and public.is_member_of(p.company_id)));

-- 3. Órdenes de compra
create table if not exists ordenes_compra (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  proveedor_id uuid not null references proveedores(id),
  numero text not null,
  fecha_emision timestamptz not null default now(),
  fecha_entrega_estimada date,
  estado text not null default 'borrador'
    check (estado in ('borrador', 'enviada', 'confirmada', 'recibida', 'cancelada')),
  subtotal numeric(12,2) not null default 0,
  impuesto numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  moneda text not null default 'PYG',
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table ordenes_compra enable row level security;
drop policy if exists "ordenes_compra_select" on ordenes_compra;
create policy "ordenes_compra_select" on ordenes_compra for select using (public.is_member_of(company_id));
drop policy if exists "ordenes_compra_insert" on ordenes_compra;
create policy "ordenes_compra_insert" on ordenes_compra for insert with check (public.is_member_of(company_id));
drop policy if exists "ordenes_compra_update" on ordenes_compra;
create policy "ordenes_compra_update" on ordenes_compra for update using (public.is_member_of(company_id));
drop policy if exists "ordenes_compra_delete" on ordenes_compra;
create policy "ordenes_compra_delete" on ordenes_compra for delete using (public.is_member_of(company_id));

create index if not exists idx_ordenes_compra_company on ordenes_compra(company_id, created_at desc);

-- 4. Items de orden de compra
create table if not exists orden_compra_items (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references ordenes_compra(id) on delete cascade,
  producto_id uuid not null references catalogo_productos(id),
  descripcion text,
  cantidad numeric(12,2) not null default 1,
  precio_unitario numeric(12,2) not null default 0,
  subtotal numeric(12,2) not null default 0,
  cantidad_recibida numeric(12,2) not null default 0
);

alter table orden_compra_items enable row level security;
drop policy if exists "orden_compra_items_select" on orden_compra_items;
create policy "orden_compra_items_select" on orden_compra_items for select
  using (exists (select 1 from ordenes_compra o where o.id = orden_id and public.is_member_of(o.company_id)));
drop policy if exists "orden_compra_items_insert" on orden_compra_items;
create policy "orden_compra_items_insert" on orden_compra_items for insert
  with check (exists (select 1 from ordenes_compra o where o.id = orden_id and public.is_member_of(o.company_id)));
drop policy if exists "orden_compra_items_delete" on orden_compra_items;
create policy "orden_compra_items_delete" on orden_compra_items for delete
  using (exists (select 1 from ordenes_compra o where o.id = orden_id and public.is_member_of(o.company_id)));
drop policy if exists "orden_compra_items_update" on orden_compra_items;
create policy "orden_compra_items_update" on orden_compra_items for update
  using (exists (select 1 from ordenes_compra o where o.id = orden_id and public.is_member_of(o.company_id)));

-- 5. Recepciones
create table if not exists recepciones (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  orden_id uuid references ordenes_compra(id) on delete set null,
  proveedor_id uuid not null references proveedores(id),
  fecha_recepcion timestamptz not null default now(),
  observaciones text,
  created_at timestamptz not null default now()
);

alter table recepciones enable row level security;
drop policy if exists "recepciones_select" on recepciones;
create policy "recepciones_select" on recepciones for select using (public.is_member_of(company_id));
drop policy if exists "recepciones_insert" on recepciones;
create policy "recepciones_insert" on recepciones for insert with check (public.is_member_of(company_id));
drop policy if exists "recepciones_delete" on recepciones;
create policy "recepciones_delete" on recepciones for delete using (public.is_member_of(company_id));

-- 6. Items recibidos
create table if not exists recepcion_items (
  id uuid primary key default gen_random_uuid(),
  recepcion_id uuid not null references recepciones(id) on delete cascade,
  producto_id uuid not null references catalogo_productos(id),
  cantidad_recibida numeric(12,2) not null,
  lote text,
  fecha_vencimiento date
);

alter table recepcion_items enable row level security;
drop policy if exists "recepcion_items_select" on recepcion_items;
create policy "recepcion_items_select" on recepcion_items for select
  using (exists (select 1 from recepciones r where r.id = recepcion_id and public.is_member_of(r.company_id)));
drop policy if exists "recepcion_items_insert" on recepcion_items;
create policy "recepcion_items_insert" on recepcion_items for insert
  with check (exists (select 1 from recepciones r where r.id = recepcion_id and public.is_member_of(r.company_id)));

-- 7. Evaluaciones de proveedores
create table if not exists evaluacion_proveedores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  proveedor_id uuid not null references proveedores(id),
  puntaje integer not null check (puntaje between 1 and 5),
  comentario text,
  evaluado_por uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table evaluacion_proveedores enable row level security;
drop policy if exists "evaluacion_proveedores_select" on evaluacion_proveedores;
create policy "evaluacion_proveedores_select" on evaluacion_proveedores for select using (public.is_member_of(company_id));
drop policy if exists "evaluacion_proveedores_insert" on evaluacion_proveedores;
create policy "evaluacion_proveedores_insert" on evaluacion_proveedores for insert with check (public.is_member_of(company_id));
drop policy if exists "evaluacion_proveedores_delete" on evaluacion_proveedores;
create policy "evaluacion_proveedores_delete" on evaluacion_proveedores for delete using (public.is_member_of(company_id));

create index if not exists idx_evaluacion_proveedor on evaluacion_proveedores(proveedor_id);


-- ============================================================
-- sugerencias-oc-setup.sql
-- ============================================================
-- Sugerencias de compra: stock bajo + proveedores
-- Ejecutar después de srm-setup.sql e inventario-setup.sql

create or replace function productos_stock_bajo_con_proveedores(p_company_id uuid)
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'producto_id', cp.id,
      'producto_nombre', cp.nombre,
      'producto_codigo', cp.codigo,
      'unidad_medida', cp.unidad_medida,
      'stock_total', coalesce((
        select sum(ps.cantidad) from producto_stock ps
        where ps.producto_id = cp.id and ps.company_id = p_company_id
      ), 0),
      'stock_minimo', coalesce(cp.stock_minimo, 0),
      'proveedores', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'proveedor_id', pp.proveedor_id,
            'proveedor_nombre', pv.nombre,
            'precio', pp.precio_proveedor,
            'moneda', pp.moneda
          ) order by pp.precio_proveedor
        ), '[]'::jsonb)
        from proveedor_productos pp
        join proveedores pv on pv.id = pp.proveedor_id
        where pp.producto_id = cp.id
          and pv.company_id = p_company_id
          and pv.estado = 'activo'
      )
    ) order by cp.nombre
  ), '[]'::jsonb)
  from catalogo_productos cp
  where cp.company_id = p_company_id
    and cp.activo = true
    and cp.stock_minimo > 0
    and (
      select coalesce(sum(ps.cantidad), 0)
      from producto_stock ps
      where ps.producto_id = cp.id and ps.company_id = p_company_id
    ) <= cp.stock_minimo
$$;


-- ============================================================
-- pagos-setup.sql
-- ============================================================
-- Calendario de pagos (cuentas por pagar)
-- Ejecutar después de srm-setup.sql

create or replace function obtener_calendario_pagos(p_company_id uuid)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'resumen', jsonb_build_object(
      'vencidas', coalesce((select sum(total) from ordenes_compra where company_id = p_company_id and estado in ('confirmada', 'recibida') and fecha_entrega_estimada < now()::date), 0),
      'dias7', coalesce((select sum(total) from ordenes_compra where company_id = p_company_id and estado in ('confirmada', 'recibida') and fecha_entrega_estimada between now()::date and now()::date + interval '7 days'), 0),
      'dias15', coalesce((select sum(total) from ordenes_compra where company_id = p_company_id and estado in ('confirmada', 'recibida') and fecha_entrega_estimada between now()::date + interval '8 days' and now()::date + interval '15 days'), 0),
      'dias30', coalesce((select sum(total) from ordenes_compra where company_id = p_company_id and estado in ('confirmada', 'recibida') and fecha_entrega_estimada between now()::date + interval '16 days' and now()::date + interval '30 days'), 0)
    ),
    'ordenes', coalesce(jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'numero', o.numero,
        'total', o.total,
        'moneda', o.moneda,
        'fecha_vencimiento', o.fecha_entrega_estimada,
        'dias_restantes', (o.fecha_entrega_estimada - now()::date)::int,
        'estado', o.estado,
        'proveedor', jsonb_build_object('nombre', p.nombre, 'id', p.id)
      ) order by o.fecha_entrega_estimada
    ) filter (where o.estado in ('confirmada', 'recibida')), '[]'::jsonb)
  )
  from ordenes_compra o
  join proveedores p on p.id = o.proveedor_id
  where o.company_id = p_company_id
  limit 1;
$$;


-- ============================================================
-- taxes-setup.sql
-- ============================================================
-- Motor de impuestos LATAM (@saas/accounting)
-- Extraído de accounting-setup.sql para resolver orden de dependencias

-- Grupos de impuestos (IVA, Retención, etc.)
create table if not exists tax_groups (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  type text not null check (type in ('debito_fiscal', 'credito_fiscal', 'retencion_compra', 'retencion_venta')),
  created_at timestamptz not null default now()
);

create index if not exists idx_tax_groups_company on tax_groups(company_id);

-- Impuestos específicos (IVA 10%, Ret. Renta 1%, etc.)
create table if not exists taxes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  tax_group_id uuid not null references tax_groups(id) on delete cascade,
  name text not null,
  percentage numeric(5,2) not null,
  is_withholding boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_taxes_company on taxes(company_id);

-- Líneas de impuestos aplicadas a facturas (polimórfico)
create table if not exists invoice_tax_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  invoice_type text not null check (invoice_type in ('proveedor', 'cliente')),
  invoice_id uuid not null,
  tax_id uuid not null references taxes(id),
  base_amount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_invoice_tax_lines_invoice on invoice_tax_lines(invoice_type, invoice_id);

-- Columna para vincular impuestos a items específicos de la factura
alter table invoice_tax_lines add column if not exists item_id uuid;
create index if not exists idx_invoice_tax_lines_item on invoice_tax_lines(item_id);

-- RLS
alter table tax_groups enable row level security;
alter table taxes enable row level security;
alter table invoice_tax_lines enable row level security;

drop policy if exists "tax_groups_select" on tax_groups;
create policy "tax_groups_select" on tax_groups for select using (public.is_member_of(company_id));
drop policy if exists "tax_groups_insert" on tax_groups;
create policy "tax_groups_insert" on tax_groups for insert with check (public.is_member_of(company_id));
drop policy if exists "tax_groups_update" on tax_groups;
create policy "tax_groups_update" on tax_groups for update using (public.is_member_of(company_id));
drop policy if exists "tax_groups_delete" on tax_groups;
create policy "tax_groups_delete" on tax_groups for delete using (public.is_member_of(company_id));

drop policy if exists "taxes_select" on taxes;
create policy "taxes_select" on taxes for select using (public.is_member_of(company_id));
drop policy if exists "taxes_insert" on taxes;
create policy "taxes_insert" on taxes for insert with check (public.is_member_of(company_id));
drop policy if exists "taxes_update" on taxes;
create policy "taxes_update" on taxes for update using (public.is_member_of(company_id));
drop policy if exists "taxes_delete" on taxes;
create policy "taxes_delete" on taxes for delete using (public.is_member_of(company_id));

drop policy if exists "invoice_tax_lines_select" on invoice_tax_lines;
create policy "invoice_tax_lines_select" on invoice_tax_lines for select using (public.is_member_of(company_id));
drop policy if exists "invoice_tax_lines_insert" on invoice_tax_lines;
create policy "invoice_tax_lines_insert" on invoice_tax_lines for insert with check (public.is_member_of(company_id));
drop policy if exists "invoice_tax_lines_delete" on invoice_tax_lines;
create policy "invoice_tax_lines_delete" on invoice_tax_lines for delete using (public.is_member_of(company_id));


-- ============================================================
-- accounts-setup.sql
-- ============================================================
-- Plan de Cuentas y Asientos Contables (core)
-- Extraído de accounting-setup.sql para resolver orden de dependencias
-- Ejecutar ANTES de cotizaciones-setup.sql (que referencia accounts)

-- ============================================================
-- Plan de Cuentas (@saas/accounting — Fase 2)
-- ============================================================

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  parent_id uuid references accounts(id) on delete set null,
  code text not null,
  name text not null,
  type text not null check (type in ('activo', 'pasivo', 'patrimonio', 'ingreso', 'costo', 'gasto')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, code)
);

create index if not exists idx_accounts_company on accounts(company_id);
create index if not exists idx_accounts_parent on accounts(parent_id);

alter table accounts enable row level security;
drop policy if exists "accounts_select" on accounts;
create policy "accounts_select" on accounts for select using (public.is_member_of(company_id));
drop policy if exists "accounts_insert" on accounts;
create policy "accounts_insert" on accounts for insert with check (public.is_member_of(company_id));
drop policy if exists "accounts_update" on accounts;
create policy "accounts_update" on accounts for update using (public.is_member_of(company_id));
drop policy if exists "accounts_delete" on accounts;
create policy "accounts_delete" on accounts for delete using (public.is_member_of(company_id));

-- Vincular impuestos a cuentas contables
alter table taxes add column if not exists account_id uuid references accounts(id) on delete set null;

-- Cuentas contables para productos (compra/venta)
alter table catalogo_productos add column if not exists account_compra_id uuid references accounts(id) on delete set null;
alter table catalogo_productos add column if not exists account_venta_id uuid references accounts(id) on delete set null;

-- ============================================================
-- Asientos Contables (@saas/accounting — Fase 3)
-- ============================================================

create table if not exists journal_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  entry_number text not null,
  entry_date date not null default now(),
  description text,
  source_type text not null check (source_type in ('factura_proveedor', 'factura_cliente', 'pago_proveedor', 'pago_cliente', 'manual')),
  source_id uuid,
  total_debit numeric(12,2) not null default 0,
  total_credit numeric(12,2) not null default 0,
  estado text not null default 'borrador' check (estado in ('borrador', 'contabilizado', 'anulado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_journal_entries_company on journal_entries(company_id);

create table if not exists journal_entry_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references journal_entries(id) on delete cascade,
  account_id uuid not null references accounts(id),
  description text,
  debit numeric(12,2) not null default 0,
  credit numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_journal_entry_lines_entry on journal_entry_lines(journal_entry_id);

-- RLS
alter table journal_entries enable row level security;
alter table journal_entry_lines enable row level security;

drop policy if exists "journal_entries_select" on journal_entries;
create policy "journal_entries_select" on journal_entries for select using (public.is_member_of(company_id));
drop policy if exists "journal_entries_insert" on journal_entries;
create policy "journal_entries_insert" on journal_entries for insert with check (public.is_member_of(company_id));
drop policy if exists "journal_entries_update" on journal_entries;
create policy "journal_entries_update" on journal_entries for update using (public.is_member_of(company_id));
drop policy if exists "journal_entries_delete" on journal_entries;
create policy "journal_entries_delete" on journal_entries for delete using (public.is_member_of(company_id));

drop policy if exists "journal_entry_lines_select" on journal_entry_lines;
create policy "journal_entry_lines_select" on journal_entry_lines for select using (exists (select 1 from journal_entries je where je.id = journal_entry_id and public.is_member_of(je.company_id)));
drop policy if exists "journal_entry_lines_insert" on journal_entry_lines;
create policy "journal_entry_lines_insert" on journal_entry_lines for insert with check (exists (select 1 from journal_entries je where je.id = journal_entry_id and public.is_member_of(je.company_id)));
drop policy if exists "journal_entry_lines_delete" on journal_entry_lines;
create policy "journal_entry_lines_delete" on journal_entry_lines for delete using (exists (select 1 from journal_entries je where je.id = journal_entry_id and public.is_member_of(je.company_id)));


-- ============================================================
-- cotizaciones-setup.sql
-- ============================================================
-- Cotizaciones / Proformas para CRM LATAM
-- Ejecutar después de crm-setup.sql

-- 1. Tabla de cotizaciones
create table if not exists cotizaciones (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  deal_id uuid references deals(id) on delete set null,
  numero text not null,
  moneda text not null default 'PYG',
  subtotal numeric(12,2) not null default 0,
  impuesto numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  notas text,
  estado text not null default 'borrador'
    check (estado in ('borrador', 'enviada', 'aceptada', 'rechazada', 'facturada', 'cobrada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table cotizaciones enable row level security;

drop policy if exists "cotizaciones_select" on cotizaciones;
create policy "cotizaciones_select" on cotizaciones for select
  using (public.is_member_of(company_id));

drop policy if exists "cotizaciones_insert" on cotizaciones;
create policy "cotizaciones_insert" on cotizaciones for insert
  with check (public.is_member_of(company_id));

drop policy if exists "cotizaciones_update" on cotizaciones;
create policy "cotizaciones_update" on cotizaciones for update
  using (public.is_member_of(company_id));

drop policy if exists "cotizaciones_delete" on cotizaciones;
create policy "cotizaciones_delete" on cotizaciones for delete
  using (public.is_member_of(company_id));

create index if not exists idx_cotizaciones_company on cotizaciones(company_id, created_at desc);

-- 2. Tabla de items de cotización
create table if not exists cotizacion_items (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references cotizaciones(id) on delete cascade,
  descripcion text not null,
  cantidad numeric(12,2) not null default 1,
  precio_unitario numeric(12,2) not null default 0,
  subtotal numeric(12,2) not null default 0
);

-- Columna para IVA por item en cotizaciones
alter table cotizacion_items add column if not exists iva_id uuid references taxes(id) on delete set null;
-- Columna para cuenta de ingreso por item en cotizaciones
alter table cotizacion_items add column if not exists account_venta_id uuid references accounts(id) on delete set null;
alter table cotizacion_items add column if not exists producto_id uuid references catalogo_productos(id) on delete set null;

alter table cotizacion_items enable row level security;

drop policy if exists "cotizacion_items_select" on cotizacion_items;
create policy "cotizacion_items_select" on cotizacion_items for select
  using (exists (select 1 from cotizaciones c where c.id = cotizacion_id and public.is_member_of(c.company_id)));

drop policy if exists "cotizacion_items_insert" on cotizacion_items;
create policy "cotizacion_items_insert" on cotizacion_items for insert
  with check (exists (select 1 from cotizaciones c where c.id = cotizacion_id and public.is_member_of(c.company_id)));

drop policy if exists "cotizacion_items_delete" on cotizacion_items;
create policy "cotizacion_items_delete" on cotizacion_items for delete
  using (exists (select 1 from cotizaciones c where c.id = cotizacion_id and public.is_member_of(c.company_id)));

create index if not exists idx_cotizacion_items_cotizacion on cotizacion_items(cotizacion_id);

-- 3. Trigger para actualizar updated_at
create or replace function trg_cotizaciones_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_cotizaciones_updated_at on cotizaciones;
create trigger trg_cotizaciones_updated_at
  before update on cotizaciones
  for each row execute function trg_cotizaciones_updated_at();

-- 4. RPC para generar número de cotización
create or replace function generar_numero_cotizacion(p_company_id uuid)
returns text
language sql
stable
as $$
  select 'COT-' || to_char(now(), 'YYYY') || '-' ||
    lpad((coalesce(
      (select count(*)::int + 1 from cotizaciones where company_id = p_company_id and extract(year from created_at) = extract(year from now())),
      1
    )::text), 6, '0');
$$;

-- 5. Token público para compartir cotización sin login
alter table cotizaciones add column if not exists token uuid not null default gen_random_uuid();
create index if not exists idx_cotizaciones_token on cotizaciones(token);

-- 6. RPC público para obtener cotización por token (sin JWT)
create or replace function obtener_cotizacion_publica(p_token uuid)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'numero', c.numero,
    'moneda', c.moneda,
    'subtotal', c.subtotal,
    'impuesto', c.impuesto,
    'total', c.total,
    'notas', c.notas,
    'estado', c.estado,
    'created_at', c.created_at,
    'contacto', jsonb_build_object('name', ct.name),
    'empresa', jsonb_build_object('name', co.name, 'rif', co.rif, 'pais', co.pais),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'descripcion', i.descripcion,
        'cantidad', i.cantidad,
        'precio_unitario', i.precio_unitario,
        'subtotal', i.subtotal
      )) from cotizacion_items i where i.cotizacion_id = c.id
    ), '[]'::jsonb)
  )
  from cotizaciones c
  left join contacts ct on ct.id = c.contact_id
  join companies co on co.id = c.company_id
  where c.token = p_token;
$$;


-- ============================================================
-- facturacion-setup.sql
-- ============================================================
-- Facturación electrónica (e-kuatia/SIFEN)
-- Ejecutar después de crm-setup.sql

create table if not exists facturas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  cotizacion_id uuid references cotizaciones(id) on delete set null,
  cdc text,
  numero text,
  timbrado text,
  xml_generado text,
  total numeric(12,2) not null default 0,
  moneda text not null default 'PYG',
  estado text not null default 'emitida'
    check (estado in ('emitida', 'aprobada', 'rechazada', 'cancelada')),
  errores text,
  created_at timestamptz not null default now()
);

-- subtotal e impuesto para asientos contables
alter table facturas add column if not exists subtotal numeric(12,2) not null default 0;
alter table facturas add column if not exists impuesto numeric(12,2) not null default 0;

drop policy if exists "facturas_select" on facturas;
create policy "facturas_select" on facturas for select
  using (public.is_member_of(company_id));

drop policy if exists "facturas_insert" on facturas;
create policy "facturas_insert" on facturas for insert
  with check (public.is_member_of(company_id));

drop policy if exists "facturas_update" on facturas;
create policy "facturas_update" on facturas for update
  using (public.is_member_of(company_id));

create index if not exists idx_facturas_company on facturas(company_id, created_at desc);

-- Contador secuencial por establecimiento + punto de expedición
create table if not exists factura_contadores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  establecimiento text not null,
  punto_expedicion text not null,
  contador integer not null default 0,
  created_at timestamptz not null default now(),
  unique(company_id, establecimiento, punto_expedicion)
);

alter table factura_contadores enable row level security;

drop policy if exists "factura_contadores_select" on factura_contadores;
create policy "factura_contadores_select" on factura_contadores for select
  using (public.is_member_of(company_id));

drop policy if exists "factura_contadores_insert" on factura_contadores;
create policy "factura_contadores_insert" on factura_contadores for insert
  with check (public.is_member_of(company_id));

drop policy if exists "factura_contadores_update" on factura_contadores;
create policy "factura_contadores_update" on factura_contadores for update
  using (public.is_member_of(company_id));

create or replace function incrementar_contador_factura(p_company_id uuid, p_establecimiento text default '001', p_punto_exp text default '001')
returns jsonb
language plpgsql
security definer
as $$
declare
  v_count integer;
  v_formato text;
begin
  insert into factura_contadores (company_id, establecimiento, punto_expedicion, contador)
  values (p_company_id, p_establecimiento, p_punto_exp, 1)
  on conflict (company_id, establecimiento, punto_expedicion)
  do update set contador = factura_contadores.contador + 1
  returning contador into v_count;

  v_formato := p_establecimiento || '-' || p_punto_exp || '-' || lpad(v_count::text, 7, '0');

  return jsonb_build_object('numero_doc', v_count, 'numero_formateado', v_formato);
end;
$$;


-- ============================================================
-- notas-credito-debito-setup.sql
-- ============================================================
-- Notas de Crédito/Débito (SIFEN tipoDE=5/6)
-- Ejecutar después de facturacion-setup.sql y accounting-setup.sql

-- 1. Tabla principal
create table if not exists notas_credito_debito (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  factura_origen_id uuid not null references facturas(id),
  cotizacion_id uuid references cotizaciones(id) on delete set null,
  tipo text not null check (tipo in ('credito', 'debito')),
  cdc text,
  numero text,
  timbrado text,
  xml_generado text,
  motivo text not null,
  items jsonb not null default '[]',
  subtotal numeric(12,2) not null default 0,
  impuesto numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  moneda text not null default 'PYG',
  estado text not null default 'borrador' check (estado in ('borrador', 'emitida', 'aprobada', 'rechazada', 'cancelada')),
  errores text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table notas_credito_debito enable row level security;
drop policy if exists "notas_select" on notas_credito_debito;
create policy "notas_select" on notas_credito_debito for select using (public.is_member_of(company_id));
drop policy if exists "notas_insert" on notas_credito_debito;
create policy "notas_insert" on notas_credito_debito for insert with check (public.is_member_of(company_id));
drop policy if exists "notas_update" on notas_credito_debito;
create policy "notas_update" on notas_credito_debito for update using (public.is_member_of(company_id));

-- 2. Contadores independientes por tipo
create table if not exists nota_contadores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  tipo text not null check (tipo in ('credito', 'debito')),
  establecimiento text not null default '001',
  punto_expedicion text not null default '001',
  contador integer not null default 0,
  unique(company_id, tipo, establecimiento, punto_expedicion)
);

alter table nota_contadores enable row level security;
drop policy if exists "nota_contadores_select" on nota_contadores;
create policy "nota_contadores_select" on nota_contadores for select using (public.is_member_of(company_id));
drop policy if exists "nota_contadores_insert" on nota_contadores;
create policy "nota_contadores_insert" on nota_contadores for insert with check (public.is_member_of(company_id));

-- 3. RPC: incrementar contador de nota
create or replace function incrementar_contador_nota(p_company_id uuid, p_tipo text, p_establecimiento text default '001', p_punto_exp text default '001')
returns jsonb
language plpgsql
security definer
as $$
declare
  v_count integer;
  v_formato text;
begin
  insert into nota_contadores (company_id, tipo, establecimiento, punto_expedicion, contador)
  values (p_company_id, p_tipo, p_establecimiento, p_punto_exp, 1)
  on conflict (company_id, tipo, establecimiento, punto_expedicion)
  do update set contador = nota_contadores.contador + 1
  returning contador into v_count;

  v_formato := p_establecimiento || '-' || p_punto_exp || '-' || lpad(v_count::text, 7, '0');
  return jsonb_build_object('numero_doc', v_count, 'numero_formateado', v_formato);
end;
$$;

-- 4. Agregar source_type para notas en asientos contables
alter table journal_entries drop constraint if exists journal_entries_source_type_check;
alter table journal_entries add constraint journal_entries_source_type_check
  check (source_type in ('factura_proveedor', 'factura_cliente', 'pago_proveedor', 'pago_cliente', 'ajuste_inventario', 'nota_credito_cliente', 'nota_debito_cliente', 'manual'));

-- 5. RPC: generar asiento contable para NC/ND
create or replace function generar_asiento_nota_credito_debito(p_nota_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_nota record;
  v_factura record;
  v_entry_id uuid;
  v_entry_number text;
  v_account_cliente_id uuid;
  v_account_ingreso_id uuid;
  v_account_iva_debito_id uuid;
begin
  select n.* into v_nota from notas_credito_debito n where n.id = p_nota_id;
  if not found then return jsonb_build_object('error', 'Nota no encontrada'); end if;
  if v_nota.estado != 'aprobada' then return jsonb_build_object('error', 'La nota debe estar aprobada'); end if;

  -- Obtener factura original
  select f.* into v_factura from facturas f where f.id = v_nota.factura_origen_id;
  if not found then return jsonb_build_object('error', 'Factura original no encontrada'); end if;

  -- Buscar cuentas
  select coalesce(c.account_cliente_id, a.id) into v_account_cliente_id
  from facturas ff
  left join cotizaciones ct on ct.id = ff.cotizacion_id
  left join contacts c on c.id = ct.contact_id
  left join accounts a on a.company_id = ff.company_id and a.code = '1.1.3'
  where ff.id = v_nota.factura_origen_id limit 1;
  select id into v_account_ingreso_id from accounts
  where company_id = v_nota.company_id and (code = '4.1' or name ilike '%venta%') limit 1;
  select id into v_account_iva_debito_id from accounts
  where company_id = v_nota.company_id and (code = '2.1.2' or name ilike '%iva%debito%') limit 1;

  v_entry_number := 'AS-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));
  v_entry_number := case when v_nota.tipo = 'credito' then 'NC-' else 'ND-' end || v_entry_number;

  if v_nota.tipo = 'credito' then
    -- NC: reversión — Haber Clientes, Debe Ingresos+IVA
    insert into journal_entries (company_id, entry_number, entry_date, description, source_type, source_id, total_debit, total_credit, estado)
    values (v_nota.company_id, v_entry_number, now()::date,
            'Nota de Crédito: ' || coalesce(v_nota.numero, '') || ' - Factura: ' || coalesce(v_factura.numero, ''),
            'nota_credito_cliente', p_nota_id, v_nota.total, v_nota.total, 'contabilizado')
    returning id into v_entry_id;

    if v_account_ingreso_id is not null then
      insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
      values (v_entry_id, v_account_ingreso_id, 'NC: ' || coalesce(v_nota.motivo, ''), v_nota.subtotal, 0);
    end if;
    if v_account_iva_debito_id is not null and v_nota.impuesto > 0 then
      insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
      values (v_entry_id, v_account_iva_debito_id, 'IVA NC ' || coalesce(v_nota.numero, ''), v_nota.impuesto, 0);
    end if;
    if v_account_cliente_id is not null then
      insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
      values (v_entry_id, v_account_cliente_id, 'NC Cliente: ' || coalesce(v_nota.motivo, ''), 0, v_nota.total);
    end if;

  else
    -- ND: cargo adicional — Debe Clientes, Haber Ingresos+IVA
    insert into journal_entries (company_id, entry_number, entry_date, description, source_type, source_id, total_debit, total_credit, estado)
    values (v_nota.company_id, v_entry_number, now()::date,
            'Nota de Débito: ' || coalesce(v_nota.numero, '') || ' - Factura: ' || coalesce(v_factura.numero, ''),
            'nota_debito_cliente', p_nota_id, v_nota.total, v_nota.total, 'contabilizado')
    returning id into v_entry_id;

    if v_account_cliente_id is not null then
      insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
      values (v_entry_id, v_account_cliente_id, 'ND Cliente: ' || coalesce(v_nota.motivo, ''), v_nota.total, 0);
    end if;
    if v_account_ingreso_id is not null then
      insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
      values (v_entry_id, v_account_ingreso_id, 'ND: ' || coalesce(v_nota.motivo, ''), 0, v_nota.subtotal);
    end if;
    if v_account_iva_debito_id is not null and v_nota.impuesto > 0 then
      insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
      values (v_entry_id, v_account_iva_debito_id, 'IVA ND ' || coalesce(v_nota.numero, ''), 0, v_nota.impuesto);
    end if;
  end if;

  return jsonb_build_object('id', v_entry_id, 'entry_number', v_entry_number);
end;
$$;

-- 6. RPC: actualizar saldo de factura desde NC/ND
create or replace function actualizar_saldo_por_nota(p_nota_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_nota record;
begin
  select * into v_nota from notas_credito_debito where id = p_nota_id;
  if not found then return jsonb_build_object('error', 'Nota no encontrada'); end if;
  if v_nota.estado != 'aprobada' then return jsonb_build_object('error', 'La nota debe estar aprobada'); end if;

  if v_nota.tipo = 'credito' then
    -- NC: reduce saldo
    update facturas set saldo_pendiente = greatest(0, coalesce(saldo_pendiente, total) - v_nota.total)
    where id = v_nota.factura_origen_id;
    -- Si quedó saldo 0 y estaba aprobada, marcarla como cobrada
    update facturas set estado = 'cobrada'
    where id = v_nota.factura_origen_id and estado = 'aprobada' and coalesce(saldo_pendiente, total) <= 0;
  else
    -- ND: aumenta saldo
    update facturas set saldo_pendiente = coalesce(saldo_pendiente, total) + v_nota.total
    where id = v_nota.factura_origen_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;


-- ============================================================
-- anular-factura-setup.sql
-- ============================================================
-- Anular factura de cliente + reversión contable
-- Ejecutar después de accounting-setup.sql

create or replace function anular_factura_cliente(p_factura_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_factura record;
  v_cot record;
  v_asiento record;
begin
  select * into v_factura from facturas where id = p_factura_id;
  if not found then
    return jsonb_build_object('error', 'Factura no encontrada');
  end if;
  if v_factura.estado = 'cancelada' then
    return jsonb_build_object('error', 'La factura ya está cancelada');
  end if;
  if v_factura.estado = 'cobrada' then
    return jsonb_build_object('error', 'No se puede anular una factura cobrada. Emití una Nota de Crédito.');
  end if;

  -- Cambiar estado de la factura
  update facturas set estado = 'cancelada', saldo_pendiente = 0
  where id = p_factura_id;

  -- Anular asiento contable si existe
  for v_asiento in
    select id, entry_number from journal_entries
    where source_type = 'factura_cliente' and source_id = p_factura_id and estado = 'contabilizado'
  loop
    update journal_entries set estado = 'anulado' where id = v_asiento.id;
  end loop;

  -- Retornar cotización a estado aceptada (para poder re-facturar)
  update cotizaciones set estado = 'aceptada'
  where id = v_factura.cotizacion_id and estado = 'facturada';

  return jsonb_build_object('ok', true, 'factura_id', p_factura_id);
end;
$$;


-- ============================================================
-- cobranza-setup.sql
-- ============================================================
-- Cobranza automatizada por WhatsApp
-- Ejecutar después de facturacion-setup.sql

-- 1. Fecha de vencimiento en facturas
alter table facturas add column if not exists fecha_vencimiento timestamptz;
alter table facturas add column if not exists ultimo_recordatorio timestamptz;
alter table facturas add column if not exists recordatorios_enviados integer not null default 0;

-- 2. Config de cobranza por empresa
create table if not exists cobranza_config (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  activo boolean not null default false,
  dias_antes integer not null default 3,
  dias_despues integer not null default 1,
  intervalo_dias integer not null default 3,
  plantilla_id uuid,
  created_at timestamptz not null default now(),
  unique(company_id)
);

alter table cobranza_config enable row level security;

drop policy if exists "cobranza_config_select" on cobranza_config;
create policy "cobranza_config_select" on cobranza_config for select
  using (public.is_member_of(company_id));

drop policy if exists "cobranza_config_insert" on cobranza_config;
create policy "cobranza_config_insert" on cobranza_config for insert
  with check (public.is_member_of(company_id));

drop policy if exists "cobranza_config_update" on cobranza_config;
create policy "cobranza_config_update" on cobranza_config for update
  using (public.is_member_of(company_id));


-- ============================================================
-- facturas-proveedor-setup.sql
-- ============================================================
-- Facturas de proveedor + cotejo 3 vías (OC ↔ Recepción ↔ Factura)
-- Ejecutar después de srm-setup.sql

-- Cabecera de factura de proveedor
create table if not exists proveedor_facturas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  proveedor_id uuid not null references proveedores(id),
  orden_id uuid references ordenes_compra(id) on delete set null,
  numero_factura text not null,
  timbrado text,
  fecha_emision date not null default now()::date,
  fecha_vencimiento date,
  subtotal numeric(12,2) not null default 0,
  impuesto numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  moneda text not null default 'PYG',
  estado text not null default 'pendiente' check (estado in ('pendiente', 'conciliada', 'discrepancia', 'pagada', 'anulada')),
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_proveedor_facturas_company on proveedor_facturas(company_id, created_at desc);

-- Ítems de factura de proveedor
create table if not exists proveedor_factura_items (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references proveedor_facturas(id) on delete cascade,
  producto_id uuid references catalogo_productos(id) on delete set null,
  orden_item_id uuid references orden_compra_items(id) on delete set null,
  descripcion text,
  cantidad numeric(12,2) not null default 1,
  precio_unitario numeric(12,2) not null default 0,
  subtotal numeric(12,2) not null default 0
);

-- Columna para IVA por item en facturas de proveedor
alter table proveedor_factura_items add column if not exists iva_id uuid references taxes(id) on delete set null;
alter table proveedor_factura_items add column if not exists account_compra_id uuid references accounts(id) on delete set null;

-- RLS
alter table proveedor_facturas enable row level security;
alter table proveedor_factura_items enable row level security;

drop policy if exists "proveedor_facturas_select" on proveedor_facturas;
create policy "proveedor_facturas_select" on proveedor_facturas for select using (public.is_member_of(company_id));
drop policy if exists "proveedor_facturas_insert" on proveedor_facturas;
create policy "proveedor_facturas_insert" on proveedor_facturas for insert with check (public.is_member_of(company_id));
drop policy if exists "proveedor_facturas_update" on proveedor_facturas;
create policy "proveedor_facturas_update" on proveedor_facturas for update using (public.is_member_of(company_id));
drop policy if exists "proveedor_facturas_delete" on proveedor_facturas;
create policy "proveedor_facturas_delete" on proveedor_facturas for delete using (public.is_member_of(company_id));

drop policy if exists "proveedor_factura_items_select" on proveedor_factura_items;
create policy "proveedor_factura_items_select" on proveedor_factura_items for select using (exists (select 1 from proveedor_facturas f where f.id = factura_id and public.is_member_of(f.company_id)));
drop policy if exists "proveedor_factura_items_insert" on proveedor_factura_items;
create policy "proveedor_factura_items_insert" on proveedor_factura_items for insert with check (exists (select 1 from proveedor_facturas f where f.id = factura_id and public.is_member_of(f.company_id)));
drop policy if exists "proveedor_factura_items_delete" on proveedor_factura_items;
create policy "proveedor_factura_items_delete" on proveedor_factura_items for delete using (exists (select 1 from proveedor_facturas f where f.id = factura_id and public.is_member_of(f.company_id)));

-- RPC: cotejar factura contra OC y recepción
create or replace function cotejar_factura(p_factura_id uuid)
returns jsonb
language plpgsql
stable
as $$
declare
  v_factura record;
  v_resultado jsonb;
  v_discrepancia boolean := false;
  v_items jsonb := '[]'::jsonb;
  v_item jsonb;
  v_orden_cantidad numeric(12,2);
  v_orden_precio numeric(12,2);
  v_orden_recibido numeric(12,2);
  v_orden_item_id uuid;
begin
  select f.*, p.nombre as proveedor_nombre
  into v_factura
  from proveedor_facturas f
  join proveedores p on p.id = f.proveedor_id
  where f.id = p_factura_id;

  if not found then
    return jsonb_build_object('error', 'Factura no encontrada');
  end if;

  -- Para cada item de la factura, buscar su contraparte en la OC y recepción
  for v_item in select to_jsonb(t.*) from proveedor_factura_items t where factura_id = p_factura_id
  loop
    v_orden_item_id := (v_item->>'orden_item_id')::uuid;
    v_orden_recibido := 0;

    if v_orden_item_id is not null then
      select cantidad, precio_unitario, cantidad_recibida into v_orden_cantidad, v_orden_precio, v_orden_recibido
      from orden_compra_items where id = v_orden_item_id;
    else
      select id, cantidad, precio_unitario, cantidad_recibida into v_orden_item_id, v_orden_cantidad, v_orden_precio, v_orden_recibido
      from orden_compra_items
      where orden_id = v_factura.orden_id and producto_id = (v_item->>'producto_id')::uuid
      limit 1;
    end if;

    v_items := v_items || jsonb_build_object(
      'producto_id', v_item->>'producto_id',
      'descripcion', v_item->>'descripcion',
      'cantidad_pedida', coalesce(v_orden_cantidad, 0),
      'cantidad_recibida', coalesce(v_orden_recibido, 0),
      'cantidad_facturada', (v_item->>'cantidad')::numeric,
      'precio_oc', coalesce(v_orden_precio, 0),
      'precio_factura', (v_item->>'precio_unitario')::numeric,
      'coincide_cantidad', case when v_orden_item_id is not null then coalesce(v_orden_recibido, 0) = (v_item->>'cantidad')::numeric else null end,
      'coincide_precio', case when v_orden_item_id is not null then (coalesce(v_orden_precio, 0) = (v_item->>'precio_unitario')::numeric) else null end
    );

    if (v_orden_item_id is null)
      or (coalesce(v_orden_recibido, 0) != (v_item->>'cantidad')::numeric)
      or (coalesce(v_orden_precio, 0) != (v_item->>'precio_unitario')::numeric)
    then
      v_discrepancia := true;
    end if;
  end loop;

  v_resultado := jsonb_build_object(
    'factura_id', p_factura_id,
    'proveedor_nombre', v_factura.proveedor_nombre,
    'numero_factura', v_factura.numero_factura,
    'total_factura', v_factura.total,
    'moneda', v_factura.moneda,
    'discrepancia', v_discrepancia,
    'items', v_items
  );

  return v_resultado;
end;
$$;


-- ============================================================
-- scorecard-setup.sql
-- ============================================================
-- Scorecard de proveedores (evaluación automática + manual)
-- Ejecutar después de srm-setup.sql

create table if not exists proveedor_scorecard (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  proveedor_id uuid not null references proveedores(id) on delete cascade,
  unique(company_id, proveedor_id),
  entrega_tiempo numeric(3,2) not null default 0,
  precision_cantidad numeric(3,2) not null default 0,
  precision_precio numeric(3,2) not null default 0,
  calidad numeric(3,2) not null default 0,
  comunicacion numeric(3,2) not null default 0,
  notas text,
  puntaje_general numeric(3,2) not null default 0,
  fecha_ultimo_calculo timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_proveedor_scorecard_company on proveedor_scorecard(company_id);

-- RLS
alter table proveedor_scorecard enable row level security;
drop policy if exists "proveedor_scorecard_select" on proveedor_scorecard;
create policy "proveedor_scorecard_select" on proveedor_scorecard for select using (public.is_member_of(company_id));
drop policy if exists "proveedor_scorecard_insert" on proveedor_scorecard;
create policy "proveedor_scorecard_insert" on proveedor_scorecard for insert with check (public.is_member_of(company_id));
drop policy if exists "proveedor_scorecard_update" on proveedor_scorecard;
create policy "proveedor_scorecard_update" on proveedor_scorecard for update using (public.is_member_of(company_id));
drop policy if exists "proveedor_scorecard_delete" on proveedor_scorecard;
create policy "proveedor_scorecard_delete" on proveedor_scorecard for delete using (public.is_member_of(company_id));

-- RPC: calcular scorecards para todos los proveedores activos de una empresa
create or replace function calcular_scorecards(p_company_id uuid)
returns void
language plpgsql
as $$
declare
  v_prov record;
  v_entrega numeric(3,2);
  v_cantidad numeric(3,2);
  v_precio numeric(3,2);
  v_total_oc int;
  v_oc_a_tiempo int;
  v_total_items int;
  v_items_completos int;
  v_total_factura_items int;
  v_items_precio_ok int;
  v_general numeric(3,2);
begin
  for v_prov in select id from proveedores where company_id = p_company_id and estado = 'activo'
  loop
    -- Entrega a tiempo: % de OCs recibidas antes o en la fecha estimada
    select count(*), count(*) filter (
      where r.fecha_recepcion::date <= o.fecha_entrega_estimada
    ) into v_total_oc, v_oc_a_tiempo
    from ordenes_compra o
    join recepciones r on r.orden_id = o.id
    where o.proveedor_id = v_prov.id and o.estado = 'recibida' and o.fecha_entrega_estimada is not null;

    if v_total_oc > 0 then
      v_entrega := least(5.0, (v_oc_a_tiempo::numeric / v_total_oc) * 5.0);
    else
      v_entrega := 0;
    end if;

    -- Precisión cantidad: items donde cantidad_recibida >= cantidad pedida
    select count(*), count(*) filter (
      where oi.cantidad_recibida >= oi.cantidad
    ) into v_total_items, v_items_completos
    from orden_compra_items oi
    join ordenes_compra o on o.id = oi.orden_id
    where o.proveedor_id = v_prov.id and o.estado = 'recibida';

    if v_total_items > 0 then
      v_cantidad := least(5.0, (v_items_completos::numeric / v_total_items) * 5.0);
    else
      v_cantidad := 0;
    end if;

    -- Precisión precio: items de factura vs items de OC (precio coincide)
    select count(*), count(*) filter (
      where pfi.precio_unitario = oi.precio_unitario
    ) into v_total_factura_items, v_items_precio_ok
    from proveedor_factura_items pfi
    join proveedor_facturas pf on pf.id = pfi.factura_id
    join orden_compra_items oi on oi.id = pfi.orden_item_id
    join ordenes_compra o on o.id = oi.orden_id
    where pf.proveedor_id = v_prov.id and pf.estado in ('conciliada', 'discrepancia', 'pagada');

    if v_total_factura_items > 0 then
      v_precio := least(5.0, (v_items_precio_ok::numeric / v_total_factura_items) * 5.0);
    else
      v_precio := 0;
    end if;

    -- Puntaje general: weighted average
    v_general := round(
      coalesce(v_entrega, 0) * 0.30 +
      coalesce(v_cantidad, 0) * 0.20 +
      coalesce(v_precio, 0) * 0.20,
      2
    );

    -- Upsert
    insert into proveedor_scorecard (company_id, proveedor_id, entrega_tiempo, precision_cantidad, precision_precio, puntaje_general, fecha_ultimo_calculo)
    values (p_company_id, v_prov.id, v_entrega, v_cantidad, v_precio, v_general, now())
    on conflict (company_id, proveedor_id)
    do update set
      entrega_tiempo = excluded.entrega_tiempo,
      precision_cantidad = excluded.precision_cantidad,
      precision_precio = excluded.precision_precio,
      puntaje_general = round(
        excluded.entrega_tiempo * 0.30 +
        excluded.precision_cantidad * 0.20 +
        excluded.precision_precio * 0.20 +
        coalesce(proveedor_scorecard.calidad, 0) * 0.15 +
        coalesce(proveedor_scorecard.comunicacion, 0) * 0.15,
        2
      ),
      fecha_ultimo_calculo = now();
  end loop;
end;
$$;

-- RPC: obtener scorecards con datos del proveedor
create or replace function obtener_scorecards(p_company_id uuid)
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'proveedor_id', s.proveedor_id,
      'proveedor_nombre', p.nombre,
      'proveedor_categoria', p.categoria,
      'proveedor_estado', p.estado,
      'entrega_tiempo', s.entrega_tiempo,
      'precision_cantidad', s.precision_cantidad,
      'precision_precio', s.precision_precio,
      'calidad', s.calidad,
      'comunicacion', s.comunicacion,
      'notas', s.notas,
      'puntaje_general', s.puntaje_general,
      'fecha_ultimo_calculo', s.fecha_ultimo_calculo,
      'total_evaluaciones', (select count(*) from evaluacion_proveedores e where e.proveedor_id = s.proveedor_id)
    ) order by s.puntaje_general desc nulls last
  ), '[]'::jsonb)
  from proveedor_scorecard s
  join proveedores p on p.id = s.proveedor_id
  where s.company_id = p_company_id;
$$;

-- RPC: guardar campos manuales del scorecard
create or replace function guardar_scorecard_manual(p_id uuid, p_calidad numeric, p_comunicacion numeric, p_notas text)
returns void
language plpgsql
as $$
begin
  update proveedor_scorecard set
    calidad = p_calidad,
    comunicacion = p_comunicacion,
    notas = p_notas,
    puntaje_general = round(
      entrega_tiempo * 0.30 +
      precision_cantidad * 0.20 +
      precision_precio * 0.20 +
      p_calidad * 0.15 +
      p_comunicacion * 0.15,
      2
    ),
    updated_at = now()
  where id = p_id;
end;
$$;


-- ============================================================
-- accounting-setup.sql
-- ============================================================
-- Motor de impuestos LATAM (@saas/accounting)
-- Ejecutar después de crm-setup.sql y srm-setup.sql

-- Grupos de impuestos (IVA, Retención, etc.)
create table if not exists tax_groups (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  type text not null check (type in ('debito_fiscal', 'credito_fiscal', 'retencion_compra', 'retencion_venta')),
  created_at timestamptz not null default now()
);

create index if not exists idx_tax_groups_company on tax_groups(company_id);

-- Impuestos específicos (IVA 10%, Ret. Renta 1%, etc.)
create table if not exists taxes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  tax_group_id uuid not null references tax_groups(id) on delete cascade,
  name text not null,
  percentage numeric(5,2) not null,
  is_withholding boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_taxes_company on taxes(company_id);

-- Líneas de impuestos aplicadas a facturas (polimórfico)
create table if not exists invoice_tax_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  invoice_type text not null check (invoice_type in ('proveedor', 'cliente')),
  invoice_id uuid not null,
  tax_id uuid not null references taxes(id),
  base_amount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_invoice_tax_lines_invoice on invoice_tax_lines(invoice_type, invoice_id);

-- Columna para vincular impuestos a items específicos de la factura
alter table invoice_tax_lines add column if not exists item_id uuid;
create index if not exists idx_invoice_tax_lines_item on invoice_tax_lines(item_id);

-- RLS
alter table tax_groups enable row level security;
alter table taxes enable row level security;
alter table invoice_tax_lines enable row level security;

drop policy if exists "tax_groups_select" on tax_groups;
create policy "tax_groups_select" on tax_groups for select using (public.is_member_of(company_id));
drop policy if exists "tax_groups_insert" on tax_groups;
create policy "tax_groups_insert" on tax_groups for insert with check (public.is_member_of(company_id));
drop policy if exists "tax_groups_update" on tax_groups;
create policy "tax_groups_update" on tax_groups for update using (public.is_member_of(company_id));
drop policy if exists "tax_groups_delete" on tax_groups;
create policy "tax_groups_delete" on tax_groups for delete using (public.is_member_of(company_id));

drop policy if exists "taxes_select" on taxes;
create policy "taxes_select" on taxes for select using (public.is_member_of(company_id));
drop policy if exists "taxes_insert" on taxes;
create policy "taxes_insert" on taxes for insert with check (public.is_member_of(company_id));
drop policy if exists "taxes_update" on taxes;
create policy "taxes_update" on taxes for update using (public.is_member_of(company_id));
drop policy if exists "taxes_delete" on taxes;
create policy "taxes_delete" on taxes for delete using (public.is_member_of(company_id));

drop policy if exists "invoice_tax_lines_select" on invoice_tax_lines;
create policy "invoice_tax_lines_select" on invoice_tax_lines for select using (public.is_member_of(company_id));
drop policy if exists "invoice_tax_lines_insert" on invoice_tax_lines;
create policy "invoice_tax_lines_insert" on invoice_tax_lines for insert with check (public.is_member_of(company_id));
drop policy if exists "invoice_tax_lines_delete" on invoice_tax_lines;
create policy "invoice_tax_lines_delete" on invoice_tax_lines for delete using (public.is_member_of(company_id));

-- ============================================================
-- Plan de Cuentas (@saas/accounting — Fase 2)
-- ============================================================

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  parent_id uuid references accounts(id) on delete set null,
  code text not null,
  name text not null,
  type text not null check (type in ('activo', 'pasivo', 'patrimonio', 'ingreso', 'costo', 'gasto')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, code)
);

create index if not exists idx_accounts_company on accounts(company_id);
create index if not exists idx_accounts_parent on accounts(parent_id);

alter table accounts enable row level security;
drop policy if exists "accounts_select" on accounts;
create policy "accounts_select" on accounts for select using (public.is_member_of(company_id));
drop policy if exists "accounts_insert" on accounts;
create policy "accounts_insert" on accounts for insert with check (public.is_member_of(company_id));
drop policy if exists "accounts_update" on accounts;
create policy "accounts_update" on accounts for update using (public.is_member_of(company_id));
drop policy if exists "accounts_delete" on accounts;
create policy "accounts_delete" on accounts for delete using (public.is_member_of(company_id));

-- Vincular impuestos a cuentas contables
alter table taxes add column if not exists account_id uuid references accounts(id) on delete set null;

-- Cuentas contables para productos (compra/venta)
alter table catalogo_productos add column if not exists account_compra_id uuid references accounts(id) on delete set null;
alter table catalogo_productos add column if not exists account_venta_id uuid references accounts(id) on delete set null;

-- ============================================================
-- Asientos Contables (@saas/accounting — Fase 3)
-- ============================================================

create table if not exists journal_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  entry_number text not null,
  entry_date date not null default now(),
  description text,
  source_type text not null check (source_type in ('factura_proveedor', 'factura_cliente', 'pago_proveedor', 'pago_cliente', 'manual')),
  source_id uuid,
  total_debit numeric(12,2) not null default 0,
  total_credit numeric(12,2) not null default 0,
  estado text not null default 'borrador' check (estado in ('borrador', 'contabilizado', 'anulado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_journal_entries_company on journal_entries(company_id);

create table if not exists journal_entry_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references journal_entries(id) on delete cascade,
  account_id uuid not null references accounts(id),
  description text,
  debit numeric(12,2) not null default 0,
  credit numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_journal_entry_lines_entry on journal_entry_lines(journal_entry_id);

-- RLS
alter table journal_entries enable row level security;
alter table journal_entry_lines enable row level security;

drop policy if exists "journal_entries_select" on journal_entries;
create policy "journal_entries_select" on journal_entries for select using (public.is_member_of(company_id));
drop policy if exists "journal_entries_insert" on journal_entries;
create policy "journal_entries_insert" on journal_entries for insert with check (public.is_member_of(company_id));
drop policy if exists "journal_entries_update" on journal_entries;
create policy "journal_entries_update" on journal_entries for update using (public.is_member_of(company_id));
drop policy if exists "journal_entries_delete" on journal_entries;
create policy "journal_entries_delete" on journal_entries for delete using (public.is_member_of(company_id));

drop policy if exists "journal_entry_lines_select" on journal_entry_lines;
create policy "journal_entry_lines_select" on journal_entry_lines for select using (exists (select 1 from journal_entries je where je.id = journal_entry_id and public.is_member_of(je.company_id)));
drop policy if exists "journal_entry_lines_insert" on journal_entry_lines;
create policy "journal_entry_lines_insert" on journal_entry_lines for insert with check (exists (select 1 from journal_entries je where je.id = journal_entry_id and public.is_member_of(je.company_id)));
drop policy if exists "journal_entry_lines_delete" on journal_entry_lines;
create policy "journal_entry_lines_delete" on journal_entry_lines for delete using (exists (select 1 from journal_entries je where je.id = journal_entry_id and public.is_member_of(je.company_id)));

-- RPC: generar asiento contable desde factura de proveedor
create or replace function generar_asiento_factura_proveedor(p_factura_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_factura record;
  v_entry_id uuid;
  v_entry_number text;
  v_account_gasto_id uuid;
  v_account_proveedor_id uuid;
  v_base numeric(12,2);
  v_iva numeric(12,2);
  v_total numeric(12,2);
  v_line record;
begin
  -- Obtener datos de la factura
  select pf.*, p.nombre as proveedor_nombre
  into v_factura
  from proveedor_facturas pf
  join proveedores p on p.id = pf.proveedor_id
  where pf.id = p_factura_id;

  if not found then
    return jsonb_build_object('error', 'Factura no encontrada');
  end if;

  if v_factura.estado not in ('conciliada', 'pagada') then
    return jsonb_build_object('error', 'La factura debe estar conciliada o pagada');
  end if;

  -- Buscar cuentas por defecto
  -- Buscar cuenta de proveedor (específica del proveedor o genérica 2.1.1)
  select coalesce(p.account_proveedor_id, a.id) into v_account_proveedor_id
  from proveedores p
  left join accounts a on a.company_id = p.company_id and a.code = '2.1.1'
  where p.id = v_factura.proveedor_id
  limit 1;

  -- Generar número de asiento
  v_entry_number := 'AS-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));

  -- Calcular montos
  v_base := coalesce(v_factura.subtotal, 0);
  v_iva := coalesce(v_factura.impuesto, 0);
  v_total := coalesce(v_factura.total, 0);

  -- Crear asiento
  insert into journal_entries (company_id, entry_number, entry_date, description, source_type, source_id, total_debit, total_credit, estado)
  values (v_factura.company_id, v_entry_number, now()::date,
          'Factura proveedor: ' || v_factura.numero_factura || ' - ' || v_factura.proveedor_nombre,
          'factura_proveedor', p_factura_id, v_total, v_total, 'contabilizado')
  returning id into v_entry_id;

  -- Línea 1: Débito a Gasto (base imponible)
  select coalesce(cp.account_compra_id, v_account_gasto_id) into v_account_gasto_id
  from proveedor_factura_items pfi
  left join catalogo_productos cp on cp.id = pfi.producto_id
  where pfi.factura_id = p_factura_id
  limit 1;

  if v_account_gasto_id is null then
    select id into v_account_gasto_id from accounts
    where company_id = v_factura.company_id and code like '6.%' order by code limit 1;
  end if;

  if v_base > 0 and v_account_gasto_id is not null then
    insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
    values (v_entry_id, v_account_gasto_id, 'Base imponible factura ' || v_factura.numero_factura, v_total - v_iva, 0);
  end if;

  -- Línea 2: Débito a IVA Crédito Fiscal
  if v_iva > 0 then
    declare
      v_iva_account_id uuid;
    begin
      -- Buscar cuenta desde invoice_tax_lines o fallback
      select distinct t.account_id into v_iva_account_id
      from invoice_tax_lines itl
      join taxes t on t.id = itl.tax_id
      where itl.invoice_type = 'proveedor' and itl.invoice_id = p_factura_id and not t.is_withholding and t.account_id is not null
      limit 1;

      if v_iva_account_id is null then
        select id into v_iva_account_id from accounts
        where company_id = v_factura.company_id and (code = '1.1.4' or name ilike '%iva%credito%')
        limit 1;
      end if;

      if v_iva_account_id is not null then
        insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
        values (v_entry_id, v_iva_account_id, 'IVA factura ' || v_factura.numero_factura, v_iva, 0);
      end if;
    end;
  end if;

  -- Línea 3: Crédito a Proveedores (total)
  if v_account_proveedor_id is not null then
    insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
    values (v_entry_id, v_account_proveedor_id, 'Proveedor: ' || v_factura.proveedor_nombre, 0, v_total);
  end if;

  return jsonb_build_object('id', v_entry_id, 'entry_number', v_entry_number);
end;
$$;

-- RPC: generar asiento contable desde factura de cliente
create or replace function generar_asiento_factura_cliente(p_factura_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_factura record;
  v_entry_id uuid;
  v_entry_number text;
  v_account_cliente_id uuid;
  v_account_ingreso_id uuid;
  v_account_iva_debito_id uuid;
  v_base numeric(12,2);
  v_iva numeric(12,2);
  v_total numeric(12,2);
  v_contact_name text;
  v_line record;
  v_items_total numeric(12,2);
begin
  select f.*, c.name as contacto_nombre, co.name as empresa_nombre
  into v_factura
  from facturas f
  left join cotizaciones ct on ct.id = f.cotizacion_id
  left join contacts c on c.id = ct.contact_id
  join companies co on co.id = f.company_id
  where f.id = p_factura_id;

  if not found then
    return jsonb_build_object('error', 'Factura no encontrada');
  end if;

  -- Buscar cuentas
  select coalesce(c.account_cliente_id, a.id) into v_account_cliente_id
  from facturas f
  left join cotizaciones ct on ct.id = f.cotizacion_id
  left join contacts c on c.id = ct.contact_id
  left join accounts a on a.company_id = f.company_id and a.code = '1.1.3'
  where f.id = p_factura_id
  limit 1;
  select id into v_account_ingreso_id from accounts
  where company_id = v_factura.company_id and (code = '4.1' or name ilike '%venta%') limit 1;
  select id into v_account_iva_debito_id from accounts
  where company_id = v_factura.company_id and (code = '2.1.2' or name ilike '%iva%debito%') limit 1;

  v_entry_number := 'AS-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));
  v_total := coalesce(v_factura.total, 0);
  v_iva := coalesce(v_factura.impuesto, 0);
  v_base := v_total - v_iva;

  -- Crear asiento
  insert into journal_entries (company_id, entry_number, entry_date, description, source_type, source_id, total_debit, total_credit, estado)
  values (v_factura.company_id, v_entry_number, now()::date,
          'Factura cliente: ' || coalesce(v_factura.numero, '') || ' - ' || coalesce(v_contact_name, ''),
          'factura_cliente', p_factura_id, v_total, v_total, 'contabilizado')
  returning id into v_entry_id;

  -- Línea 1: Débito a Clientes (total)
  if v_account_cliente_id is not null then
    insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
    values (v_entry_id, v_account_cliente_id, 'Cliente: ' || coalesce(v_contact_name, ''), v_total, 0);
  end if;

  -- Calcular suma de subtotales de items para distribución proporcional
  select coalesce(sum(ci.cantidad * ci.precio_unitario), 0) into v_items_total
  from cotizacion_items ci
  where ci.cotizacion_id = v_factura.cotizacion_id;

  -- Línea 2: Crédito a Ingresos (una línea por item, base proporcional sin IVA)
  for v_line in
    select ci.descripcion,
           (ci.cantidad * ci.precio_unitario) as subtotal,
           coalesce(ci.account_venta_id, v_account_ingreso_id) as account_id
    from cotizacion_items ci
    where ci.cotizacion_id = v_factura.cotizacion_id
  loop
    if v_line.account_id is not null and v_line.subtotal > 0 and v_items_total > 0 then
      insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
      values (v_entry_id, v_line.account_id, v_line.descripcion, 0, v_line.subtotal * v_base / v_items_total);
    end if;
  end loop;

  -- Línea 3: Crédito a IVA Débito Fiscal
  if v_account_iva_debito_id is not null and v_iva > 0 then
    insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
    values (v_entry_id, v_account_iva_debito_id, 'IVA factura ' || coalesce(v_factura.numero, ''), 0, v_iva);
  end if;

  return jsonb_build_object('id', v_entry_id, 'entry_number', v_entry_number);
end;
$$;

-- RPC: generar número de asiento manual
create or replace function generar_numero_asiento(p_company_id uuid)
returns text
language sql
stable
as $$
  select 'AS-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(
    ((select count(*) from journal_entries where company_id = p_company_id and created_at::date = now()::date) + 1)::text,
  5, '0');
$$;

-- Cuentas contables por defecto para proveedores y clientes
alter table proveedores add column if not exists account_proveedor_id uuid references accounts(id) on delete set null;
alter table contacts add column if not exists account_cliente_id uuid references accounts(id) on delete set null;

-- RPC: generar asiento contable de pago a proveedor
create or replace function generar_asiento_pago_proveedor(p_factura_id uuid, p_cuenta_banco_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_factura record;
  v_entry_id uuid;
  v_entry_number text;
  v_account_proveedor_id uuid;
  v_total numeric(12,2);
begin
  select pf.*, p.nombre as proveedor_nombre
  into v_factura
  from proveedor_facturas pf
  join proveedores p on p.id = pf.proveedor_id
  where pf.id = p_factura_id;

  if not found then return jsonb_build_object('error', 'Factura no encontrada'); end if;
  if v_factura.estado != 'pagada' then return jsonb_build_object('error', 'La factura debe estar pagada'); end if;

  select coalesce(p.account_proveedor_id, a.id) into v_account_proveedor_id
  from proveedores p
  left join accounts a on a.company_id = p.company_id and a.code = '2.1.1'
  where p.id = v_factura.proveedor_id
  limit 1;

  v_entry_number := 'AS-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));
  v_total := coalesce(v_factura.total, 0);

  insert into journal_entries (company_id, entry_number, entry_date, description, source_type, source_id, total_debit, total_credit, estado)
  values (v_factura.company_id, v_entry_number, now()::date,
          'Pago factura: ' || v_factura.numero_factura || ' - ' || v_factura.proveedor_nombre,
          'pago_proveedor', p_factura_id, v_total, v_total, 'contabilizado')
  returning id into v_entry_id;

  if v_account_proveedor_id is not null then
    insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
    values (v_entry_id, v_account_proveedor_id, 'Cancelación ' || v_factura.numero_factura, v_total, 0);
  end if;

  if p_cuenta_banco_id is not null then
    insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
    values (v_entry_id, p_cuenta_banco_id, 'Pago ' || v_factura.numero_factura, 0, v_total);
  end if;

  return jsonb_build_object('id', v_entry_id, 'entry_number', v_entry_number);
end;
$$;

-- RPC: Reporte de Balance General
create or replace function reporte_balance(p_company_id uuid, p_fecha_corte date)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'total_activo', coalesce((select sum(jel.debit - jel.credit) from journal_entry_lines jel join journal_entries je on je.id = jel.journal_entry_id join accounts a on a.id = jel.account_id where je.company_id = p_company_id and je.entry_date <= p_fecha_corte and je.estado = 'contabilizado' and a.type = 'activo'), 0),
    'total_pasivo', coalesce((select sum(jel.credit - jel.debit) from journal_entry_lines jel join journal_entries je on je.id = jel.journal_entry_id join accounts a on a.id = jel.account_id where je.company_id = p_company_id and je.entry_date <= p_fecha_corte and je.estado = 'contabilizado' and a.type = 'pasivo'), 0),
    'total_patrimonio', coalesce((select sum(jel.credit - jel.debit) from journal_entry_lines jel join journal_entries je on je.id = jel.journal_entry_id join accounts a on a.id = jel.account_id where je.company_id = p_company_id and je.entry_date <= p_fecha_corte and je.estado = 'contabilizado' and a.type in ('patrimonio', 'ingreso', 'costo', 'gasto')), 0),
    'cuentas', coalesce(jsonb_agg(
      jsonb_build_object('id', a.id, 'code', a.code, 'name', a.name, 'type', a.type, 'parent_id', a.parent_id, 'saldo', round(coalesce(s.saldo, 0), 2))
      order by a.code
    ), '[]'::jsonb)
  )
  from accounts a
  left join (
    select jel.account_id, sum(jel.debit - jel.credit) as saldo
    from journal_entry_lines jel
    join journal_entries je on je.id = jel.journal_entry_id
    where je.company_id = p_company_id and je.entry_date <= p_fecha_corte and je.estado = 'contabilizado'
    group by jel.account_id
  ) s on s.account_id = a.id
  where a.company_id = p_company_id and a.is_active = true;
$$;

-- RPC: Reporte de Resultados
create or replace function reporte_resultados(p_company_id uuid, p_desde date, p_hasta date)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'total_ingresos', coalesce((select sum(jel.credit - jel.debit) from journal_entry_lines jel join journal_entries je on je.id = jel.journal_entry_id join accounts a on a.id = jel.account_id where je.company_id = p_company_id and je.entry_date between p_desde and p_hasta and je.estado = 'contabilizado' and a.type = 'ingreso'), 0),
    'total_costos', coalesce((select sum(jel.debit - jel.credit) from journal_entry_lines jel join journal_entries je on je.id = jel.journal_entry_id join accounts a on a.id = jel.account_id where je.company_id = p_company_id and je.entry_date between p_desde and p_hasta and je.estado = 'contabilizado' and a.type = 'costo'), 0),
    'total_gastos', coalesce((select sum(jel.debit - jel.credit) from journal_entry_lines jel join journal_entries je on je.id = jel.journal_entry_id join accounts a on a.id = jel.account_id where je.company_id = p_company_id and je.entry_date between p_desde and p_hasta and je.estado = 'contabilizado' and a.type = 'gasto'), 0),
    'cuentas', coalesce(jsonb_agg(
      jsonb_build_object('id', a.id, 'code', a.code, 'name', a.name, 'type', a.type, 'parent_id', a.parent_id, 'saldo', round(coalesce(s.saldo, 0), 2))
      order by a.code
    ), '[]'::jsonb)
  )
  from accounts a
  left join (
    select jel.account_id,
      case when acc.type in ('ingreso') then sum(jel.credit - jel.debit)
           when acc.type in ('costo', 'gasto') then sum(jel.debit - jel.credit)
           else 0 end as saldo
    from journal_entry_lines jel
    join journal_entries je on je.id = jel.journal_entry_id
    join accounts acc on acc.id = jel.account_id
    where je.company_id = p_company_id and je.entry_date between p_desde and p_hasta and je.estado = 'contabilizado'
      and acc.type in ('ingreso', 'costo', 'gasto')
    group by jel.account_id, acc.type
  ) s on s.account_id = a.id
  where a.company_id = p_company_id and a.is_active = true and a.type in ('ingreso', 'costo', 'gasto');
$$;

-- RPC: Reporte de IVA
create or replace function reporte_iva(p_company_id uuid, p_desde date, p_hasta date)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'iva_debito', coalesce((select sum(itl.tax_amount) from invoice_tax_lines itl join taxes t on t.id = itl.tax_id join tax_groups tg on tg.id = t.tax_group_id where itl.company_id = p_company_id and itl.created_at::date between p_desde and p_hasta and tg.type = 'debito_fiscal'), 0),
    'iva_credito', coalesce((select sum(itl.tax_amount) from invoice_tax_lines itl join taxes t on t.id = itl.tax_id join tax_groups tg on tg.id = t.tax_group_id where itl.company_id = p_company_id and itl.created_at::date between p_desde and p_hasta and tg.type = 'credito_fiscal'), 0),
    'iva_a_pagar', coalesce((select sum(itl.tax_amount) from invoice_tax_lines itl join taxes t on t.id = itl.tax_id join tax_groups tg on tg.id = t.tax_group_id where itl.company_id = p_company_id and itl.created_at::date between p_desde and p_hasta and tg.type = 'debito_fiscal'), 0)
    - coalesce((select sum(itl.tax_amount) from invoice_tax_lines itl join taxes t on t.id = itl.tax_id join tax_groups tg on tg.id = t.tax_group_id where itl.company_id = p_company_id and itl.created_at::date between p_desde and p_hasta and tg.type = 'credito_fiscal'), 0),
    'detalle', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', d.tipo, 'tasa', d.tasa, 'monto', d.monto) order by d.tipo, d.tasa)
      from (
        select tg.type as tipo, t.name as tasa, sum(itl.tax_amount) as monto
        from invoice_tax_lines itl
        join taxes t on t.id = itl.tax_id
        join tax_groups tg on tg.id = t.tax_group_id
        where itl.company_id = p_company_id and itl.created_at::date between p_desde and p_hasta
        group by tg.type, t.name
      ) d
    ), '[]'::jsonb)
  );
$$;

-- Agregar estado 'cobrada' a facturas de cliente
alter table facturas drop constraint if exists facturas_estado_check;
alter table facturas add constraint facturas_estado_check check (estado in ('emitida', 'aprobada', 'rechazada', 'cancelada', 'cobrada'));

-- Agregar estado 'cobrada' a cotizaciones
alter table cotizaciones drop constraint if exists cotizaciones_estado_check;
alter table cotizaciones add constraint cotizaciones_estado_check check (estado in ('borrador', 'enviada', 'aceptada', 'rechazada', 'facturada', 'cobrada'));

-- Policy update para facturas
drop policy if exists "facturas_update" on facturas;
create policy "facturas_update" on facturas for update
  using (public.is_member_of(company_id));

-- RPC: generar asiento contable de cobro a cliente
create or replace function generar_asiento_pago_cliente(p_factura_id uuid, p_cuenta_banco_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_factura record;
  v_entry_id uuid;
  v_entry_number text;
  v_account_cliente_id uuid;
  v_total numeric(12,2);
  v_contact_name text;
begin
  select f.*, c.name as contacto_nombre
  into v_factura
  from facturas f
  left join cotizaciones ct on ct.id = f.cotizacion_id
  left join contacts c on c.id = ct.contact_id
  where f.id = p_factura_id;

  if not found then return jsonb_build_object('error', 'Factura no encontrada'); end if;
  if v_factura.estado != 'cobrada' then return jsonb_build_object('error', 'La factura debe estar cobrada'); end if;

  -- Cuenta del cliente (específica o genérica)
  select coalesce(c.account_cliente_id, a.id) into v_account_cliente_id
  from contacts c
  join cotizaciones ct on ct.contact_id = c.id
  left join accounts a on a.company_id = v_factura.company_id and a.code = '1.1.3'
  where ct.id = v_factura.cotizacion_id
  limit 1;

  v_entry_number := 'AS-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));
  v_total := coalesce(v_factura.total, 0);

  insert into journal_entries (company_id, entry_number, entry_date, description, source_type, source_id, total_debit, total_credit, estado)
  values (v_factura.company_id, v_entry_number, now()::date,
          'Cobro factura: ' || coalesce(v_factura.numero, '') || ' - ' || coalesce(v_contact_name, ''),
          'pago_cliente', p_factura_id, v_total, v_total, 'contabilizado')
  returning id into v_entry_id;

  -- Débito: Banco/Caja (entra el dinero)
  if p_cuenta_banco_id is not null then
    insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
    values (v_entry_id, p_cuenta_banco_id, 'Cobro ' || coalesce(v_factura.numero, ''), v_total, 0);
  end if;

  -- Crédito: Clientes (se cancela la deuda)
  if v_account_cliente_id is not null then
    insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
    values (v_entry_id, v_account_cliente_id, 'Cancelación ' || coalesce(v_factura.numero, ''), 0, v_total);
  end if;

  return jsonb_build_object('id', v_entry_id, 'entry_number', v_entry_number);
end;
$$;

-- RPC: Mayor Contable (movimientos de una cuenta en un período)
create or replace function reporte_mayor_contable(p_company_id uuid, p_account_id uuid, p_desde date, p_hasta date, p_source_type text default null)
returns jsonb
language plpgsql
stable
as $$
declare
  v_saldo_inicial numeric(12,2);
  v_movimientos jsonb;
begin
  select coalesce(sum(debit - credit), 0) into v_saldo_inicial
  from journal_entry_lines jel
  join journal_entries je on je.id = jel.journal_entry_id
  where je.company_id = p_company_id
    and jel.account_id = p_account_id
    and je.entry_date < p_desde
    and je.estado = 'contabilizado';

  select jsonb_agg(
    jsonb_build_object(
      'fecha', je.entry_date,
      'entry_number', je.entry_number,
      'entry_id', je.id,
      'descripcion', je.description,
      'debit', jel.debit,
      'credit', jel.credit,
      'source_type', je.source_type
    ) order by je.entry_date, je.id
  ) into v_movimientos
  from journal_entry_lines jel
  join journal_entries je on je.id = jel.journal_entry_id
  where je.company_id = p_company_id
    and jel.account_id = p_account_id
    and je.entry_date between p_desde and p_hasta
    and je.estado = 'contabilizado'
    and (p_source_type is null or je.source_type = p_source_type);

  return jsonb_build_object(
    'saldo_inicial', v_saldo_inicial,
    'account_id', p_account_id,
    'movimientos', coalesce(v_movimientos, '[]'::jsonb)
  );
end;
$$;


-- ============================================================
-- cuentas-pagar-cobrar-setup.sql
-- ============================================================
-- Cuentas por Pagar / Cuentas por Cobrar
-- Ejecutar después de accounting-setup.sql y facturas-proveedor-setup.sql

-- ============================================================
-- 1. Medios de pago
-- ============================================================
create table if not exists medios_pago (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table medios_pago enable row level security;
drop policy if exists "medios_pago_select" on medios_pago;
create policy "medios_pago_select" on medios_pago for select using (public.is_member_of(company_id));
drop policy if exists "medios_pago_insert" on medios_pago;
create policy "medios_pago_insert" on medios_pago for insert with check (public.is_member_of(company_id));
drop policy if exists "medios_pago_delete" on medios_pago;
create policy "medios_pago_delete" on medios_pago for delete using (public.is_member_of(company_id));

-- ============================================================
-- 2. Pagos a proveedores (AP)
-- ============================================================
create table if not exists pagos_proveedor (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  factura_id uuid not null references proveedor_facturas(id) on delete cascade,
  medio_pago_id uuid references medios_pago(id) on delete set null,
  cuenta_banco_id uuid references accounts(id) on delete set null,
  monto numeric(12,2) not null,
  fecha_pago date not null default now()::date,
  referencia text,
  notas text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table pagos_proveedor enable row level security;
drop policy if exists "pagos_proveedor_select" on pagos_proveedor;
create policy "pagos_proveedor_select" on pagos_proveedor for select using (public.is_member_of(company_id));
drop policy if exists "pagos_proveedor_insert" on pagos_proveedor;
create policy "pagos_proveedor_insert" on pagos_proveedor for insert with check (public.is_member_of(company_id));
drop policy if exists "pagos_proveedor_delete" on pagos_proveedor;
create policy "pagos_proveedor_delete" on pagos_proveedor for delete using (public.is_member_of(company_id));

create index if not exists idx_pagos_proveedor_factura on pagos_proveedor(factura_id);
create index if not exists idx_pagos_proveedor_company on pagos_proveedor(company_id);

-- ============================================================
-- 3. Cobros a clientes (AR)
-- ============================================================
create table if not exists cobros_cliente (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  factura_id uuid not null references facturas(id) on delete cascade,
  medio_pago_id uuid references medios_pago(id) on delete set null,
  cuenta_banco_id uuid references accounts(id) on delete set null,
  monto numeric(12,2) not null,
  fecha_cobro date not null default now()::date,
  referencia text,
  notas text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table cobros_cliente enable row level security;
drop policy if exists "cobros_cliente_select" on cobros_cliente;
create policy "cobros_cliente_select" on cobros_cliente for select using (public.is_member_of(company_id));
drop policy if exists "cobros_cliente_insert" on cobros_cliente;
create policy "cobros_cliente_insert" on cobros_cliente for insert with check (public.is_member_of(company_id));
drop policy if exists "cobros_cliente_delete" on cobros_cliente;
create policy "cobros_cliente_delete" on cobros_cliente for delete using (public.is_member_of(company_id));

create index if not exists idx_cobros_cliente_factura on cobros_cliente(factura_id);
create index if not exists idx_cobros_cliente_company on cobros_cliente(company_id);

-- ============================================================
-- 4. Saldo pendiente en facturas
-- ============================================================
alter table proveedor_facturas add column if not exists saldo_pendiente numeric(12,2);

alter table facturas add column if not exists saldo_pendiente numeric(12,2);

-- ============================================================
-- 5. RPC: Calendario de pagos desde facturas proveedor (reemplaza OC)
-- ============================================================
create or replace function obtener_calendario_pagos(p_company_id uuid)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'resumen', jsonb_build_object(
      'vencidas', coalesce((select sum(coalesce(saldo_pendiente, total)) from proveedor_facturas
        where company_id = p_company_id and estado not in ('pagada', 'anulada')
        and fecha_vencimiento < now()::date), 0),
      'dias7', coalesce((select sum(coalesce(saldo_pendiente, total)) from proveedor_facturas
        where company_id = p_company_id and estado not in ('pagada', 'anulada')
        and fecha_vencimiento between now()::date and now()::date + 7), 0),
      'dias15', coalesce((select sum(coalesce(saldo_pendiente, total)) from proveedor_facturas
        where company_id = p_company_id and estado not in ('pagada', 'anulada')
        and fecha_vencimiento between now()::date + 8 and now()::date + 15), 0),
      'dias30', coalesce((select sum(coalesce(saldo_pendiente, total)) from proveedor_facturas
        where company_id = p_company_id and estado not in ('pagada', 'anulada')
        and fecha_vencimiento between now()::date + 16 and now()::date + 30), 0)
    ),
    'facturas', coalesce(jsonb_agg(
      jsonb_build_object(
        'id', f.id,
        'numero_factura', f.numero_factura,
        'total', f.total,
        'saldo_pendiente', coalesce(f.saldo_pendiente, f.total),
        'moneda', f.moneda,
        'fecha_vencimiento', f.fecha_vencimiento,
        'dias_restantes', (f.fecha_vencimiento - now()::date)::int,
        'estado', f.estado,
        'proveedor', jsonb_build_object('nombre', p.nombre, 'id', p.id)
      ) order by f.fecha_vencimiento
    ) filter (where f.estado not in ('pagada', 'anulada')), '[]'::jsonb)
  )
  from proveedor_facturas f
  join proveedores p on p.id = f.proveedor_id
  where f.company_id = p_company_id
  limit 1;
$$;

-- ============================================================
-- 6. RPC: Aging AP (antigüedad de deudas con proveedores)
-- ============================================================
create or replace function obtener_aging_ap(p_company_id uuid)
returns jsonb
language plpgsql
stable
as $$
declare
  v_total_vencido numeric;
  v_total_por_vencer numeric;
  v_total_general numeric;
  v_por_proveedor jsonb;
begin
  -- Totales generales
  select
    coalesce(sum(case when f.fecha_vencimiento < now()::date then coalesce(f.saldo_pendiente, f.total) else 0 end), 0),
    coalesce(sum(case when f.fecha_vencimiento >= now()::date then coalesce(f.saldo_pendiente, f.total) else 0 end), 0),
    coalesce(sum(coalesce(f.saldo_pendiente, f.total)), 0)
  into v_total_vencido, v_total_por_vencer, v_total_general
  from proveedor_facturas f
  where f.company_id = p_company_id and f.estado not in ('pagada', 'anulada');

  -- Por proveedor
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'proveedor_id', x.id,
      'proveedor_nombre', x.nombre,
      'total', x.total,
      'vencido', x.vencido,
      'por_vencer', x.por_vencer,
      'facturas', x.facturas
    ) order by x.total desc
  ), '[]'::jsonb) into v_por_proveedor
  from (
    select p.id, p.nombre,
      sum(coalesce(f.saldo_pendiente, f.total)) as total,
      sum(case when f.fecha_vencimiento < now()::date then coalesce(f.saldo_pendiente, f.total) else 0 end) as vencido,
      sum(case when f.fecha_vencimiento >= now()::date then coalesce(f.saldo_pendiente, f.total) else 0 end) as por_vencer,
      count(*) as facturas
    from proveedor_facturas f
    join proveedores p on p.id = f.proveedor_id
    where f.company_id = p_company_id and f.estado not in ('pagada', 'anulada')
    group by p.id, p.nombre
  ) x;

  return jsonb_build_object(
    'total_vencido', v_total_vencido,
    'total_por_vencer', v_total_por_vencer,
    'total_general', v_total_general,
    'buckets', jsonb_build_object(
      'a_vencer', coalesce((select sum(coalesce(saldo_pendiente, total)) from proveedor_facturas
        where company_id = p_company_id and estado not in ('pagada', 'anulada')
        and fecha_vencimiento >= now()::date), 0),
      'vencidas_30', coalesce((select sum(coalesce(saldo_pendiente, total)) from proveedor_facturas
        where company_id = p_company_id and estado not in ('pagada', 'anulada')
        and fecha_vencimiento < now()::date and fecha_vencimiento >= now()::date - 30), 0),
      'vencidas_60', coalesce((select sum(coalesce(saldo_pendiente, total)) from proveedor_facturas
        where company_id = p_company_id and estado not in ('pagada', 'anulada')
        and fecha_vencimiento < now()::date - 30 and fecha_vencimiento >= now()::date - 60), 0),
      'vencidas_90', coalesce((select sum(coalesce(saldo_pendiente, total)) from proveedor_facturas
        where company_id = p_company_id and estado not in ('pagada', 'anulada')
        and fecha_vencimiento < now()::date - 60 and fecha_vencimiento >= now()::date - 90), 0),
      'vencidas_mas_90', coalesce((select sum(coalesce(saldo_pendiente, total)) from proveedor_facturas
        where company_id = p_company_id and estado not in ('pagada', 'anulada')
        and fecha_vencimiento < now()::date - 90), 0)
    ),
    'por_proveedor', v_por_proveedor
  );
end;
$$;

-- ============================================================
-- 7. RPC: Aging AR (antigüedad de deudas de clientes)
-- ============================================================
create or replace function obtener_aging_ar(p_company_id uuid)
returns jsonb
language plpgsql
stable
as $$
declare
  v_total_vencido numeric;
  v_total_por_vencer numeric;
  v_total_general numeric;
  v_por_cliente jsonb;
begin
  select
    coalesce(sum(case when f.fecha_vencimiento < now()::date then coalesce(f.saldo_pendiente, f.total) else 0 end), 0),
    coalesce(sum(case when f.fecha_vencimiento >= now()::date then coalesce(f.saldo_pendiente, f.total) else 0 end), 0),
    coalesce(sum(coalesce(f.saldo_pendiente, f.total)), 0)
  into v_total_vencido, v_total_por_vencer, v_total_general
  from facturas f
  join cotizaciones cot on cot.id = f.cotizacion_id
  where cot.company_id = p_company_id and f.estado = 'aprobada';

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'cliente_id', sub.id,
      'cliente_nombre', sub.nombre,
      'total', sub.total,
      'vencido', sub.vencido,
      'por_vencer', sub.por_vencer,
      'facturas', sub.cantidad
    ) order by sub.total desc
  ), '[]'::jsonb) into v_por_cliente
  from (
    select
      coalesce(c.id::text, 'sin-cliente') as id,
      coalesce(c.name, 'Sin cliente') as nombre,
      sum(coalesce(f.saldo_pendiente, f.total)) as total,
      sum(case when f.fecha_vencimiento < now()::date then coalesce(f.saldo_pendiente, f.total) else 0 end) as vencido,
      sum(case when f.fecha_vencimiento >= now()::date then coalesce(f.saldo_pendiente, f.total) else 0 end) as por_vencer,
      count(*) as cantidad
    from facturas f
    join cotizaciones cot on cot.id = f.cotizacion_id
    left join contacts c on c.id = cot.contact_id
    where cot.company_id = p_company_id and f.estado = 'aprobada'
    group by c.id, c.name
  ) sub;

  return jsonb_build_object(
    'total_vencido', v_total_vencido,
    'total_por_vencer', v_total_por_vencer,
    'total_general', v_total_general,
    'buckets', jsonb_build_object(
      'a_vencer', coalesce((select sum(coalesce(ff.saldo_pendiente, ff.total)) from facturas ff
        join cotizaciones cot on cot.id = ff.cotizacion_id
        where cot.company_id = p_company_id and ff.estado = 'aprobada' and ff.fecha_vencimiento >= now()::date), 0),
      'vencidas_30', coalesce((select sum(coalesce(ff.saldo_pendiente, ff.total)) from facturas ff
        join cotizaciones cot on cot.id = ff.cotizacion_id
        where cot.company_id = p_company_id and ff.estado = 'aprobada'
        and ff.fecha_vencimiento < now()::date and ff.fecha_vencimiento >= now()::date - 30), 0),
      'vencidas_60', coalesce((select sum(coalesce(ff.saldo_pendiente, ff.total)) from facturas ff
        join cotizaciones cot on cot.id = ff.cotizacion_id
        where cot.company_id = p_company_id and ff.estado = 'aprobada'
        and ff.fecha_vencimiento < now()::date - 30 and ff.fecha_vencimiento >= now()::date - 60), 0),
      'vencidas_90', coalesce((select sum(coalesce(ff.saldo_pendiente, ff.total)) from facturas ff
        join cotizaciones cot on cot.id = ff.cotizacion_id
        where cot.company_id = p_company_id and ff.estado = 'aprobada'
        and ff.fecha_vencimiento < now()::date - 60 and ff.fecha_vencimiento >= now()::date - 90), 0),
      'vencidas_mas_90', coalesce((select sum(coalesce(ff.saldo_pendiente, ff.total)) from facturas ff
        join cotizaciones cot on cot.id = ff.cotizacion_id
        where cot.company_id = p_company_id and ff.estado = 'aprobada' and ff.fecha_vencimiento < now()::date - 90), 0)
    ),
    'por_cliente', v_por_cliente
  );
end;
$$;


-- ============================================================
-- alertas-vencimiento-setup.sql
-- ============================================================
-- Alertas de vencimiento de documentos de proveedores
-- Ejecutar después de srm-setup.sql

create table if not exists proveedor_documentos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  proveedor_id uuid not null references proveedores(id) on delete cascade,
  nombre text not null,
  tipo_documento text not null default 'otro' check (tipo_documento in ('ruc','constancia_fiscal','seguro','habilitacion','contrato','otro')),
  fecha_emision date,
  fecha_vencimiento date,
  alerta_dias_antes integer not null default 30,
  ultima_alerta_enviada timestamptz,
  archivo_url text,
  estado text not null default 'vigente' check (estado in ('vigente','por_vencer','vencido','anulado')),
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_proveedor_documentos_company on proveedor_documentos(company_id);
create index if not exists idx_proveedor_documentos_proveedor on proveedor_documentos(proveedor_id);

-- RLS
alter table proveedor_documentos enable row level security;
drop policy if exists "proveedor_documentos_select" on proveedor_documentos;
create policy "proveedor_documentos_select" on proveedor_documentos for select using (public.is_member_of(company_id));
drop policy if exists "proveedor_documentos_insert" on proveedor_documentos;
create policy "proveedor_documentos_insert" on proveedor_documentos for insert with check (public.is_member_of(company_id));
drop policy if exists "proveedor_documentos_update" on proveedor_documentos;
create policy "proveedor_documentos_update" on proveedor_documentos for update using (public.is_member_of(company_id));
drop policy if exists "proveedor_documentos_delete" on proveedor_documentos;
create policy "proveedor_documentos_delete" on proveedor_documentos for delete using (public.is_member_of(company_id));

-- RPC: listar documentos de un proveedor
create or replace function listar_documentos_proveedor(p_proveedor_id uuid)
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', d.id,
      'nombre', d.nombre,
      'tipo_documento', d.tipo_documento,
      'fecha_emision', d.fecha_emision,
      'fecha_vencimiento', d.fecha_vencimiento,
      'alerta_dias_antes', d.alerta_dias_antes,
      'ultima_alerta_enviada', d.ultima_alerta_enviada,
      'archivo_url', d.archivo_url,
      'estado', d.estado,
      'notas', d.notas,
      'dias_restantes', case when d.fecha_vencimiento is not null then (d.fecha_vencimiento - now()::date)::int else null end,
      'created_at', d.created_at
    ) order by d.fecha_vencimiento nulls last
  ), '[]'::jsonb)
  from proveedor_documentos d
  where d.proveedor_id = p_proveedor_id;
$$;

-- RPC: alertas de vencimiento (todos los proveedores)
create or replace function alertas_vencimiento(p_company_id uuid)
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', d.id,
      'proveedor_id', d.proveedor_id,
      'proveedor_nombre', p.nombre,
      'proveedor_telefono', p.telefono,
      'nombre', d.nombre,
      'tipo_documento', d.tipo_documento,
      'fecha_vencimiento', d.fecha_vencimiento,
      'alerta_dias_antes', d.alerta_dias_antes,
      'ultima_alerta_enviada', d.ultima_alerta_enviada,
      'estado', d.estado,
      'dias_restantes', case when d.fecha_vencimiento is not null then (d.fecha_vencimiento - now()::date)::int else null end
    ) order by d.fecha_vencimiento nulls last
  ), '[]'::jsonb)
  from proveedor_documentos d
  join proveedores p on p.id = d.proveedor_id
  where d.company_id = p_company_id
    and d.estado in ('vigente', 'por_vencer')
    and d.fecha_vencimiento is not null
    and d.fecha_vencimiento <= now()::date + (d.alerta_dias_antes || ' days')::interval;
$$;


-- ============================================================
-- historial-precios-setup.sql
-- ============================================================
-- Historial de precios de productos en órdenes de compra

create or replace function productos_con_historial(p_company_id uuid)
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'producto_id', cp.id,
      'producto_nombre', cp.nombre,
      'producto_codigo', cp.codigo,
      'precio_venta', cp.precio_venta,
      'precio_compra', cp.precio_compra,
      'moneda', cp.moneda,
      'unidad_medida', cp.unidad_medida,
      'total_ocs', (select count(*) from orden_compra_items oi join ordenes_compra o on o.id = oi.orden_id where o.company_id = p_company_id and oi.producto_id = cp.id and o.estado in ('confirmada', 'recibida')),
      'ultimo_precio', (select oi.precio_unitario from orden_compra_items oi join ordenes_compra o on o.id = oi.orden_id where o.company_id = p_company_id and oi.producto_id = cp.id and o.estado in ('confirmada', 'recibida') order by o.fecha_emision desc limit 1)
    ) order by cp.nombre
  ), '[]'::jsonb)
  from catalogo_productos cp
  where cp.company_id = p_company_id
    and cp.activo = true
    and exists (select 1 from orden_compra_items oi join ordenes_compra o on o.id = oi.orden_id where o.company_id = p_company_id and oi.producto_id = cp.id and o.estado in ('confirmada', 'recibida'));
$$;

create or replace function historial_precios_producto(p_company_id uuid, p_producto_id uuid)
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'fecha', o.fecha_emision,
      'precio', oi.precio_unitario,
      'cantidad', oi.cantidad,
      'subtotal', oi.subtotal,
      'oc_id', o.id,
      'oc_numero', o.numero,
      'proveedor_id', p.id,
      'proveedor_nombre', p.nombre,
      'moneda', o.moneda
    ) order by o.fecha_emision
  ), '[]'::jsonb)
  from orden_compra_items oi
  join ordenes_compra o on o.id = oi.orden_id
  join proveedores p on p.id = o.proveedor_id
  where o.company_id = p_company_id
    and oi.producto_id = p_producto_id
    and o.estado in ('confirmada', 'recibida');
$$;


-- ============================================================
-- alternativas-setup.sql
-- ============================================================
-- Alternativas: productos por proveedor + otros proveedores que lo ofrecen

create or replace function productos_con_alternativas(p_proveedor_id uuid, p_company_id uuid)
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'producto_id', cp.id,
      'producto_nombre', cp.nombre,
      'producto_codigo', cp.codigo,
      'precio_actual', pp.precio_proveedor,
      'moneda', pp.moneda,
      'unidad_medida', cp.unidad_medida,
      'alternativas', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'proveedor_id', alt.proveedor_id,
            'proveedor_nombre', alt_p.nombre,
            'precio', alt.precio_proveedor,
            'moneda', alt.moneda
          ) order by alt.precio_proveedor
        ), '[]'::jsonb)
        from proveedor_productos alt
        join proveedores alt_p on alt_p.id = alt.proveedor_id
        where alt.producto_id = cp.id
          and alt.proveedor_id != p_proveedor_id
          and alt_p.company_id = p_company_id
          and alt_p.estado = 'activo'
      )
    ) order by cp.nombre
  ), '[]'::jsonb)
  from proveedor_productos pp
  join catalogo_productos cp on cp.id = pp.producto_id
  where pp.proveedor_id = p_proveedor_id
    and cp.company_id = p_company_id;
$$;


-- ============================================================
-- whatsapp-setup.sql
-- ============================================================
-- WhatsApp integration for CRM
-- Ejecutar después de crm-setup.sql

-- 1. Agregar 'whatsapp' como tipo válido de actividad
alter table activities drop constraint if exists activities_type_check;
alter table activities add constraint activities_type_check
  check (type in ('call', 'email', 'meeting', 'note', 'task', 'whatsapp'));

-- 2. Tabla de auditoría de mensajes WhatsApp
create table if not exists notificaciones_whatsapp (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  telefono text not null,
  mensaje text not null,
  twilio_sid text,
  estado text not null default 'enviado',
  error text,
  created_at timestamptz not null default now()
);

alter table notificaciones_whatsapp enable row level security;

drop policy if exists "notificaciones_whatsapp_select" on notificaciones_whatsapp;
create policy "notificaciones_whatsapp_select"
  on notificaciones_whatsapp for select
  using (public.is_member_of(company_id));

drop policy if exists "notificaciones_whatsapp_insert" on notificaciones_whatsapp;
create policy "notificaciones_whatsapp_insert"
  on notificaciones_whatsapp for insert
  with check (public.is_member_of(company_id));

create index if not exists idx_notificaciones_whatsapp_company
  on notificaciones_whatsapp (company_id, created_at desc);

-- 3. Columna proveedor_id para mensajes vinculados a proveedores
alter table notificaciones_whatsapp add column if not exists proveedor_id uuid references proveedores(id) on delete set null;
create index if not exists idx_notificaciones_whatsapp_proveedor on notificaciones_whatsapp(proveedor_id);

-- 4. Función auxiliar para webhook: busca contacto o proveedor por teléfono
create or replace function buscar_por_telefono(p_telefono text)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'contacto', (select jsonb_build_object('id', id, 'company_id', company_id) from contacts where phone = p_telefono or phone ilike '%' || right(p_telefono, 10) limit 1),
    'proveedor', (select jsonb_build_object('id', id, 'company_id', company_id) from proveedores where telefono = p_telefono limit 1)
  );
$$;


-- ============================================================
-- inventario-setup.sql
-- ============================================================
-- Módulo de Inventario (@saas/inventario)
-- Ejecutar después de srm-setup.sql y accounting-setup.sql

-- Centros logísticos
create table if not exists centros_logisticos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  nombre text not null,
  direccion text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_centros_company on centros_logisticos(company_id);

-- Almacenes dentro de cada centro
create table if not exists almacenes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  centro_id uuid not null references centros_logisticos(id) on delete cascade,
  nombre text not null,
  tipo text not null default 'general' check (tipo in ('general', 'refrigerado', 'congelado', 'peligroso', 'cuarentena')),
  direccion text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_almacenes_company on almacenes(company_id);
create index if not exists idx_almacenes_centro on almacenes(centro_id);

-- Stock actual por producto + almacén
create table if not exists producto_stock (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  producto_id uuid not null references catalogo_productos(id) on delete cascade,
  almacen_id uuid not null references almacenes(id) on delete cascade,
  cantidad numeric(12,2) not null default 0,
  costo_promedio numeric(12,2) not null default 0,
  stock_minimo numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, producto_id, almacen_id)
);

create index if not exists idx_producto_stock_company on producto_stock(company_id);
create index if not exists idx_producto_stock_producto on producto_stock(producto_id);
create index if not exists idx_producto_stock_almacen on producto_stock(almacen_id);

-- Historial de movimientos
create table if not exists movimientos_stock (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  producto_id uuid not null references catalogo_productos(id) on delete cascade,
  almacen_id uuid not null references almacenes(id) on delete cascade,
  tipo text not null check (tipo in ('entrada', 'salida', 'ajuste')),
  cantidad numeric(12,2) not null,
  costo_unitario numeric(12,2),
  lote text,
  fecha_vencimiento date,
  referencia_type text,
  referencia_id uuid,
  motivo text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_movimientos_company on movimientos_stock(company_id);
create index if not exists idx_movimientos_producto on movimientos_stock(producto_id);
create index if not exists idx_movimientos_almacen on movimientos_stock(almacen_id);

-- RLS
alter table centros_logisticos enable row level security;
alter table almacenes enable row level security;
alter table producto_stock enable row level security;
alter table movimientos_stock enable row level security;

drop policy if exists "centros_select" on centros_logisticos;
create policy "centros_select" on centros_logisticos for select using (public.is_member_of(company_id));
drop policy if exists "centros_insert" on centros_logisticos;
create policy "centros_insert" on centros_logisticos for insert with check (public.is_member_of(company_id));
drop policy if exists "centros_update" on centros_logisticos;
create policy "centros_update" on centros_logisticos for update using (public.is_member_of(company_id));
drop policy if exists "centros_delete" on centros_logisticos;
create policy "centros_delete" on centros_logisticos for delete using (public.is_member_of(company_id));

drop policy if exists "almacenes_select" on almacenes;
create policy "almacenes_select" on almacenes for select using (public.is_member_of(company_id));
drop policy if exists "almacenes_insert" on almacenes;
create policy "almacenes_insert" on almacenes for insert with check (public.is_member_of(company_id));
drop policy if exists "almacenes_update" on almacenes;
create policy "almacenes_update" on almacenes for update using (public.is_member_of(company_id));
drop policy if exists "almacenes_delete" on almacenes;
create policy "almacenes_delete" on almacenes for delete using (public.is_member_of(company_id));

drop policy if exists "producto_stock_select" on producto_stock;
create policy "producto_stock_select" on producto_stock for select using (public.is_member_of(company_id));
drop policy if exists "producto_stock_insert" on producto_stock;
create policy "producto_stock_insert" on producto_stock for insert with check (public.is_member_of(company_id));
drop policy if exists "producto_stock_update" on producto_stock;
create policy "producto_stock_update" on producto_stock for update using (public.is_member_of(company_id));

drop policy if exists "movimientos_stock_select" on movimientos_stock;
create policy "movimientos_stock_select" on movimientos_stock for select using (public.is_member_of(company_id));
drop policy if exists "movimientos_stock_insert" on movimientos_stock;
create policy "movimientos_stock_insert" on movimientos_stock for insert with check (public.is_member_of(company_id));

-- Stock mínimo global por producto
alter table catalogo_productos add column if not exists stock_minimo numeric(12,2) not null default 0;

-- Conteos cíclicos / inventario físico
create table if not exists conteos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  almacen_id uuid not null references almacenes(id),
  numero text not null,
  fecha date not null default now(),
  estado text not null default 'abierto' check (estado in ('abierto', 'contando', 'cerrado')),
  observaciones text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_conteos_company on conteos(company_id);

create table if not exists conteo_items (
  id uuid primary key default gen_random_uuid(),
  conteo_id uuid not null references conteos(id) on delete cascade,
  producto_id uuid not null references catalogo_productos(id),
  lote text,
  cantidad_sistema numeric(12,2) not null default 0,
  cantidad_contada numeric(12,2),
  diferencia numeric(12,2) not null default 0,
  unique(conteo_id, producto_id)
);

alter table conteos enable row level security;
alter table conteo_items enable row level security;

drop policy if exists "conteos_select" on conteos;
create policy "conteos_select" on conteos for select using (public.is_member_of(company_id));
drop policy if exists "conteos_insert" on conteos;
create policy "conteos_insert" on conteos for insert with check (public.is_member_of(company_id));
drop policy if exists "conteos_update" on conteos;
create policy "conteos_update" on conteos for update using (public.is_member_of(company_id));
drop policy if exists "conteos_delete" on conteos;
create policy "conteos_delete" on conteos for delete using (public.is_member_of(company_id));

drop policy if exists "conteo_items_select" on conteo_items;
create policy "conteo_items_select" on conteo_items for select using (exists (select 1 from conteos c where c.id = conteo_id and public.is_member_of(c.company_id)));
drop policy if exists "conteo_items_insert" on conteo_items;
create policy "conteo_items_insert" on conteo_items for insert with check (exists (select 1 from conteos c where c.id = conteo_id and public.is_member_of(c.company_id)));
drop policy if exists "conteo_items_update" on conteo_items;
create policy "conteo_items_update" on conteo_items for update using (exists (select 1 from conteos c where c.id = conteo_id and public.is_member_of(c.company_id)));

-- RPC: generar número de conteo
create or replace function generar_numero_conteo(p_company_id uuid)
returns text
language sql
stable
as $$
  select 'CT-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(
    ((select count(*) from conteos where company_id = p_company_id and created_at::date = now()::date) + 1)::text,
  4, '0');
$$;

-- Código de barras en productos
alter table catalogo_productos add column if not exists codigo_barras text;

-- Ubicaciones dentro de almacenes
create table if not exists ubicaciones (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  almacen_id uuid not null references almacenes(id) on delete cascade,
  nombre text not null,
  pasillo text,
  estante text,
  posicion text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique(company_id, almacen_id, nombre)
);

create index if not exists idx_ubicaciones_almacen on ubicaciones(almacen_id);

alter table ubicaciones enable row level security;
drop policy if exists "ubicaciones_select" on ubicaciones;
create policy "ubicaciones_select" on ubicaciones for select using (public.is_member_of(company_id));
drop policy if exists "ubicaciones_insert" on ubicaciones;
create policy "ubicaciones_insert" on ubicaciones for insert with check (public.is_member_of(company_id));
drop policy if exists "ubicaciones_update" on ubicaciones;
create policy "ubicaciones_update" on ubicaciones for update using (public.is_member_of(company_id));
drop policy if exists "ubicaciones_delete" on ubicaciones;
create policy "ubicaciones_delete" on ubicaciones for delete using (public.is_member_of(company_id));

-- Ubicación en stock
alter table producto_stock add column if not exists ubicacion_id uuid references ubicaciones(id) on delete set null;

-- Transportistas
create table if not exists transportistas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  nombre text not null,
  ruc text,
  telefono text,
  contacto text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_transportistas_company on transportistas(company_id);

alter table transportistas enable row level security;
drop policy if exists "transportistas_select" on transportistas;
create policy "transportistas_select" on transportistas for select using (public.is_member_of(company_id));
drop policy if exists "transportistas_insert" on transportistas;
create policy "transportistas_insert" on transportistas for insert with check (public.is_member_of(company_id));
drop policy if exists "transportistas_update" on transportistas;
create policy "transportistas_update" on transportistas for update using (public.is_member_of(company_id));
drop policy if exists "transportistas_delete" on transportistas;
create policy "transportistas_delete" on transportistas for delete using (public.is_member_of(company_id));

-- Órdenes de picking
create table if not exists picking_ordenes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  factura_id uuid references facturas(id) on delete set null,
  numero text not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'preparando', 'preparado', 'despachado')),
  creado_por uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_picking_company on picking_ordenes(company_id);

create table if not exists picking_items (
  id uuid primary key default gen_random_uuid(),
  picking_id uuid not null references picking_ordenes(id) on delete cascade,
  producto_id uuid not null references catalogo_productos(id),
  cantidad_solicitada numeric(12,2) not null default 0,
  cantidad_preparada numeric(12,2) not null default 0,
  ubicacion_id uuid references ubicaciones(id) on delete set null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'listo')),
  unique(picking_id, producto_id)
);

alter table picking_ordenes enable row level security;
alter table picking_items enable row level security;

drop policy if exists "picking_ordenes_select" on picking_ordenes;
create policy "picking_ordenes_select" on picking_ordenes for select using (public.is_member_of(company_id));
drop policy if exists "picking_ordenes_insert" on picking_ordenes;
create policy "picking_ordenes_insert" on picking_ordenes for insert with check (public.is_member_of(company_id));
drop policy if exists "picking_ordenes_update" on picking_ordenes;
create policy "picking_ordenes_update" on picking_ordenes for update using (public.is_member_of(company_id));

drop policy if exists "picking_items_select" on picking_items;
create policy "picking_items_select" on picking_items for select using (exists (select 1 from picking_ordenes po where po.id = picking_id and public.is_member_of(po.company_id)));
drop policy if exists "picking_items_insert" on picking_items;
create policy "picking_items_insert" on picking_items for insert with check (exists (select 1 from picking_ordenes po where po.id = picking_id and public.is_member_of(po.company_id)));
drop policy if exists "picking_items_update" on picking_items;
create policy "picking_items_update" on picking_items for update using (exists (select 1 from picking_ordenes po where po.id = picking_id and public.is_member_of(po.company_id)));

-- Remitos
create table if not exists remitos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  picking_id uuid references picking_ordenes(id) on delete set null,
  factura_id uuid references facturas(id) on delete set null,
  numero text not null,
  fecha date not null default now(),
  transportista_id uuid references transportistas(id) on delete set null,
  chofer text,
  patente text,
  destino text,
  created_at timestamptz not null default now()
);

create index if not exists idx_remitos_company on remitos(company_id);

alter table remitos enable row level security;
drop policy if exists "remitos_select" on remitos;
create policy "remitos_select" on remitos for select using (public.is_member_of(company_id));
drop policy if exists "remitos_insert" on remitos;
create policy "remitos_insert" on remitos for insert with check (public.is_member_of(company_id));

-- RPC número de picking
create or replace function generar_numero_picking(p_company_id uuid)
returns text
language sql
stable
as $$
  select 'PK-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(
    ((select count(*) from picking_ordenes where company_id = p_company_id and created_at::date = now()::date) + 1)::text, 4, '0');
$$;

-- RPC número de remito
create or replace function generar_numero_remito(p_company_id uuid)
returns text
language sql
stable
as $$
  select 'RE-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(
    ((select count(*) from remitos where company_id = p_company_id and created_at::date = now()::date) + 1)::text, 4, '0');
$$;


-- ============================================================
-- ajuste-inventario-setup.sql
-- ============================================================
-- Asiento automático de ajuste de inventario (diferencia de conteo)
-- Ejecutar después de accounting-setup.sql e inventario-setup.sql

-- Referencia al asiento contable en el conteo
alter table conteos add column if not exists asiento_id uuid references journal_entries(id) on delete set null;

alter table journal_entries drop constraint if exists journal_entries_source_type_check;
alter table journal_entries add constraint journal_entries_source_type_check
  check (source_type in ('factura_proveedor', 'factura_cliente', 'pago_proveedor', 'pago_cliente', 'ajuste_inventario', 'manual'));

create or replace function generar_asiento_ajuste_inventario(p_conteo_id uuid, p_fecha date default current_date)
returns jsonb
language plpgsql
as $$
declare
  v_conteo record;
  v_item record;
  v_entry_id uuid;
  v_entry_number text;
  v_total_debit numeric(12,2) := 0;
  v_total_credit numeric(12,2) := 0;
  v_inventario_account_id uuid;
  v_ajuste_account_id uuid;
  v_costo_total numeric(12,2);
  v_valor numeric(12,2);
begin
  -- Obtener conteo
  select c.*, a.nombre as almacen_nombre
  into v_conteo
  from conteos c
  left join almacenes a on a.id = c.almacen_id
  where c.id = p_conteo_id;

  if not found then
    return jsonb_build_object('error', 'Conteo no encontrado');
  end if;

  -- Buscar cuentas contables
  select id into v_inventario_account_id from accounts
  where company_id = v_conteo.company_id and code = '1.1.5' limit 1;

  select id into v_ajuste_account_id from accounts
  where company_id = v_conteo.company_id and code = '6.4' limit 1;

  if v_inventario_account_id is null then
    return jsonb_build_object('error', 'Cuenta de Inventario (1.1.5) no encontrada. Ejecutá la seed de cuentas en Configuración > Plan de Cuentas.');
  end if;

  if v_ajuste_account_id is null then
    return jsonb_build_object('error', 'Cuenta de Ajuste de Inventario (6.4) no encontrada. Ejecutá la seed de cuentas en Configuración > Plan de Cuentas.');
  end if;

  -- Calcular total de ajuste (diferencia × costo_promedio)
  -- Primero verificar si hay diferencias
  select coalesce(sum(abs(ci.diferencia) * coalesce(ps.costo_promedio, 0)), 0)
  into v_costo_total
  from conteo_items ci
  left join producto_stock ps on ps.producto_id = ci.producto_id and ps.almacen_id = v_conteo.almacen_id
  where ci.conteo_id = p_conteo_id and ci.diferencia != 0;

  if v_costo_total = 0 then
    return jsonb_build_object('error', 'No hay diferencias para ajustar');
  end if;

  -- Generar número de asiento
  v_entry_number := 'AS-INV-' || to_char(p_fecha, 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));

  -- Crear asiento (una sola línea de débito y una de crédito con el total)
  insert into journal_entries (company_id, entry_number, entry_date, description, source_type, source_id, total_debit, total_credit, estado)
  values (
    v_conteo.company_id, v_entry_number, p_fecha,
    'Ajuste inventario: ' || v_conteo.numero || ' (' || v_conteo.almacen_nombre || ')',
    'ajuste_inventario', p_conteo_id, v_costo_total, v_costo_total, 'contabilizado'
  )
  returning id into v_entry_id;

  -- Insertar líneas por cada item con diferencia
  for v_item in
    select ci.*, cp.nombre as producto_nombre, coalesce(ps.costo_promedio, 0) as costo_promedio
    from conteo_items ci
    join catalogo_productos cp on cp.id = ci.producto_id
    left join producto_stock ps on ps.producto_id = ci.producto_id and ps.almacen_id = v_conteo.almacen_id
    where ci.conteo_id = p_conteo_id and ci.diferencia != 0
  loop
    v_valor := abs(v_item.diferencia) * v_item.costo_promedio;
    if v_valor = 0 then continue; end if;

    if v_item.diferencia > 0 then
      -- Sobra: Débito a Inventario, Crédito a Ajuste
      insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
      values (v_entry_id, v_inventario_account_id, v_item.producto_nombre || ' (+' || v_item.diferencia || ')', v_valor, 0);
      insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
      values (v_entry_id, v_ajuste_account_id, v_item.producto_nombre || ' (+' || v_item.diferencia || ')', 0, v_valor);
    else
      -- Falta: Débito a Ajuste, Crédito a Inventario
      insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
      values (v_entry_id, v_ajuste_account_id, v_item.producto_nombre || ' (' || v_item.diferencia || ')', v_valor, 0);
      insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
      values (v_entry_id, v_inventario_account_id, v_item.producto_nombre || ' (' || v_item.diferencia || ')', 0, v_valor);
    end if;
  end loop;

  return jsonb_build_object('id', v_entry_id, 'entry_number', v_entry_number);
end;
$$;


-- ============================================================
-- conciliacion-setup.sql
-- ============================================================
-- Conciliación bancaria
-- Ejecutar después de accounting-setup.sql y cuentas-pagar-cobrar-setup.sql

-- 1. Datos bancarios en cuentas contables
alter table accounts add column if not exists banco_nombre text;
alter table accounts add column if not exists numero_cuenta text;
alter table accounts add column if not exists tipo_cuenta text check (tipo_cuenta in ('corriente', 'ahorro')) not null default 'corriente';

-- 2. Extractos bancarios (líneas cargadas del banco)
create table if not exists extractos_bancarios (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  fecha date not null,
  concepto text not null,
  monto numeric(12,2) not null,
  referencia text,
  conciliado boolean not null default false,
  created_at timestamptz not null default now()
);

alter table extractos_bancarios enable row level security;
drop policy if exists "extractos_select" on extractos_bancarios;
create policy "extractos_select" on extractos_bancarios for select using (public.is_member_of(company_id));
drop policy if exists "extractos_insert" on extractos_bancarios;
create policy "extractos_insert" on extractos_bancarios for insert with check (public.is_member_of(company_id));
drop policy if exists "extractos_update" on extractos_bancarios;
create policy "extractos_update" on extractos_bancarios for update using (public.is_member_of(company_id));
drop policy if exists "extractos_delete" on extractos_bancarios;
create policy "extractos_delete" on extractos_bancarios for delete using (public.is_member_of(company_id));

create index if not exists idx_extractos_cuenta on extractos_bancarios(account_id, fecha);

-- 3. Conciliaciones
create table if not exists conciliaciones (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  periodo_inicio date not null,
  periodo_fin date not null,
  saldo_inicial_extracto numeric(12,2) not null default 0,
  saldo_final_extracto numeric(12,2) not null default 0,
  saldo_inicial_libro numeric(12,2) not null default 0,
  saldo_final_libro numeric(12,2) not null default 0,
  estado text not null default 'abierta' check (estado in ('abierta', 'conciliada', 'cerrada')),
  created_at timestamptz not null default now()
);

alter table conciliaciones enable row level security;
drop policy if exists "conciliaciones_select" on conciliaciones;
create policy "conciliaciones_select" on conciliaciones for select using (public.is_member_of(company_id));
drop policy if exists "conciliaciones_insert" on conciliaciones;
create policy "conciliaciones_insert" on conciliaciones for insert with check (public.is_member_of(company_id));
drop policy if exists "conciliaciones_update" on conciliaciones;
create policy "conciliaciones_update" on conciliaciones for update using (public.is_member_of(company_id));
drop policy if exists "conciliaciones_delete" on conciliaciones;
create policy "conciliaciones_delete" on conciliaciones for delete using (public.is_member_of(company_id));

-- 4. Relación extracto → conciliación
alter table extractos_bancarios add column if not exists conciliacion_id uuid references conciliaciones(id) on delete set null;

-- 5. RPC: obtener transacciones del libro para conciliar
create or replace function obtener_transacciones_libro(p_account_id uuid, p_desde date, p_hasta date)
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'fuente', 'pago_proveedor',
      'id', pp.id,
      'fecha', pp.fecha_pago,
      'concepto', concat('Pago a ', pr.nombre),
      'monto', -pp.monto,
      'referencia', pp.referencia
    )
  ) filter (where pr.nombre is not null), '[]'::jsonb)
  from pagos_proveedor pp
  left join proveedor_facturas pf on pf.id = pp.factura_id
  left join proveedores pr on pr.id = pf.proveedor_id
  where pp.cuenta_banco_id = p_account_id
    and pp.fecha_pago >= p_desde and pp.fecha_pago <= p_hasta
$$;

-- 6. RPC: calcular saldo contable al cierre
create or replace function calcular_saldo_libro(p_account_id uuid, p_hasta date)
returns numeric
language sql
stable
as $$
  select coalesce((
    select sum(jel.debit) - sum(jel.credit)
    from journal_entry_lines jel
    join journal_entries je on je.id = jel.journal_entry_id
    where jel.account_id = p_account_id
      and je.estado = 'contabilizado'
      and je.entry_date <= p_hasta
  ), 0)
$$;


-- ============================================================
-- calendario-cierre-setup.sql
-- ============================================================
-- Calendario de cierre contable por empresa
-- Ejecutar después de accounting-setup.sql

create table if not exists cierres_contables (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  periodo text not null,
  estado text not null default 'abierto' check (estado in ('abierto', 'cerrado', 'reabierto')),
  cerrado_por uuid references auth.users(id) on delete set null,
  cerrado_en timestamptz,
  created_at timestamptz not null default now(),
  unique(company_id, periodo)
);

alter table cierres_contables enable row level security;
drop policy if exists "cierres_select" on cierres_contables;
create policy "cierres_select" on cierres_contables for select using (public.is_member_of(company_id));
drop policy if exists "cierres_insert" on cierres_contables;
create policy "cierres_insert" on cierres_contables for insert with check (public.is_member_of(company_id));
drop policy if exists "cierres_update" on cierres_contables;
create policy "cierres_update" on cierres_contables for update using (public.is_member_of(company_id));


-- ============================================================
-- tipos-cambio-setup.sql
-- ============================================================
-- Tipos de cambio para conversión de moneda
-- Ejecutar después de accounting-setup.sql

create table if not exists tipos_cambio (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  moneda_origen text not null,
  moneda_destino text not null default 'PYG',
  tasa numeric(12,6) not null,
  fecha date not null default now()::date,
  unique(company_id, moneda_origen, moneda_destino, fecha)
);

alter table tipos_cambio enable row level security;
drop policy if exists "tipos_cambio_select" on tipos_cambio;
create policy "tipos_cambio_select" on tipos_cambio for select using (public.is_member_of(company_id));
drop policy if exists "tipos_cambio_insert" on tipos_cambio;
create policy "tipos_cambio_insert" on tipos_cambio for insert with check (public.is_member_of(company_id));
drop policy if exists "tipos_cambio_delete" on tipos_cambio;
create policy "tipos_cambio_delete" on tipos_cambio for delete using (public.is_member_of(company_id));

-- RPC: obtener tasa de cambio a una fecha
create or replace function obtener_tasa_cambio(p_company_id uuid, p_origen text, p_destino text, p_fecha date)
returns numeric
language sql
stable
as $$
  select coalesce(
    (select tasa from tipos_cambio
     where company_id = p_company_id and moneda_origen = p_origen and moneda_destino = p_destino
       and fecha <= p_fecha
     order by fecha desc limit 1),
    1
  )
$$;


-- ============================================================
-- flujo-efectivo-setup.sql
-- ============================================================
-- Reporte de Flujo de Efectivo (método indirecto simplificado)
-- Ejecutar después de accounting-setup.sql

create or replace function reporte_flujo_efectivo(p_company_id uuid, p_desde date, p_hasta date)
returns jsonb
language plpgsql
stable
as $$
declare
  v_resultado_neto numeric;
  v_ingresos numeric;
  v_costos_gastos numeric;
  v_var_ctas_cobrar numeric;
  v_var_ctas_pagar numeric;
  v_var_inventario numeric;
  v_depreciacion numeric;
  v_flujo_operativo numeric;
begin
  -- Resultado neto del período
  select coalesce(sum(jel.credit - jel.debit), 0) into v_ingresos
  from journal_entry_lines jel
  join journal_entries je on je.id = jel.journal_entry_id
  join accounts a on a.id = jel.account_id
  where je.company_id = p_company_id and je.entry_date between p_desde and p_hasta
    and je.estado = 'contabilizado' and a.type = 'ingreso';

  select coalesce(sum(jel.debit - jel.credit), 0) into v_costos_gastos
  from journal_entry_lines jel
  join journal_entries je on je.id = jel.journal_entry_id
  join accounts a on a.id = jel.account_id
  where je.company_id = p_company_id and je.entry_date between p_desde and p_hasta
    and je.estado = 'contabilizado' and a.type in ('costo', 'gasto');

  v_resultado_neto := v_ingresos - v_costos_gastos;

  -- Variación de cuentas por cobrar (1.1.3) = saldo inicio - saldo fin
  -- Si la variación es negativa, aumentaron las cuentas por cobrar (usó efectivo)
  with saldos as (
    select a.id, a.code,
      coalesce(sum(case when je.entry_date < p_desde then jel.debit - jel.credit else 0 end), 0) as saldo_inicial,
      coalesce(sum(case when je.entry_date <= p_hasta then jel.debit - jel.credit else 0 end), 0) as saldo_final
    from accounts a
    join journal_entry_lines jel on jel.account_id = a.id
    join journal_entries je on je.id = jel.journal_entry_id
    where je.company_id = p_company_id and je.estado = 'contabilizado' and a.code = '1.1.3'
    group by a.id, a.code
  )
  select coalesce(saldo_final - saldo_inicial, 0) into v_var_ctas_cobrar from saldos limit 1;

  -- Variación de proveedores (2.1.1)
  with saldos as (
    select a.id, a.code,
      coalesce(sum(case when je.entry_date < p_desde then jel.credit - jel.debit else 0 end), 0) as saldo_inicial,
      coalesce(sum(case when je.entry_date <= p_hasta then jel.credit - jel.debit else 0 end), 0) as saldo_final
    from accounts a
    join journal_entry_lines jel on jel.account_id = a.id
    join journal_entries je on je.id = jel.journal_entry_id
    where je.company_id = p_company_id and je.estado = 'contabilizado' and a.code = '2.1.1'
    group by a.id, a.code
  )
  select coalesce(saldo_final - saldo_inicial, 0) into v_var_ctas_pagar from saldos limit 1;

  -- Variación de inventario (1.1.5)
  with saldos as (
    select a.id, a.code,
      coalesce(sum(case when je.entry_date < p_desde then jel.debit - jel.credit else 0 end), 0) as saldo_inicial,
      coalesce(sum(case when je.entry_date <= p_hasta then jel.debit - jel.credit else 0 end), 0) as saldo_final
    from accounts a
    join journal_entry_lines jel on jel.account_id = a.id
    join journal_entries je on je.id = jel.journal_entry_id
    where je.company_id = p_company_id and je.estado = 'contabilizado' and a.code = '1.1.5'
    group by a.id, a.code
  )
  select coalesce(saldo_final - saldo_inicial, 0) into v_var_inventario from saldos limit 1;

  -- Depreciación aproximada (cuentas 6.x con 'depreciacion' en el nombre)
  select coalesce(sum(jel.debit - jel.credit), 0) into v_depreciacion
  from journal_entry_lines jel
  join journal_entries je on je.id = jel.journal_entry_id
  join accounts a on a.id = jel.account_id
  where je.company_id = p_company_id and je.entry_date between p_desde and p_hasta
    and je.estado = 'contabilizado' and a.type = 'gasto' and a.name ilike '%depreciacion%';

  v_flujo_operativo := v_resultado_neto + v_depreciacion - v_var_ctas_cobrar + v_var_ctas_pagar - v_var_inventario;

  return jsonb_build_object(
    'resultado_neto', v_resultado_neto,
    'depreciacion', v_depreciacion,
    'var_ctas_cobrar', -v_var_ctas_cobrar,
    'var_ctas_pagar', v_var_ctas_pagar,
    'var_inventario', -v_var_inventario,
    'flujo_operativo', v_flujo_operativo,
    'detalle', jsonb_build_array(
      jsonb_build_object('concepto', 'Resultado Neto', 'monto', v_resultado_neto, 'tipo', 'resultado'),
      jsonb_build_object('concepto', 'Depreciación / Amortización', 'monto', v_depreciacion, 'tipo', 'ajuste'),
      jsonb_build_object('concepto', 'Variación Cuentas por Cobrar', 'monto', -v_var_ctas_cobrar, 'tipo', 'capital_trabajo'),
      jsonb_build_object('concepto', 'Variación Cuentas por Pagar', 'monto', v_var_ctas_pagar, 'tipo', 'capital_trabajo'),
      jsonb_build_object('concepto', 'Variación Inventario', 'monto', -v_var_inventario, 'tipo', 'capital_trabajo'),
      jsonb_build_object('concepto', 'Flujo de Efectivo Operativo', 'monto', v_flujo_operativo, 'tipo', 'total')
    )
  );
end;
$$;


-- ============================================================
-- consolidacion-setup.sql
-- ============================================================
-- Consolidación de sucursales
-- Ejecutar después de accounting-setup.sql y sucursales-setup.sql

-- 1. Columna para agrupar empresas
alter table companies add column if not exists parent_company_id uuid references companies(id);
create index if not exists idx_companies_parent on companies(parent_company_id);

-- 2. Seed: vincular empresas con mismo RIF (para empresas existentes)
update companies c
set parent_company_id = (select id from companies where rif = c.rif and id != c.id order by created_at limit 1)
where c.parent_company_id is null
  and exists (select 1 from companies where rif = c.rif and id != c.id);

-- 3. RPC: obtener IDs de todas las empresas del grupo
create or replace function empresas_del_grupo(p_company_id uuid)
returns uuid[]
language sql
stable
as $$
  select array(
    select id from companies
    where id = p_company_id
       or parent_company_id = p_company_id
       or (parent_company_id is not null and parent_company_id = (select parent_company_id from companies where id = p_company_id))
  )
$$;

-- 4. RPC: Balance General Consolidado
create or replace function consolidar_balance(p_company_id uuid)
returns jsonb
language sql
stable
as $$
  with grupo as (
    select unnest(empresas_del_grupo(p_company_id)) as cid
  ),
  saldos as (
    select a.id, a.code, a.name, a.type,
      sum(jel.debit - jel.credit) as saldo
    from accounts a
    join journal_entry_lines jel on jel.account_id = a.id
    join journal_entries je on je.id = jel.journal_entry_id
    join grupo on grupo.cid = a.company_id
    where a.type in ('activo', 'pasivo', 'patrimonio') and je.estado = 'contabilizado'
    group by a.id, a.code, a.name, a.type
  )
  select jsonb_build_object(
    'activo', coalesce((select jsonb_agg(jsonb_build_object('code', s.code, 'name', s.name, 'saldo', s.saldo) order by s.code) from saldos s where s.type = 'activo'), '[]'::jsonb),
    'pasivo', coalesce((select jsonb_agg(jsonb_build_object('code', s.code, 'name', s.name, 'saldo', s.saldo) order by s.code) from saldos s where s.type = 'pasivo'), '[]'::jsonb),
    'patrimonio', coalesce((select jsonb_agg(jsonb_build_object('code', s.code, 'name', s.name, 'saldo', s.saldo) order by s.code) from saldos s where s.type = 'patrimonio'), '[]'::jsonb)
  )
$$;

-- 5. RPC: Estado de Resultados Consolidado
create or replace function consolidar_resultados(p_company_id uuid)
returns jsonb
language sql
stable
as $$
  with grupo as (
    select unnest(empresas_del_grupo(p_company_id)) as cid
  ),
  saldos as (
    select a.id, a.code, a.name, a.type,
      case when a.type = 'ingreso' then sum(jel.credit - jel.debit)
           else sum(jel.debit - jel.credit)
      end as saldo
    from accounts a
    join journal_entry_lines jel on jel.account_id = a.id
    join journal_entries je on je.id = jel.journal_entry_id
    join grupo on grupo.cid = a.company_id
    where a.type in ('ingreso', 'costo', 'gasto') and je.estado = 'contabilizado'
    group by a.id, a.code, a.name, a.type
  )
  select jsonb_build_object(
    'ingresos', coalesce((select jsonb_agg(jsonb_build_object('code', s.code, 'name', s.name, 'saldo', s.saldo) order by s.code) from saldos s where s.type = 'ingreso'), '[]'::jsonb),
    'costos', coalesce((select jsonb_agg(jsonb_build_object('code', s.code, 'name', s.name, 'saldo', s.saldo) order by s.code) from saldos s where s.type = 'costo'), '[]'::jsonb),
    'gastos', coalesce((select jsonb_agg(jsonb_build_object('code', s.code, 'name', s.name, 'saldo', s.saldo) order by s.code) from saldos s where s.type = 'gasto'), '[]'::jsonb)
  )
$$;

-- 6. RPC: Antigüedad AP/AR Consolidada
create or replace function consolidar_aging_ap(p_company_id uuid)
returns jsonb
language sql
stable
as $$
  with grupo as (
    select unnest(empresas_del_grupo(p_company_id)) as cid
  )
  select jsonb_build_object(
    'total', coalesce(sum(coalesce(f.saldo_pendiente, f.total)), 0),
    'vencido', coalesce(sum(case when f.fecha_vencimiento < now()::date then coalesce(f.saldo_pendiente, f.total) else 0 end), 0),
    'por_vencer', coalesce(sum(case when f.fecha_vencimiento >= now()::date then coalesce(f.saldo_pendiente, f.total) else 0 end), 0),
    'facturas', count(*)
  )
  from proveedor_facturas f
  join grupo on grupo.cid = f.company_id
  where f.estado not in ('pagada', 'anulada')
$$;

create or replace function consolidar_aging_ar(p_company_id uuid)
returns jsonb
language sql
stable
as $$
  with grupo as (
    select unnest(empresas_del_grupo(p_company_id)) as cid
  )
  select jsonb_build_object(
    'total', coalesce(sum(coalesce(f.saldo_pendiente, f.total)), 0),
    'vencido', coalesce(sum(case when f.fecha_vencimiento < now()::date then coalesce(f.saldo_pendiente, f.total) else 0 end), 0),
    'por_vencer', coalesce(sum(case when f.fecha_vencimiento >= now()::date then coalesce(f.saldo_pendiente, f.total) else 0 end), 0),
    'facturas', count(*)
  )
  from facturas f
  join grupo on grupo.cid = f.company_id
  where f.estado = 'aprobada'
$$;

-- 7. RPC: resumen por sucursal
create or replace function resumen_por_sucursal(p_company_id uuid)
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'company_id', c.id,
      'company_name', c.name,
      'total_activo', coalesce((
        select sum(jel.debit - jel.credit) from journal_entry_lines jel
        join journal_entries je on je.id = jel.journal_entry_id
        join accounts a on a.id = jel.account_id
        where a.company_id = c.id and a.type = 'activo' and je.estado = 'contabilizado'
      ), 0),
      'total_pasivo', coalesce((
        select sum(jel.credit - jel.debit) from journal_entry_lines jel
        join journal_entries je on je.id = jel.journal_entry_id
        join accounts a on a.id = jel.account_id
        where a.company_id = c.id and a.type = 'pasivo' and je.estado = 'contabilizado'
      ), 0),
      'resultado', coalesce((
        select sum(case when a.type in ('ingreso') then jel.credit - jel.debit
                        when a.type in ('costo', 'gasto') then jel.debit - jel.credit
                        else 0 end)
        from journal_entry_lines jel
        join journal_entries je on je.id = jel.journal_entry_id
        join accounts a on a.id = jel.account_id
        where a.company_id = c.id and a.type in ('ingreso', 'costo', 'gasto') and je.estado = 'contabilizado'
      ), 0)
    ) order by c.name
  ), '[]'::jsonb)
  from companies c
  where c.id = p_company_id
     or c.parent_company_id = p_company_id
     or (c.parent_company_id is not null and c.parent_company_id = (select parent_company_id from companies where id = p_company_id))
$$;


-- ============================================================
-- consolidacion-avanzada-setup.sql
-- ============================================================
-- Consolidación avanzada: eliminaciones IC + asientos de consolidación
-- Ejecutar después de consolidacion-setup.sql

-- ============================================================
-- 1. Columna is_intercompany en accounts
-- ============================================================
alter table accounts add column if not exists is_intercompany boolean not null default false;

-- 2. Seed: agregar cuentas intercompañía al seed de Paraguay
-- Se crean con código específico para que puedan ser identificadas

-- ============================================================
-- 3. Asientos de consolidación (ajustes manuales)
-- ============================================================
create table if not exists consolidacion_asientos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  entry_number text not null,
  description text not null,
  entry_date date not null default now()::date,
  total_debit numeric(12,2) not null default 0,
  total_credit numeric(12,2) not null default 0,
  estado text not null default 'borrador' check (estado in ('borrador', 'contabilizado', 'anulado')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table consolidacion_asientos enable row level security;
drop policy if exists "cons_asientos_select" on consolidacion_asientos;
create policy "cons_asientos_select" on consolidacion_asientos for select using (public.is_member_of(company_id));
drop policy if exists "cons_asientos_insert" on consolidacion_asientos;
create policy "cons_asientos_insert" on consolidacion_asientos for insert with check (public.is_member_of(company_id));
drop policy if exists "cons_asientos_update" on consolidacion_asientos;
create policy "cons_asientos_update" on consolidacion_asientos for update using (public.is_member_of(company_id));
drop policy if exists "cons_asientos_delete" on consolidacion_asientos;
create policy "cons_asientos_delete" on consolidacion_asientos for delete using (public.is_member_of(company_id));

create table if not exists consolidacion_asiento_lines (
  id uuid primary key default gen_random_uuid(),
  asiento_id uuid not null references consolidacion_asientos(id) on delete cascade,
  account_id uuid not null references accounts(id),
  description text,
  debit numeric(12,2) not null default 0,
  credit numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

alter table consolidacion_asiento_lines enable row level security;
drop policy if exists "cons_asiento_lines_select" on consolidacion_asiento_lines;
create policy "cons_asiento_lines_select" on consolidacion_asiento_lines for select
  using (exists (select 1 from consolidacion_asientos ca where ca.id = asiento_id and public.is_member_of(ca.company_id)));
drop policy if exists "cons_asiento_lines_insert" on consolidacion_asiento_lines;
create policy "cons_asiento_lines_insert" on consolidacion_asiento_lines for insert
  with check (exists (select 1 from consolidacion_asientos ca where ca.id = asiento_id and public.is_member_of(ca.company_id)));
drop policy if exists "cons_asiento_lines_delete" on consolidacion_asiento_lines;
create policy "cons_asiento_lines_delete" on consolidacion_asiento_lines for delete
  using (exists (select 1 from consolidacion_asientos ca where ca.id = asiento_id and public.is_member_of(ca.company_id)));

-- ============================================================
-- 4. RPC: Balance consolidado con opción de eliminar IC
-- ============================================================
create or replace function consolidar_balance_con_ajustes(p_company_id uuid, p_eliminar_ic boolean default false)
returns jsonb
language sql
stable
as $$
  with grupo as (
    select unnest(empresas_del_grupo(p_company_id)) as cid
  ),
  saldos_base as (
    select a.id, a.code, a.name, a.type, a.parent_id, a.is_intercompany,
      sum(jel.debit - jel.credit) as saldo
    from accounts a
    join journal_entry_lines jel on jel.account_id = a.id
    join journal_entries je on je.id = jel.journal_entry_id
    join grupo on grupo.cid = je.company_id
    where a.type in ('activo', 'pasivo', 'patrimonio') and je.estado = 'contabilizado'
    group by a.id, a.code, a.name, a.type, a.parent_id, a.is_intercompany
  ),
  ajustes as (
    select cal.account_id, sum(cal.debit - cal.credit) as saldo
    from consolidacion_asiento_lines cal
    join consolidacion_asientos ca on ca.id = cal.asiento_id
    join grupo on grupo.cid = ca.company_id
    where ca.estado = 'contabilizado'
    group by cal.account_id
  ),
  saldos as (
    select s.id, s.code, s.name, s.type, s.parent_id,
      coalesce(s.saldo, 0) + coalesce(a.saldo, 0) as saldo
    from saldos_base s
    left join ajustes a on a.account_id = s.id
    where not (p_eliminar_ic and s.is_intercompany)
  )
  select jsonb_build_object(
    'total_activo', coalesce((select sum(saldo) from saldos where type = 'activo'), 0),
    'total_pasivo', coalesce((select sum(saldo) from saldos where type = 'pasivo'), 0),
    'total_patrimonio', coalesce((select sum(saldo) from saldos where type = 'patrimonio'), 0),
    'cuentas', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'code', s.code, 'name', s.name, 'type', s.type, 'parent_id', s.parent_id, 'saldo', round(s.saldo, 2)) order by s.code) from saldos s), '[]'::jsonb)
  )
$$;

-- 5. RPC: Resultados consolidado con opción de eliminar IC
create or replace function consolidar_resultados_con_ajustes(p_company_id uuid, p_eliminar_ic boolean default false)
returns jsonb
language sql
stable
as $$
  with grupo as (
    select unnest(empresas_del_grupo(p_company_id)) as cid
  ),
  saldos_base as (
    select a.id, a.code, a.name, a.type, a.parent_id, a.is_intercompany,
      case when a.type = 'ingreso' then sum(jel.credit - jel.debit)
           else sum(jel.debit - jel.credit)
      end as saldo
    from accounts a
    join journal_entry_lines jel on jel.account_id = a.id
    join journal_entries je on je.id = jel.journal_entry_id
    join grupo on grupo.cid = je.company_id
    where a.type in ('ingreso', 'costo', 'gasto') and je.estado = 'contabilizado'
    group by a.id, a.code, a.name, a.type, a.parent_id, a.is_intercompany
  ),
  ajustes as (
    select cal.account_id, sum(cal.debit - cal.credit) as saldo
    from consolidacion_asiento_lines cal
    join consolidacion_asientos ca on ca.id = cal.asiento_id
    join grupo on grupo.cid = ca.company_id
    where ca.estado = 'contabilizado'
    group by cal.account_id
  ),
  saldos as (
    select s.id, s.code, s.name, s.type, s.parent_id,
      coalesce(s.saldo, 0) + coalesce(a.saldo, 0) as saldo
    from saldos_base s
    left join ajustes a on a.account_id = s.id
    where not (p_eliminar_ic and s.is_intercompany)
  )
  select jsonb_build_object(
    'total_ingresos', coalesce((select sum(saldo) from saldos where type = 'ingreso'), 0),
    'total_costos', coalesce((select sum(saldo) from saldos where type = 'costo'), 0),
    'total_gastos', coalesce((select sum(saldo) from saldos where type = 'gasto'), 0),
    'cuentas', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'code', s.code, 'name', s.name, 'type', s.type, 'parent_id', s.parent_id, 'saldo', round(s.saldo, 2)) order by s.code) from saldos s where s.type in ('ingreso', 'costo', 'gasto')), '[]'::jsonb)
  )
$$;


-- ============================================================
-- holding-setup.sql
-- ============================================================
-- Grupos holding / consolidación de empresas independientes
-- Ejecutar después de consolidacion-setup.sql

-- 1. Grupos económicos (holdings)
create table if not exists grupos_holding (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  nombre text not null,
  created_at timestamptz not null default now()
);

alter table grupos_holding enable row level security;
drop policy if exists "grupos_select" on grupos_holding;
create policy "grupos_select" on grupos_holding for select using (public.is_member_of(company_id));
drop policy if exists "grupos_insert" on grupos_holding;
create policy "grupos_insert" on grupos_holding for insert with check (public.is_member_of(company_id));
drop policy if exists "grupos_update" on grupos_holding;
create policy "grupos_update" on grupos_holding for update using (public.is_member_of(company_id));
drop policy if exists "grupos_delete" on grupos_holding;
create policy "grupos_delete" on grupos_holding for delete using (public.is_member_of(company_id));

-- 2. Miembros del holding
create table if not exists holding_miembros (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references grupos_holding(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  participacion numeric(5,2) not null default 100,
  created_at timestamptz not null default now(),
  unique(grupo_id, company_id)
);

alter table holding_miembros enable row level security;
drop policy if exists "miembros_select" on holding_miembros;
create policy "miembros_select" on holding_miembros for select
  using (exists (select 1 from grupos_holding g where g.id = grupo_id and public.is_member_of(g.company_id)));
drop policy if exists "miembros_insert" on holding_miembros;
create policy "miembros_insert" on holding_miembros for insert
  with check (exists (select 1 from grupos_holding g where g.id = grupo_id and public.is_member_of(g.company_id)));
drop policy if exists "miembros_delete" on holding_miembros;
create policy "miembros_delete" on holding_miembros for delete
  using (exists (select 1 from grupos_holding g where g.id = grupo_id and public.is_member_of(g.company_id)));

-- 3. RPC: empresas del holding (reemplaza empresas_del_grupo para holding)
create or replace function empresas_del_holding(p_grupo_id uuid)
returns uuid[]
language sql
stable
as $$
  select array(select company_id from holding_miembros where grupo_id = p_grupo_id)
$$;

-- 4. RPC: balance consolidado por holding
create or replace function consolidar_balance_holding(p_grupo_id uuid, p_eliminar_ic boolean default false)
returns jsonb
language sql
stable
as $$
  with grupo as (
    select unnest(empresas_del_holding(p_grupo_id)) as cid
  ),
  saldos_base as (
    select a.id, a.code, a.name, a.type, a.parent_id, a.is_intercompany,
      sum(jel.debit - jel.credit) as saldo
    from accounts a
    join journal_entry_lines jel on jel.account_id = a.id
    join journal_entries je on je.id = jel.journal_entry_id
    join grupo on grupo.cid = je.company_id
    where a.type in ('activo', 'pasivo', 'patrimonio') and je.estado = 'contabilizado'
    group by a.id, a.code, a.name, a.type, a.parent_id, a.is_intercompany
  ),
  ajustes as (
    select cal.account_id, sum(cal.debit - cal.credit) as saldo
    from consolidacion_asiento_lines cal
    join consolidacion_asientos ca on ca.id = cal.asiento_id
    join grupo on grupo.cid = ca.company_id
    where ca.estado = 'contabilizado'
    group by cal.account_id
  ),
  saldos as (
    select s.id, s.code, s.name, s.type, s.parent_id,
      coalesce(s.saldo, 0) + coalesce(a.saldo, 0) as saldo
    from saldos_base s
    left join ajustes a on a.account_id = s.id
    where not (p_eliminar_ic and s.is_intercompany)
  )
  select jsonb_build_object(
    'total_activo', coalesce((select sum(saldo) from saldos where type = 'activo'), 0),
    'total_pasivo', coalesce((select sum(saldo) from saldos where type = 'pasivo'), 0),
    'total_patrimonio', coalesce((select sum(saldo) from saldos where type = 'patrimonio'), 0),
    'cuentas', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'code', s.code, 'name', s.name, 'type', s.type, 'parent_id', s.parent_id, 'saldo', round(s.saldo, 2)) order by s.code) from saldos s), '[]'::jsonb)
  )
$$;

-- 5. RPC: resultados consolidado por holding
create or replace function consolidar_resultados_holding(p_grupo_id uuid, p_eliminar_ic boolean default false)
returns jsonb
language sql
stable
as $$
  with grupo as (
    select unnest(empresas_del_holding(p_grupo_id)) as cid
  ),
  saldos_base as (
    select a.id, a.code, a.name, a.type, a.parent_id, a.is_intercompany,
      case when a.type = 'ingreso' then sum(jel.credit - jel.debit)
           else sum(jel.debit - jel.credit)
      end as saldo
    from accounts a
    join journal_entry_lines jel on jel.account_id = a.id
    join journal_entries je on je.id = jel.journal_entry_id
    join grupo on grupo.cid = je.company_id
    where a.type in ('ingreso', 'costo', 'gasto') and je.estado = 'contabilizado'
    group by a.id, a.code, a.name, a.type, a.parent_id, a.is_intercompany
  ),
  ajustes as (
    select cal.account_id, sum(cal.debit - cal.credit) as saldo
    from consolidacion_asiento_lines cal
    join consolidacion_asientos ca on ca.id = cal.asiento_id
    join grupo on grupo.cid = ca.company_id
    where ca.estado = 'contabilizado'
    group by cal.account_id
  ),
  saldos as (
    select s.id, s.code, s.name, s.type, s.parent_id,
      coalesce(s.saldo, 0) + coalesce(a.saldo, 0) as saldo
    from saldos_base s
    left join ajustes a on a.account_id = s.id
    where not (p_eliminar_ic and s.is_intercompany)
  )
  select jsonb_build_object(
    'total_ingresos', coalesce((select sum(saldo) from saldos where type = 'ingreso'), 0),
    'total_costos', coalesce((select sum(saldo) from saldos where type = 'costo'), 0),
    'total_gastos', coalesce((select sum(saldo) from saldos where type = 'gasto'), 0),
    'cuentas', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'code', s.code, 'name', s.name, 'type', s.type, 'parent_id', s.parent_id, 'saldo', round(s.saldo, 2)) order by s.code) from saldos s where s.type in ('ingreso', 'costo', 'gasto')), '[]'::jsonb)
  )
$$;

-- 6. RPC: resumen por empresa del holding
create or replace function resumen_por_holding(p_grupo_id uuid)
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'company_id', c.id,
      'company_name', c.name,
      'total_activo', coalesce((
        select sum(jel.debit - jel.credit) from journal_entry_lines jel
        join journal_entries je on je.id = jel.journal_entry_id
        join accounts a on a.id = jel.account_id
        where a.company_id = c.id and a.type = 'activo' and je.estado = 'contabilizado'
      ), 0),
      'total_pasivo', coalesce((
        select sum(jel.credit - jel.debit) from journal_entry_lines jel
        join journal_entries je on je.id = jel.journal_entry_id
        join accounts a on a.id = jel.account_id
        where a.company_id = c.id and a.type = 'pasivo' and je.estado = 'contabilizado'
      ), 0),
      'resultado', coalesce((
        select sum(case when a.type in ('ingreso') then jel.credit - jel.debit
                        when a.type in ('costo', 'gasto') then jel.debit - jel.credit
                        else 0 end)
        from journal_entry_lines jel
        join journal_entries je on je.id = jel.journal_entry_id
        join accounts a on a.id = jel.account_id
        where a.company_id = c.id and a.type in ('ingreso', 'costo', 'gasto') and je.estado = 'contabilizado'
      ), 0),
      'participacion', coalesce((select participacion from holding_miembros where grupo_id = p_grupo_id and company_id = c.id), 100)
    ) order by c.name
  ), '[]'::jsonb)
  from companies c
  where c.id = any(empresas_del_holding(p_grupo_id));
$$;


-- ============================================================
-- reportes-consolidados-setup.sql
-- ============================================================
-- Reportes contables consolidados (multi-sucursal)
-- Ejecutar después de accounting-setup.sql y consolidacion-setup.sql

-- 1. Balance General Consolidado
create or replace function reporte_balance_consolidado(p_company_id uuid, p_fecha_corte date)
returns jsonb
language sql
stable
as $$
  with grupo as (
    select unnest(empresas_del_grupo(p_company_id)) as cid
  )
  select jsonb_build_object(
    'total_activo', coalesce((select sum(jel.debit - jel.credit) from journal_entry_lines jel join journal_entries je on je.id = jel.journal_entry_id join accounts a on a.id = jel.account_id join grupo on grupo.cid = je.company_id where je.entry_date <= p_fecha_corte and je.estado = 'contabilizado' and a.type = 'activo'), 0),
    'total_pasivo', coalesce((select sum(jel.credit - jel.debit) from journal_entry_lines jel join journal_entries je on je.id = jel.journal_entry_id join accounts a on a.id = jel.account_id join grupo on grupo.cid = je.company_id where je.entry_date <= p_fecha_corte and je.estado = 'contabilizado' and a.type = 'pasivo'), 0),
    'total_patrimonio', coalesce((select sum(jel.credit - jel.debit) from journal_entry_lines jel join journal_entries je on je.id = jel.journal_entry_id join accounts a on a.id = jel.account_id join grupo on grupo.cid = je.company_id where je.entry_date <= p_fecha_corte and je.estado = 'contabilizado' and a.type in ('patrimonio', 'ingreso', 'costo', 'gasto')), 0),
    'cuentas', coalesce(jsonb_agg(
      jsonb_build_object('id', a.id, 'code', a.code, 'name', a.name, 'type', a.type, 'parent_id', a.parent_id, 'saldo', round(coalesce(s.saldo, 0), 2))
      order by a.code
    ), '[]'::jsonb)
  )
  from accounts a
  join grupo on grupo.cid = a.company_id
  left join (
    select jel.account_id, sum(jel.debit - jel.credit) as saldo
    from journal_entry_lines jel
    join journal_entries je on je.id = jel.journal_entry_id
    join grupo on grupo.cid = je.company_id
    where je.entry_date <= p_fecha_corte and je.estado = 'contabilizado'
    group by jel.account_id
  ) s on s.account_id = a.id
  where a.is_active = true;
$$;

-- 2. Resultados Consolidado
create or replace function reporte_resultados_consolidado(p_company_id uuid, p_desde date, p_hasta date)
returns jsonb
language sql
stable
as $$
  with grupo as (
    select unnest(empresas_del_grupo(p_company_id)) as cid
  )
  select jsonb_build_object(
    'total_ingresos', coalesce((select sum(jel.credit - jel.debit) from journal_entry_lines jel join journal_entries je on je.id = jel.journal_entry_id join accounts a on a.id = jel.account_id join grupo on grupo.cid = je.company_id where je.entry_date between p_desde and p_hasta and je.estado = 'contabilizado' and a.type = 'ingreso'), 0),
    'total_costos', coalesce((select sum(jel.debit - jel.credit) from journal_entry_lines jel join journal_entries je on je.id = jel.journal_entry_id join accounts a on a.id = jel.account_id join grupo on grupo.cid = je.company_id where je.entry_date between p_desde and p_hasta and je.estado = 'contabilizado' and a.type = 'costo'), 0),
    'total_gastos', coalesce((select sum(jel.debit - jel.credit) from journal_entry_lines jel join journal_entries je on je.id = jel.journal_entry_id join accounts a on a.id = jel.account_id join grupo on grupo.cid = je.company_id where je.entry_date between p_desde and p_hasta and je.estado = 'contabilizado' and a.type = 'gasto'), 0),
    'cuentas', coalesce(jsonb_agg(
      jsonb_build_object('id', a.id, 'code', a.code, 'name', a.name, 'type', a.type, 'parent_id', a.parent_id, 'saldo', round(coalesce(s.saldo, 0), 2))
      order by a.code
    ), '[]'::jsonb)
  )
  from accounts a
  join grupo on grupo.cid = a.company_id
  left join (
    select jel.account_id,
      case when acc.type in ('ingreso') then sum(jel.credit - jel.debit)
           when acc.type in ('costo', 'gasto') then sum(jel.debit - jel.credit)
           else 0 end as saldo
    from journal_entry_lines jel
    join journal_entries je on je.id = jel.journal_entry_id
    join accounts acc on acc.id = jel.account_id
    join grupo on grupo.cid = je.company_id
    where je.entry_date between p_desde and p_hasta and je.estado = 'contabilizado'
      and acc.type in ('ingreso', 'costo', 'gasto')
    group by jel.account_id, acc.type
  ) s on s.account_id = a.id
  where a.is_active = true and a.type in ('ingreso', 'costo', 'gasto');
$$;

-- 3. IVA Consolidado
create or replace function reporte_iva_consolidado(p_company_id uuid, p_desde date, p_hasta date)
returns jsonb
language sql
stable
as $$
  with grupo as (
    select unnest(empresas_del_grupo(p_company_id)) as cid
  )
  select jsonb_build_object(
    'iva_debito', coalesce((select sum(itl.tax_amount) from invoice_tax_lines itl join taxes t on t.id = itl.tax_id join tax_groups tg on tg.id = t.tax_group_id join grupo on grupo.cid = itl.company_id where itl.created_at::date between p_desde and p_hasta and tg.type = 'debito_fiscal'), 0),
    'iva_credito', coalesce((select sum(itl.tax_amount) from invoice_tax_lines itl join taxes t on t.id = itl.tax_id join tax_groups tg on tg.id = t.tax_group_id join grupo on grupo.cid = itl.company_id where itl.created_at::date between p_desde and p_hasta and tg.type = 'credito_fiscal'), 0),
    'iva_a_pagar', coalesce(
      (select sum(itl.tax_amount) from invoice_tax_lines itl join taxes t on t.id = itl.tax_id join tax_groups tg on tg.id = t.tax_group_id join grupo on grupo.cid = itl.company_id where itl.created_at::date between p_desde and p_hasta and tg.type = 'debito_fiscal'), 0
    ) - coalesce(
      (select sum(itl.tax_amount) from invoice_tax_lines itl join taxes t on t.id = itl.tax_id join tax_groups tg on tg.id = t.tax_group_id join grupo on grupo.cid = itl.company_id where itl.created_at::date between p_desde and p_hasta and tg.type = 'credito_fiscal'), 0
    ),
    'detalle', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', d.tipo, 'tasa', d.tasa, 'monto', d.monto) order by d.tipo, d.tasa)
      from (
        select tg.type as tipo, t.name as tasa, sum(itl.tax_amount) as monto
        from invoice_tax_lines itl
        join taxes t on t.id = itl.tax_id
        join tax_groups tg on tg.id = t.tax_group_id
        join grupo on grupo.cid = itl.company_id
        where itl.created_at::date between p_desde and p_hasta
        group by tg.type, t.name
      ) d
    ), '[]'::jsonb)
  );
$$;

-- 4. Mayor Contable Consolidado
create or replace function reporte_mayor_consolidado(p_company_id uuid, p_account_id uuid, p_desde date, p_hasta date, p_source_type text default null)
returns jsonb
language plpgsql
stable
as $$
declare
  v_saldo_inicial numeric(12,2);
  v_movimientos jsonb;
begin
  with grupo as (
    select unnest(empresas_del_grupo(p_company_id)) as cid
  )
  select coalesce(sum(jel.debit - jel.credit), 0) into v_saldo_inicial
  from journal_entry_lines jel
  join journal_entries je on je.id = jel.journal_entry_id
  join grupo on grupo.cid = je.company_id
  where jel.account_id = p_account_id
    and je.entry_date < p_desde
    and je.estado = 'contabilizado';

  with grupo as (
    select unnest(empresas_del_grupo(p_company_id)) as cid
  )
  select jsonb_agg(
    jsonb_build_object(
      'fecha', je.entry_date,
      'entry_number', je.entry_number,
      'entry_id', je.id,
      'descripcion', je.description,
      'debit', jel.debit,
      'credit', jel.credit,
      'source_type', je.source_type
    ) order by je.entry_date, je.id
  ) into v_movimientos
  from journal_entry_lines jel
  join journal_entries je on je.id = jel.journal_entry_id
  join grupo on grupo.cid = je.company_id
  where jel.account_id = p_account_id
    and je.entry_date between p_desde and p_hasta
    and je.estado = 'contabilizado'
    and (p_source_type is null or je.source_type = p_source_type);

  return jsonb_build_object(
    'saldo_inicial', v_saldo_inicial,
    'account_id', p_account_id,
    'movimientos', coalesce(v_movimientos, '[]'::jsonb)
  );
end;
$$;


-- ============================================================
-- rrhh-setup.sql
-- ============================================================
-- RRHH — Datos maestros con histórico
-- Ejecutar después de crm-setup.sql

-- ============================================================
-- 1. Departamentos (catálogo)
-- ============================================================
create table if not exists departamentos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  nombre text not null,
  activo boolean not null default true,
  unique(company_id, nombre)
);
alter table departamentos enable row level security;
drop policy if exists "departamentos_select" on departamentos; create policy "departamentos_select" on departamentos for select using (public.is_member_of(company_id));
drop policy if exists "departamentos_insert" on departamentos; create policy "departamentos_insert" on departamentos for insert with check (public.is_member_of(company_id));
drop policy if exists "departamentos_update" on departamentos; create policy "departamentos_update" on departamentos for update using (public.is_member_of(company_id));
drop policy if exists "departamentos_delete" on departamentos; create policy "departamentos_delete" on departamentos for delete using (public.is_member_of(company_id));

-- ============================================================
-- 2. Puestos (catálogo)
-- ============================================================
create table if not exists puestos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  nombre text not null,
  activo boolean not null default true,
  unique(company_id, nombre)
);
alter table puestos enable row level security;
drop policy if exists "puestos_select" on puestos; create policy "puestos_select" on puestos for select using (public.is_member_of(company_id));
drop policy if exists "puestos_insert" on puestos; create policy "puestos_insert" on puestos for insert with check (public.is_member_of(company_id));
drop policy if exists "puestos_update" on puestos; create policy "puestos_update" on puestos for update using (public.is_member_of(company_id));
drop policy if exists "puestos_delete" on puestos; create policy "puestos_delete" on puestos for delete using (public.is_member_of(company_id));

-- ============================================================
-- 3. Empleados (base, sin vigencia)
-- ============================================================
create table if not exists empleados (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  nombre text not null,
  apellido text not null,
  email text,
  telefono text,
  direccion text,
  fecha_nacimiento date,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table empleados enable row level security;
drop policy if exists "empleados_select" on empleados; create policy "empleados_select" on empleados for select using (public.is_member_of(company_id));
drop policy if exists "empleados_insert" on empleados; create policy "empleados_insert" on empleados for insert with check (public.is_member_of(company_id));
drop policy if exists "empleados_update" on empleados; create policy "empleados_update" on empleados for update using (public.is_member_of(company_id));
drop policy if exists "empleados_delete" on empleados; create policy "empleados_delete" on empleados for delete using (public.is_member_of(company_id));

-- ============================================================
-- 4. Contratos (histórico)
-- ============================================================
create table if not exists empleado_contratos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  empleado_id uuid not null references empleados(id) on delete cascade,
  vigencia_desde date not null,
  vigencia_hasta date,
  departamento_id uuid references departamentos(id) on delete set null,
  puesto_id uuid references puestos(id) on delete set null,
  tipo text not null check (tipo in ('indefinido', 'plazo_fijo', 'temporario', 'obra')),
  salario numeric(12,2) not null default 0,
  moneda text not null default 'PYG',
  cargo text,
  activo boolean not null default true,
  unique(empleado_id, vigencia_desde)
);
alter table empleado_contratos enable row level security;
drop policy if exists "emp_contratos_select" on empleado_contratos; create policy "emp_contratos_select" on empleado_contratos for select using (public.is_member_of(company_id));
drop policy if exists "emp_contratos_insert" on empleado_contratos; create policy "emp_contratos_insert" on empleado_contratos for insert with check (public.is_member_of(company_id));
drop policy if exists "emp_contratos_update" on empleado_contratos; create policy "emp_contratos_update" on empleado_contratos for update using (public.is_member_of(company_id));
drop policy if exists "emp_contratos_delete" on empleado_contratos; create policy "emp_contratos_delete" on empleado_contratos for delete using (public.is_member_of(company_id));

-- ============================================================
-- 5. Datos bancarios (histórico)
-- ============================================================
create table if not exists empleado_bancario (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  empleado_id uuid not null references empleados(id) on delete cascade,
  vigencia_desde date not null,
  vigencia_hasta date,
  banco text,
  tipo_cuenta text check (tipo_cuenta in ('corriente', 'ahorro', 'sueldo')),
  numero_cuenta text,
  alias_cbu text,
  unique(empleado_id, vigencia_desde)
);
alter table empleado_bancario enable row level security;
drop policy if exists "emp_bancario_select" on empleado_bancario; create policy "emp_bancario_select" on empleado_bancario for select using (public.is_member_of(company_id));
drop policy if exists "emp_bancario_insert" on empleado_bancario; create policy "emp_bancario_insert" on empleado_bancario for insert with check (public.is_member_of(company_id));
drop policy if exists "emp_bancario_update" on empleado_bancario; create policy "emp_bancario_update" on empleado_bancario for update using (public.is_member_of(company_id));

-- ============================================================
-- 6. Datos fiscales (histórico)
-- ============================================================
create table if not exists empleado_fiscal (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  empleado_id uuid not null references empleados(id) on delete cascade,
  vigencia_desde date not null,
  vigencia_hasta date,
  numero_ips text,
  unique(empleado_id, vigencia_desde)
);
alter table empleado_fiscal enable row level security;
drop policy if exists "emp_fiscal_select" on empleado_fiscal; create policy "emp_fiscal_select" on empleado_fiscal for select using (public.is_member_of(company_id));
drop policy if exists "emp_fiscal_insert" on empleado_fiscal; create policy "emp_fiscal_insert" on empleado_fiscal for insert with check (public.is_member_of(company_id));
drop policy if exists "emp_fiscal_update" on empleado_fiscal; create policy "emp_fiscal_update" on empleado_fiscal for update using (public.is_member_of(company_id));

-- ============================================================
-- 7. Documentos (histórico por tipo)
-- ============================================================
create table if not exists empleado_documentos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  empleado_id uuid not null references empleados(id) on delete cascade,
  tipo text not null,
  numero text,
  fecha_emision date,
  fecha_vencimiento date,
  vigencia_desde date not null default now()::date,
  vigencia_hasta date,
  unique(empleado_id, tipo, vigencia_desde)
);
alter table empleado_documentos enable row level security;
drop policy if exists "emp_docs_select" on empleado_documentos; create policy "emp_docs_select" on empleado_documentos for select using (public.is_member_of(company_id));
drop policy if exists "emp_docs_insert" on empleado_documentos; create policy "emp_docs_insert" on empleado_documentos for insert with check (public.is_member_of(company_id));
drop policy if exists "emp_docs_delete" on empleado_documentos; create policy "emp_docs_delete" on empleado_documentos for delete using (public.is_member_of(company_id));


-- ============================================================
-- rrhh-asistencia-setup.sql
-- ============================================================
-- RRHH — Fase 2: Asistencia, Ausencias, Vacaciones
-- Ejecutar después de rrhh-setup.sql

-- ============================================================
-- 1. Asistencia diaria
-- ============================================================
create table if not exists asistencia (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  empleado_id uuid not null references empleados(id) on delete cascade,
  fecha date not null,
  hora_entrada time,
  hora_salida time,
  tipo text not null default 'normal' check (tipo in ('normal', 'feriado', 'ausente')),
  observacion text,
  created_at timestamptz not null default now(),
  unique(company_id, empleado_id, fecha)
);
alter table asistencia enable row level security;
drop policy if exists "asistencia_select" on asistencia;
create policy "asistencia_select" on asistencia for select using (public.is_member_of(company_id));
drop policy if exists "asistencia_insert" on asistencia;
create policy "asistencia_insert" on asistencia for insert with check (public.is_member_of(company_id));
drop policy if exists "asistencia_update" on asistencia;
create policy "asistencia_update" on asistencia for update using (public.is_member_of(company_id));
create index if not exists idx_asistencia_emp_fecha on asistencia(empleado_id, fecha);

-- ============================================================
-- 2. Tipos de ausencia (catálogo)
-- ============================================================
create table if not exists ausencia_tipos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  nombre text not null,
  pagado boolean not null default true,
  created_at timestamptz not null default now(),
  unique(company_id, nombre)
);
alter table ausencia_tipos enable row level security;
drop policy if exists "ausencia_tipos_select" on ausencia_tipos;
create policy "ausencia_tipos_select" on ausencia_tipos for select using (public.is_member_of(company_id));
drop policy if exists "ausencia_tipos_insert" on ausencia_tipos;
create policy "ausencia_tipos_insert" on ausencia_tipos for insert with check (public.is_member_of(company_id));
drop policy if exists "ausencia_tipos_delete" on ausencia_tipos;
create policy "ausencia_tipos_delete" on ausencia_tipos for delete using (public.is_member_of(company_id));

-- Seed por defecto
insert into ausencia_tipos (company_id, nombre, pagado)
select c.id, t.nombre, t.pagado
from companies c
cross join (values ('Enfermedad', true), ('Personal', false), ('Estudio', true), ('Licencia', true), ('Otro', false)) as t(nombre, pagado)
where not exists (select 1 from ausencia_tipos at where at.company_id = c.id and at.nombre = t.nombre);

-- ============================================================
-- 3. Solicitudes de ausencia / permiso
-- ============================================================
create table if not exists ausencias (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  empleado_id uuid not null references empleados(id) on delete cascade,
  tipo_id uuid not null references ausencia_tipos(id),
  fecha_inicio date not null,
  fecha_fin date not null,
  motivo text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobado', 'rechazado')),
  aprobado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table ausencias enable row level security;
drop policy if exists "ausencias_select" on ausencias;
create policy "ausencias_select" on ausencias for select using (public.is_member_of(company_id));
drop policy if exists "ausencias_insert" on ausencias;
create policy "ausencias_insert" on ausencias for insert with check (public.is_member_of(company_id));
drop policy if exists "ausencias_update" on ausencias;
create policy "ausencias_update" on ausencias for update using (public.is_member_of(company_id));

-- ============================================================
-- 4. Vacaciones (saldo anual)
-- ============================================================
create table if not exists vacaciones (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  empleado_id uuid not null references empleados(id) on delete cascade,
  periodo text not null,
  dias_asignados numeric(4,1) not null default 0,
  dias_disfrutados numeric(4,1) not null default 0,
  created_at timestamptz not null default now(),
  unique(company_id, empleado_id, periodo)
);
alter table vacaciones enable row level security;
drop policy if exists "vacaciones_select" on vacaciones;
create policy "vacaciones_select" on vacaciones for select using (public.is_member_of(company_id));
drop policy if exists "vacaciones_insert" on vacaciones;
create policy "vacaciones_insert" on vacaciones for insert with check (public.is_member_of(company_id));
drop policy if exists "vacaciones_update" on vacaciones;
create policy "vacaciones_update" on vacaciones for update using (public.is_member_of(company_id));

-- ============================================================
-- 5. Solicitudes de vacaciones
-- ============================================================
create table if not exists vacaciones_solicitudes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  empleado_id uuid not null references empleados(id) on delete cascade,
  fecha_inicio date not null,
  fecha_fin date not null,
  dias numeric(4,1) not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobado', 'rechazado', 'tomado')),
  aprobado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table vacaciones_solicitudes enable row level security;
drop policy if exists "vac_solicitudes_select" on vacaciones_solicitudes;
create policy "vac_solicitudes_select" on vacaciones_solicitudes for select using (public.is_member_of(company_id));
drop policy if exists "vac_solicitudes_insert" on vacaciones_solicitudes;
create policy "vac_solicitudes_insert" on vacaciones_solicitudes for insert with check (public.is_member_of(company_id));
drop policy if exists "vac_solicitudes_update" on vacaciones_solicitudes;
create policy "vac_solicitudes_update" on vacaciones_solicitudes for update using (public.is_member_of(company_id));

-- ============================================================
-- 6. Reglas de vacaciones (configurables por empresa)
-- ============================================================
create table if not exists vacacion_reglas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  desde_anios integer not null,
  hasta_anios integer not null,
  dias numeric(4,1) not null,
  created_at timestamptz not null default now(),
  unique(company_id, desde_anios)
);
alter table vacacion_reglas enable row level security;
drop policy if exists "vac_reglas_select" on vacacion_reglas;
create policy "vac_reglas_select" on vacacion_reglas for select using (public.is_member_of(company_id));
drop policy if exists "vac_reglas_insert" on vacacion_reglas;
create policy "vac_reglas_insert" on vacacion_reglas for insert with check (public.is_member_of(company_id));
drop policy if exists "vac_reglas_delete" on vacacion_reglas;
create policy "vac_reglas_delete" on vacacion_reglas for delete using (public.is_member_of(company_id));

-- Seed por defecto (Paraguay)
insert into vacacion_reglas (company_id, desde_anios, hasta_anios, dias)
select c.id, r.desde_anios, r.hasta_anios, r.dias
from companies c
cross join (values (0, 5, 12), (6, 10, 18), (11, 99, 30)) as r(desde_anios, hasta_anios, dias)
where not exists (select 1 from vacacion_reglas vr where vr.company_id = c.id and vr.desde_anios = r.desde_anios);

-- 7. Columna para ajustes manuales de vacaciones
alter table vacaciones add column if not exists dias_adicionales numeric(4,1) not null default 0;


-- ============================================================
-- rrhh-biometrico-setup.sql
-- ============================================================
-- RRHH — Importación biométrica
-- Ejecutar después de rrhh-setup.sql

-- 1. Dispositivos biométricos
create table if not exists dispositivos_biometricos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  nombre text not null,
  tipo_deteccion text not null default 'secuencia' check (tipo_deteccion in ('secuencia', 'explicito')),
  umbral_hs numeric(4,1) not null default 3,
  minimo_min integer not null default 30,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
alter table dispositivos_biometricos enable row level security;
drop policy if exists "disc_biometricos_select" on dispositivos_biometricos;
create policy "disc_biometricos_select" on dispositivos_biometricos for select using (public.is_member_of(company_id));
drop policy if exists "disc_biometricos_insert" on dispositivos_biometricos;
create policy "disc_biometricos_insert" on dispositivos_biometricos for insert with check (public.is_member_of(company_id));
drop policy if exists "disc_biometricos_delete" on dispositivos_biometricos;
create policy "disc_biometricos_delete" on dispositivos_biometricos for delete using (public.is_member_of(company_id));

-- 2. Marcaciones crudas del dispositivo
create table if not exists marcaciones_biometricas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  dispositivo_id uuid references dispositivos_biometricos(id) on delete set null,
  empleado_id uuid references empleados(id) on delete set null,
  codigo_empleado text not null,
  fecha date not null,
  hora time not null,
  tipo_inferido text check (tipo_inferido in ('entrada', 'salida', 'entrada_almuerzo', 'salida_almuerzo', 'pre_entrada', 'pre_salida', 'extra')),
  procesado boolean not null default false,
  created_at timestamptz not null default now()
);
alter table marcaciones_biometricas enable row level security;
drop policy if exists "marc_bio_select" on marcaciones_biometricas;
create policy "marc_bio_select" on marcaciones_biometricas for select using (public.is_member_of(company_id));
drop policy if exists "marc_bio_insert" on marcaciones_biometricas;
create policy "marc_bio_insert" on marcaciones_biometricas for insert with check (public.is_member_of(company_id));
drop policy if exists "marc_bio_update" on marcaciones_biometricas;
create policy "marc_bio_update" on marcaciones_biometricas for update using (public.is_member_of(company_id));
drop policy if exists "marc_bio_delete" on marcaciones_biometricas;
create policy "marc_bio_delete" on marcaciones_biometricas for delete using (public.is_member_of(company_id));

create index if not exists idx_marc_bio_codigo on marcaciones_biometricas(codigo_empleado, fecha);

-- 3. Columna en empleados para vincular código biométrico
alter table empleados add column if not exists codigo_biometrico text;


-- ============================================================
-- rrhh-turnos-setup.sql
-- ============================================================
-- RRHH — Turnos rotativos
-- Ejecutar después de rrhh-setup.sql

-- 1. Catálogo de turnos
create table if not exists turnos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  codigo text not null,
  nombre text not null,
  hora_entrada time not null,
  hora_salida time not null,
  tolerancia_min integer not null default 15,
  es_nocturno boolean not null default false,
  color text not null default '#3b82f6',
  activo boolean not null default true,
  unique(company_id, codigo)
);
alter table turnos enable row level security;
drop policy if exists "turnos_select" on turnos;
create policy "turnos_select" on turnos for select using (public.is_member_of(company_id));
drop policy if exists "turnos_insert" on turnos;
create policy "turnos_insert" on turnos for insert with check (public.is_member_of(company_id));
drop policy if exists "turnos_update" on turnos;
create policy "turnos_update" on turnos for update using (public.is_member_of(company_id));
drop policy if exists "turnos_delete" on turnos;
create policy "turnos_delete" on turnos for delete using (public.is_member_of(company_id));

-- Seed turnos por defecto
insert into turnos (company_id, codigo, nombre, hora_entrada, hora_salida, es_nocturno, color) 
select c.id, t.codigo, t.nombre, t.entrada, t.salida, t.nocturno, t.color
from companies c
cross join (values 
  ('M', 'Mañana', '06:00'::time, '14:00'::time, false, '#3b82f6'),
  ('T', 'Tarde', '14:00'::time, '22:00'::time, false, '#f59e0b'),
  ('N', 'Noche', '22:00'::time, '06:00'::time, true, '#1e293b')
) as t(codigo, nombre, entrada, salida, nocturno, color)
where not exists (select 1 from turnos tu where tu.company_id = c.id and tu.codigo = t.codigo);

-- 2. Patrones de rotación
create table if not exists rotacion_patrones (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  nombre text not null,
  descripcion text,
  created_at timestamptz not null default now(),
  unique(company_id, nombre)
);
alter table rotacion_patrones enable row level security;
drop policy if exists "patrones_select" on rotacion_patrones;
create policy "patrones_select" on rotacion_patrones for select using (public.is_member_of(company_id));
drop policy if exists "patrones_insert" on rotacion_patrones;
create policy "patrones_insert" on rotacion_patrones for insert with check (public.is_member_of(company_id));
drop policy if exists "patrones_update" on rotacion_patrones;
create policy "patrones_update" on rotacion_patrones for update using (public.is_member_of(company_id));
drop policy if exists "patrones_delete" on rotacion_patrones;
create policy "patrones_delete" on rotacion_patrones for delete using (public.is_member_of(company_id));

-- 3. Días de cada patrón (secuencia)
create table if not exists rotacion_patron_dias (
  id uuid primary key default gen_random_uuid(),
  patron_id uuid not null references rotacion_patrones(id) on delete cascade,
  dia_pos integer not null check (dia_pos >= 0),
  turno_id uuid references turnos(id) on delete set null,
  unique(patron_id, dia_pos)
);
alter table rotacion_patron_dias enable row level security;
drop policy if exists "patron_dias_select" on rotacion_patron_dias;
create policy "patron_dias_select" on rotacion_patron_dias for select
  using (exists (select 1 from rotacion_patrones rp where rp.id = patron_id and public.is_member_of(rp.company_id)));
drop policy if exists "patron_dias_insert" on rotacion_patron_dias;
create policy "patron_dias_insert" on rotacion_patron_dias for insert
  with check (exists (select 1 from rotacion_patrones rp where rp.id = patron_id and public.is_member_of(rp.company_id)));
drop policy if exists "patron_dias_delete" on rotacion_patron_dias;
create policy "patron_dias_delete" on rotacion_patron_dias for delete
  using (exists (select 1 from rotacion_patrones rp where rp.id = patron_id and public.is_member_of(rp.company_id)));

-- 4. Asignación empleado → patrón
create table if not exists empleado_rotacion (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  empleado_id uuid not null references empleados(id) on delete cascade,
  patron_id uuid not null references rotacion_patrones(id),
  fecha_inicio date not null,
  dia_inicio integer not null default 0,
  created_at timestamptz not null default now(),
  unique(company_id, empleado_id)
);
alter table empleado_rotacion enable row level security;
drop policy if exists "emp_rotacion_select" on empleado_rotacion;
create policy "emp_rotacion_select" on empleado_rotacion for select using (public.is_member_of(company_id));
drop policy if exists "emp_rotacion_insert" on empleado_rotacion;
create policy "emp_rotacion_insert" on empleado_rotacion for insert with check (public.is_member_of(company_id));
drop policy if exists "emp_rotacion_update" on empleado_rotacion;
create policy "emp_rotacion_update" on empleado_rotacion for update using (public.is_member_of(company_id));

-- 5. Calendario generado
create table if not exists calendario_turnos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  empleado_id uuid not null references empleados(id) on delete cascade,
  fecha date not null,
  turno_id uuid references turnos(id) on delete set null,
  origen text not null default 'rotacion' check (origen in ('rotacion', 'manual', 'excepcion')),
  motivo text,
  created_at timestamptz not null default now(),
  unique(company_id, empleado_id, fecha)
);
alter table calendario_turnos enable row level security;
drop policy if exists "cal_turnos_select" on calendario_turnos;
create policy "cal_turnos_select" on calendario_turnos for select using (public.is_member_of(company_id));
drop policy if exists "cal_turnos_insert" on calendario_turnos;
create policy "cal_turnos_insert" on calendario_turnos for insert with check (public.is_member_of(company_id));
drop policy if exists "cal_turnos_update" on calendario_turnos;
create policy "cal_turnos_update" on calendario_turnos for update using (public.is_member_of(company_id));
drop policy if exists "cal_turnos_delete" on calendario_turnos;
create policy "cal_turnos_delete" on calendario_turnos for delete using (public.is_member_of(company_id));

create index if not exists idx_cal_turnos_emp_fecha on calendario_turnos(empleado_id, fecha);

-- 6. RPC: generar calendario en una sola llamada
create or replace function generar_calendario(
  p_company_id uuid, p_empleado_id uuid, p_desde date, p_hasta date
) returns integer
language plpgsql
as $$
declare
  v_patron_id uuid;
  v_dia_inicio integer;
  v_total_dias integer;
  v_turno_id uuid;
  v_total integer := 0;
  v_day_of_week integer;
  v_offset integer;
  v_pos integer;
  v_fecha date;
begin
  -- Obtener patrón del empleado
  select er.patron_id, coalesce(er.dia_inicio, 0) into v_patron_id, v_dia_inicio
  from empleado_rotacion er
  where er.empleado_id = p_empleado_id;

  if v_patron_id is null then
    raise exception 'El empleado no tiene rotacion asignada';
  end if;

  -- Contar días del patrón
  select count(*) into v_total_dias
  from rotacion_patron_dias
  where patron_id = v_patron_id;

  if v_total_dias = 0 then
    raise exception 'El patron no tiene dias configurados';
  end if;

  -- Auto-alinear si es patrón de 7 días (posición 0 = Lunes)
  if v_total_dias = 7 then
    v_day_of_week := extract(dow from p_desde); -- 0=Dom, 1=Lun...
    v_dia_inicio := (v_day_of_week - 1 + 7) % 7;
  end if;

  -- Generar calendario recorriendo fechas
  v_fecha := p_desde;
  while v_fecha <= p_hasta loop
    v_pos := ((v_fecha - p_desde) + v_dia_inicio) % v_total_dias;

    select pd.turno_id into v_turno_id
    from rotacion_patron_dias pd
    where pd.patron_id = v_patron_id
    order by pd.dia_pos
    offset v_pos limit 1;

    insert into calendario_turnos (company_id, empleado_id, fecha, turno_id, origen)
    values (p_company_id, p_empleado_id, v_fecha, v_turno_id, 'rotacion')
    on conflict (company_id, empleado_id, fecha) do update set turno_id = excluded.turno_id, origen = 'rotacion';

    v_total := v_total + 1;
    v_fecha := v_fecha + 1;
  end loop;

  return v_total;
end;
$$;


-- ============================================================
-- rrhh-turnos-rediseno-setup.sql
-- ============================================================
-- RRHH — Rediseño: calendarios compartidos
-- Ejecutar después de rrhh-turnos-setup.sql

-- 1. Tabla de calendarios (plantillas)
create table if not exists calendarios (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  nombre text not null,
  patron_id uuid references rotacion_patrones(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table calendarios enable row level security;
drop policy if exists "calendarios_select" on calendarios;
create policy "calendarios_select" on calendarios for select using (public.is_member_of(company_id));
drop policy if exists "calendarios_insert" on calendarios;
create policy "calendarios_insert" on calendarios for insert with check (public.is_member_of(company_id));
drop policy if exists "calendarios_update" on calendarios;
create policy "calendarios_update" on calendarios for update using (public.is_member_of(company_id));
drop policy if exists "calendarios_delete" on calendarios;
create policy "calendarios_delete" on calendarios for delete using (public.is_member_of(company_id));

-- 2. Migrar calendario_turnos: agregar calendario_id y permitir null en empleado_id para excepciones
-- Eliminar unique constraint existente
alter table calendario_turnos drop constraint if exists calendario_turnos_company_id_empleado_id_fecha_key;
-- Agregar columna calendario_id
alter table calendario_turnos add column if not exists calendario_id uuid references calendarios(id) on delete cascade;
-- Hacer empleado_id nullable (para excepciones)
alter table calendario_turnos alter column empleado_id drop not null;
-- Nuevo unique: (calendario_id, fecha) — un calendario tiene un turno por fecha
alter table calendario_turnos add constraint cal_turnos_cal_fecha unique (calendario_id, fecha);

-- 3. Agregar calendario_id a empleado_rotacion
alter table empleado_rotacion add column if not exists calendario_id uuid references calendarios(id) on delete set null;

-- 4. Migrar datos existentes: crear calendario por cada empleado que tenga datos en calendario_turnos
-- (opcional, para bases existentes)


-- ============================================================
-- rrhh-control-horario-setup.sql
-- ============================================================
-- RRHH — Control horario (planificado vs real)
-- Ejecutar después de rrhh-turnos-rediseno-setup.sql

create table if not exists control_horario (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  empleado_id uuid not null references empleados(id) on delete cascade,
  fecha date not null,
  turno_planificado text,
  entrada_planificada time,
  salida_planificada time,
  entrada_real time,
  salida_real time,
  minutos_trabajados integer default 0,
  minutos_atraso integer default 0,
  minutos_salida_temp integer default 0,
  minutos_extra integer default 0,
  minutos_nocturnos integer default 0,
  es_ausente boolean not null default false,
  created_at timestamptz not null default now(),
  unique(company_id, empleado_id, fecha)
);

alter table control_horario add column if not exists es_feriado boolean not null default false;
alter table control_horario add column if not exists motivo_ausencia text;
alter table control_horario add column if not exists minutos_extra_50 integer not null default 0;
alter table control_horario add column if not exists minutos_extra_100 integer not null default 0;
alter table control_horario add column if not exists minutos_extra_130 integer not null default 0;
drop policy if exists "ctrl_horario_select" on control_horario;
create policy "ctrl_horario_select" on control_horario for select using (public.is_member_of(company_id));
drop policy if exists "ctrl_horario_insert" on control_horario;
create policy "ctrl_horario_insert" on control_horario for insert with check (public.is_member_of(company_id));
drop policy if exists "ctrl_horario_delete" on control_horario;
create policy "ctrl_horario_delete" on control_horario for delete using (public.is_member_of(company_id));

-- RPC: calcular control horario para uno o todos los empleados
create or replace function calcular_control_horario(
  p_company_id uuid,
  p_desde date,
  p_hasta date,
  p_empleado_id uuid default null
) returns integer
language plpgsql
security definer
as $$
declare
  v_emp record;
  v_fecha date;
  v_entrada_plan time;
  v_salida_plan time;
  v_turno_cod text;
  v_entrada_real time;
  v_salida_real time;
  v_tolerancia integer := 15;
  v_total integer := 0;
  v_calendario_id uuid;
  v_asistencia record;
  -- métricas
  v_min_trab integer;
  v_min_ats integer;
  v_min_stemp integer;
  v_min_extra integer;
  v_min_extra_50 integer;
  v_min_extra_100 integer;
  v_min_extra_130 integer;
  v_min_noct integer;
  v_ausente boolean;
  v_es_feriado boolean;
  v_feriado_nombre text;
  v_ausencia_motivo text;
  e_min integer; s_min integer; p_e_min integer; p_s_min integer;
  hh integer; v_overlap_start integer; v_overlap_end integer; v_is_sunday boolean;
  v_legal_min integer; v_p_fin_legal integer; v_s_min_norm integer; v_p_fin_legal_norm integer;
begin
  -- Eliminar registros anteriores del período (para evitar basura de cálculos previos)
  delete from control_horario
  where company_id = p_company_id
    and fecha between p_desde and p_hasta
    and (p_empleado_id is null or empleado_id = p_empleado_id);

  for v_emp in
    select e.id as empleado_id
    from empleados e
    where e.company_id = p_company_id
      and e.activo = true
      and (p_empleado_id is null or e.id = p_empleado_id)
  loop
    -- Obtener calendario asignado al empleado
    select er.calendario_id into v_calendario_id
    from empleado_rotacion er
    where er.empleado_id = v_emp.empleado_id;

    -- Iterar por cada fecha del período
    v_fecha := p_desde;
    while v_fecha <= p_hasta loop

      -- Resetear valores
      v_entrada_plan := null;
      v_salida_plan := null;
      v_turno_cod := null;
      v_entrada_real := null;
      v_salida_real := null;
      v_ausente := false;
      v_es_feriado := false;
      v_feriado_nombre := null;
      v_ausencia_motivo := null;
      v_min_trab := 0;
      v_min_ats := 0;
      v_min_stemp := 0;
      v_min_extra := 0;
      v_min_extra_50 := 0;
      v_min_extra_100 := 0;
      v_min_extra_130 := 0;
      v_min_noct := 0;

      -- Buscar turno planificado desde calendario
      if v_calendario_id is not null then
        select t.codigo, t.hora_entrada, t.hora_salida, coalesce(t.tolerancia_min, 15)
        into v_turno_cod, v_entrada_plan, v_salida_plan, v_tolerancia
        from calendario_turnos ct
        left join turnos t on t.id = ct.turno_id
        where ct.calendario_id = v_calendario_id
          and ct.fecha = v_fecha
        limit 1;
      end if;

      -- Fallback a empleado_horarios
      if v_entrada_plan is null then
        select eh.hora_entrada, eh.hora_salida, coalesce(eh.tolerancia_min, 15)
        into v_entrada_plan, v_salida_plan, v_tolerancia
        from empleado_horarios eh
        where eh.empleado_id = v_emp.empleado_id
          and eh.vigencia_hasta is null
        limit 1;
      end if;

      -- Verificar si es feriado
      select nombre into v_feriado_nombre from feriados
      where company_id = p_company_id and fecha = v_fecha;
      v_es_feriado := v_feriado_nombre is not null;

      if v_es_feriado then
        v_turno_cod := 'FER';
        -- El plan se mantiene para calcular nocturnidad y extra relativo al turno
      end if;

      -- Verificar ausencia aprobada (ausencias o vacaciones)
      if not v_es_feriado then
        select at.nombre into v_ausencia_motivo
        from ausencias a
        join ausencia_tipos at on at.id = a.tipo_id
        where a.empleado_id = v_emp.empleado_id
          and a.company_id = p_company_id
          and a.estado = 'aprobado'
          and v_fecha between a.fecha_inicio and a.fecha_fin
        limit 1;

        -- Si no hay ausencia, verificar vacaciones aprobadas
        if v_ausencia_motivo is null then
          select 'Vacaciones' into v_ausencia_motivo
          from vacaciones_solicitudes vs
          where vs.empleado_id = v_emp.empleado_id
            and vs.company_id = p_company_id
            and vs.estado = 'aprobado'
            and v_fecha between vs.fecha_inicio and vs.fecha_fin
          limit 1;
        end if;
      end if;

      -- Buscar asistencia real del día
      select a.hora_entrada, a.hora_salida
      into v_entrada_real, v_salida_real
      from asistencia a
      where a.empleado_id = v_emp.empleado_id
        and a.company_id = p_company_id
        and a.fecha = v_fecha
      limit 1;

      -- Si solo tenemos entrada (nocturno que cruza medianoche), buscar salida al día siguiente
      if v_entrada_real is not null and v_salida_real is null then
        select a2.hora_salida into v_salida_real
        from asistencia a2
        where a2.empleado_id = v_emp.empleado_id
          and a2.company_id = p_company_id
          and a2.fecha = v_fecha + 1
          and a2.hora_entrada is null
          and a2.hora_salida is not null
        limit 1;
      end if;

      -- Si solo tenemos salida, buscar entrada del día anterior
      if v_entrada_real is null and v_salida_real is not null then
        select a2.hora_entrada into v_entrada_real
        from asistencia a2
        where a2.empleado_id = v_emp.empleado_id
          and a2.company_id = p_company_id
          and a2.fecha = v_fecha - 1
          and a2.hora_entrada is not null
          and a2.hora_salida is null
        limit 1;
      end if;
      -- Calcular métricas
      if v_entrada_real is null then
        -- Sin marcación: si tenía turno planificado (y no es feriado), es ausente
        if v_entrada_plan is not null and not v_es_feriado then
          v_ausente := true;
        end if;
      elsif v_es_feriado then
        e_min := extract(hour from v_entrada_real) * 60 + extract(minute from v_entrada_real);
        s_min := extract(hour from v_salida_real) * 60 + extract(minute from v_salida_real);
        v_min_trab := s_min - e_min;
        if v_min_trab < 0 then v_min_trab := v_min_trab + 1440; end if;

        v_min_extra_50 := 0;
        v_min_extra_100 := 0;
        v_min_extra_130 := 0;
        v_min_noct := 0;
        v_min_ats := 0;
        v_min_stemp := 0;

        if v_entrada_plan is not null and v_salida_plan is not null and s_min is not null then
          p_e_min := extract(hour from v_entrada_plan) * 60 + extract(minute from v_entrada_plan);
          p_s_min := extract(hour from v_salida_plan) * 60 + extract(minute from v_salida_plan);

          -- Fin legal según tipo de turno (PY)
          if p_s_min >= p_e_min then
            if p_e_min >= 360 and p_s_min <= 1200 then v_legal_min := 480;
            elsif (p_e_min >= 1200 or p_e_min < 360) and (p_s_min >= 1200 or p_s_min <= 360) then v_legal_min := 420;
            else v_legal_min := 450; end if;
          else
            if p_e_min >= 1200 and p_s_min <= 360 then v_legal_min := 420;
            else v_legal_min := 450; end if;
          end if;
          v_p_fin_legal := p_e_min + v_legal_min;
          if v_p_fin_legal >= 1440 then v_p_fin_legal := v_p_fin_legal - 1440; end if;

          -- Extra relativo al fin legal
          if s_min >= p_e_min and v_p_fin_legal < p_e_min then
            v_min_extra := 0;
          else
            v_s_min_norm := s_min; v_p_fin_legal_norm := v_p_fin_legal;
            if s_min < p_e_min and v_p_fin_legal_norm >= p_e_min then v_s_min_norm := s_min + 1440; end if;
            if v_p_fin_legal_norm < p_e_min and s_min >= p_e_min then v_p_fin_legal_norm := v_p_fin_legal_norm + 1440; end if;
            if s_min < p_e_min and v_p_fin_legal_norm < p_e_min then v_s_min_norm := s_min + 1440; v_p_fin_legal_norm := v_p_fin_legal_norm + 1440; end if;
            v_min_extra := greatest(0, v_s_min_norm - v_p_fin_legal_norm);
          end if;

          -- Separar extra por franja (feriado: diurno → 100%, nocturno → 130%)
          for hh in 6..19 loop
            v_overlap_start := greatest(v_p_fin_legal, hh*60);
            v_overlap_end := least(s_min, (hh+1)*60);
            if v_overlap_start < v_overlap_end then
              v_min_extra_100 := v_min_extra_100 + (v_overlap_end - v_overlap_start);
            end if;
          end loop;
          for hh in 20..23 loop
            v_overlap_start := greatest(v_p_fin_legal, hh*60);
            v_overlap_end := least(s_min, (hh+1)*60);
            if v_overlap_start < v_overlap_end then
              v_min_extra_130 := v_min_extra_130 + (v_overlap_end - v_overlap_start);
            end if;
          end loop;
          for hh in 0..5 loop
            v_overlap_start := greatest(v_p_fin_legal, hh*60);
            v_overlap_end := least(s_min, (hh+1)*60);
            if v_overlap_start < v_overlap_end then
              v_min_extra_130 := v_min_extra_130 + (v_overlap_end - v_overlap_start);
            end if;
          end loop;

          -- Nocturnidad: intersección real ∩ planificado entre 20-06
          v_overlap_start := greatest(e_min, p_e_min);
          v_overlap_end := least(s_min, v_p_fin_legal);
          if v_overlap_start < v_overlap_end then
            for hh in 20..23 loop
              v_min_noct := v_min_noct + greatest(0, least(v_overlap_end, (hh+1)*60) - greatest(v_overlap_start, hh*60));
            end loop;
            for hh in 0..5 loop
              v_min_noct := v_min_noct + greatest(0, least(v_overlap_end, (hh+1)*60) - greatest(v_overlap_start, hh*60));
            end loop;
          elsif v_overlap_start > v_overlap_end then
            -- Cruza medianoche: dos partes
            for hh in 20..23 loop
              v_min_noct := v_min_noct + greatest(0, least(1440, (hh+1)*60) - greatest(v_overlap_start, hh*60));
            end loop;
            for hh in 0..5 loop
              v_min_noct := v_min_noct + greatest(0, least(v_overlap_end, (hh+1)*60) - greatest(0, hh*60));
            end loop;
          end if;
        else
          -- Sin plan: todo el tiempo trabajado es extra
          v_min_extra := v_min_trab;
          for hh in 20..23 loop
            v_overlap_start := greatest(e_min, hh*60);
            v_overlap_end := least(s_min, (hh+1)*60);
            if v_overlap_start < v_overlap_end then
              v_min_extra_130 := v_min_extra_130 + (v_overlap_end - v_overlap_start);
            end if;
          end loop;
          for hh in 0..5 loop
            v_overlap_start := greatest(e_min, hh*60);
            v_overlap_end := least(s_min, (hh+1)*60);
            if v_overlap_start < v_overlap_end then
              v_min_extra_130 := v_min_extra_130 + (v_overlap_end - v_overlap_start);
            end if;
          end loop;
          for hh in 6..19 loop
            v_overlap_start := greatest(e_min, hh*60);
            v_overlap_end := least(s_min, (hh+1)*60);
            if v_overlap_start < v_overlap_end then
              v_min_extra_100 := v_min_extra_100 + (v_overlap_end - v_overlap_start);
            end if;
          end loop;
        end if;
      else
        e_min := extract(hour from v_entrada_real) * 60 + extract(minute from v_entrada_real);
        s_min := extract(hour from v_salida_real) * 60 + extract(minute from v_salida_real);

        if v_entrada_plan is not null then
          p_e_min := extract(hour from v_entrada_plan) * 60 + extract(minute from v_entrada_plan);
          p_s_min := extract(hour from v_salida_plan) * 60 + extract(minute from v_salida_plan);

          -- Fin legal según tipo de turno (PY)
          if p_s_min >= p_e_min then
            if p_e_min >= 360 and p_s_min <= 1200 then v_legal_min := 480;
            elsif (p_e_min >= 1200 or p_e_min < 360) and (p_s_min >= 1200 or p_s_min <= 360) then v_legal_min := 420;
            else v_legal_min := 450; end if;
          else
            if p_e_min >= 1200 and p_s_min <= 360 then v_legal_min := 420;
            else v_legal_min := 450; end if;
          end if;
          v_p_fin_legal := p_e_min + v_legal_min;
          if v_p_fin_legal >= 1440 then v_p_fin_legal := v_p_fin_legal - 1440; end if;

          -- Minutos trabajados
          v_min_trab := s_min - e_min;
          if v_min_trab < 0 then v_min_trab := v_min_trab + 1440; end if;

          -- Atraso
          v_min_ats := greatest(0, e_min - p_e_min - v_tolerancia);

          -- Salida temprano
          v_min_stemp := greatest(0, p_s_min - s_min);

          -- Hora extra total (contra fin legal PY)
          if s_min >= p_e_min and v_p_fin_legal < p_e_min then
            v_min_extra := 0;
          else
            v_s_min_norm := s_min; v_p_fin_legal_norm := v_p_fin_legal;
            if s_min < p_e_min and v_p_fin_legal_norm >= p_e_min then v_s_min_norm := s_min + 1440; end if;
            if v_p_fin_legal_norm < p_e_min and s_min >= p_e_min then v_p_fin_legal_norm := v_p_fin_legal_norm + 1440; end if;
            if s_min < p_e_min and v_p_fin_legal_norm < p_e_min then v_s_min_norm := s_min + 1440; v_p_fin_legal_norm := v_p_fin_legal_norm + 1440; end if;
            v_min_extra := greatest(0, v_s_min_norm - v_p_fin_legal_norm);
          end if;
          v_is_sunday := (extract(dow from v_fecha) = 0);

          -- Separar extra por franja horaria
          v_min_extra_50 := 0;
          v_min_extra_100 := 0;
          v_min_extra_130 := 0;
          for hh in 6..19 loop
            v_overlap_start := greatest(v_p_fin_legal, hh*60);
            v_overlap_end := least(s_min, (hh+1)*60);
            if v_overlap_start < v_overlap_end then
              if v_is_sunday then
                v_min_extra_100 := v_min_extra_100 + (v_overlap_end - v_overlap_start);
              else
                v_min_extra_50 := v_min_extra_50 + (v_overlap_end - v_overlap_start);
              end if;
            end if;
          end loop;
          for hh in 20..23 loop
            v_overlap_start := greatest(v_p_fin_legal, hh*60);
            v_overlap_end := least(s_min, (hh+1)*60);
            if v_overlap_start < v_overlap_end then
              v_min_extra_130 := v_min_extra_130 + (v_overlap_end - v_overlap_start);
            end if;
          end loop;
          for hh in 0..5 loop
            v_overlap_start := greatest(v_p_fin_legal, hh*60);
            v_overlap_end := least(s_min, (hh+1)*60);
            if v_overlap_start < v_overlap_end then
              v_min_extra_130 := v_min_extra_130 + (v_overlap_end - v_overlap_start);
            end if;
          end loop;

          -- Nocturnidad: solo en horas no extra (intersección real ∩ planificado) entre 20-06
      v_min_noct := 0;
          v_overlap_start := greatest(e_min, p_e_min);
          v_overlap_end := least(s_min, v_p_fin_legal);
          if v_overlap_start < v_overlap_end then
            for hh in 20..23 loop
              v_min_noct := v_min_noct + greatest(0, least(v_overlap_end, (hh+1)*60) - greatest(v_overlap_start, hh*60));
            end loop;
            for hh in 0..5 loop
              v_min_noct := v_min_noct + greatest(0, least(v_overlap_end, (hh+1)*60) - greatest(v_overlap_start, hh*60));
            end loop;
          elsif v_overlap_start > v_overlap_end then
            for hh in 20..23 loop
              v_min_noct := v_min_noct + greatest(0, least(1440, (hh+1)*60) - greatest(v_overlap_start, hh*60));
            end loop;
            for hh in 0..5 loop
              v_min_noct := v_min_noct + greatest(0, least(v_overlap_end, (hh+1)*60) - greatest(0, hh*60));
            end loop;
          end if;
        end if;
      end if;

      -- Insertar solo si datos completos o ausente declarado
      if v_ausente or (v_entrada_real is not null and v_salida_real is not null) then
        insert into control_horario (company_id, empleado_id, fecha,
            turno_planificado, entrada_planificada, salida_planificada,
            entrada_real, salida_real,
            minutos_trabajados, minutos_atraso, minutos_salida_temp, minutos_extra, minutos_extra_50, minutos_extra_100, minutos_extra_130, minutos_nocturnos, es_ausente, es_feriado, motivo_ausencia)
          values (p_company_id, v_emp.empleado_id, v_fecha,
            v_turno_cod, v_entrada_plan, v_salida_plan,
            v_entrada_real, v_salida_real,
            v_min_trab, v_min_ats, v_min_stemp, v_min_extra, v_min_extra_50, v_min_extra_100, v_min_extra_130, v_min_noct, v_ausente, v_es_feriado, v_ausencia_motivo)
        on conflict (company_id, empleado_id, fecha) do update set
          turno_planificado = excluded.turno_planificado,
          entrada_planificada = excluded.entrada_planificada,
          salida_planificada = excluded.salida_planificada,
          entrada_real = excluded.entrada_real,
          salida_real = excluded.salida_real,
          minutos_trabajados = excluded.minutos_trabajados,
          minutos_atraso = excluded.minutos_atraso,
          minutos_salida_temp = excluded.minutos_salida_temp,
          minutos_extra = excluded.minutos_extra,
          minutos_extra_50 = excluded.minutos_extra_50,
          minutos_extra_100 = excluded.minutos_extra_100,
          minutos_extra_130 = excluded.minutos_extra_130,
          minutos_nocturnos = excluded.minutos_nocturnos,
          es_ausente = excluded.es_ausente,
          es_feriado = excluded.es_feriado,
          motivo_ausencia = excluded.motivo_ausencia;
        v_total := v_total + 1;
      end if;
      v_fecha := v_fecha + 1;
    end loop;
  end loop;

  return v_total;
end;
$$;


-- ============================================================
-- rrhh-organigrama-setup.sql
-- ============================================================
-- Organigrama / Jerarquía departamental
-- Ejecutar después de rrhh-setup.sql

alter table departamentos add column if not exists parent_depto_id uuid references departamentos(id) on delete set null;
alter table departamentos add column if not exists puesto_responsable_id uuid references puestos(id) on delete set null;

-- Vincular auth user con empleado
alter table empleados add column if not exists user_id uuid references auth.users(id) on delete set null;
create unique index if not exists idx_empleados_user_id on empleados(user_id) where user_id is not null;

-- Asociar puesto a un departamento
alter table puestos add column if not exists departamento_id uuid references departamentos(id) on delete set null;

-- RPC para listar miembros del equipo (bypass RLS)
create or replace function public.listar_miembros_equipo(p_company uuid)
returns table (user_id uuid, email text)
language sql
security definer
set search_path = public
as $$
  select cm.user_id, u.email
  from company_members cm
  left join auth.users u on u.id = cm.user_id
  where cm.company_id = p_company
  order by u.email;
$$;


-- ============================================================
-- rrhh-reportes-setup.sql
-- ============================================================
-- RRHH — Reportes de asistencia
-- Ejecutar después de rrhh-asistencia-setup.sql

-- Tabla de horarios esperados por empleado (histórico)
create table if not exists empleado_horarios (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  empleado_id uuid not null references empleados(id) on delete cascade,
  vigencia_desde date not null,
  vigencia_hasta date,
  hora_entrada time not null,
  hora_salida time not null,
  tolerancia_min integer not null default 15,
  created_at timestamptz not null default now(),
  unique(empleado_id, vigencia_desde)
);
alter table empleado_horarios enable row level security;
drop policy if exists "emp_horarios_select" on empleado_horarios;
create policy "emp_horarios_select" on empleado_horarios for select using (public.is_member_of(company_id));
drop policy if exists "emp_horarios_insert" on empleado_horarios;
create policy "emp_horarios_insert" on empleado_horarios for insert with check (public.is_member_of(company_id));
drop policy if exists "emp_horarios_update" on empleado_horarios;
create policy "emp_horarios_update" on empleado_horarios for update using (public.is_member_of(company_id));


-- ============================================================
-- feriados-setup.sql
-- ============================================================
-- Feriados nacionales
-- Ejecutar después de accounting-setup.sql

create table if not exists feriados (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  fecha date not null,
  nombre text not null,
  created_at timestamptz not null default now(),
  unique(company_id, fecha)
);
alter table feriados enable row level security;
drop policy if exists "feriados_select" on feriados;
create policy "feriados_select" on feriados for select using (public.is_member_of(company_id));
drop policy if exists "feriados_insert" on feriados;
create policy "feriados_insert" on feriados for insert with check (public.is_member_of(company_id));
drop policy if exists "feriados_delete" on feriados;
create policy "feriados_delete" on feriados for delete using (public.is_member_of(company_id));

-- Seed Paraguay (2026)
insert into feriados (company_id, fecha, nombre)
select c.id, f.fecha, f.nombre
from companies c
cross join (values
  ('2026-01-01'::date, 'Año Nuevo'),
  ('2026-03-01'::date, 'Día de los Héroes'),
  ('2026-05-01'::date, 'Día del Trabajador'),
  ('2026-05-14'::date, 'Independencia Nacional'),
  ('2026-05-15'::date, 'Independencia Nacional'),
  ('2026-06-12'::date, 'Paz del Chaco'),
  ('2026-08-15'::date, 'Fundación de Asunción'),
  ('2026-09-29'::date, 'Victoria de Boquerón'),
  ('2026-12-08'::date, 'Virgen de Caacupé'),
  ('2026-12-25'::date, 'Navidad')
) as f(fecha, nombre)
where not exists (select 1 from feriados fe where fe.company_id = c.id and fe.fecha = f.fecha::date);


-- ============================================================
-- nomina-setup.sql
-- ============================================================
-- Nómina / Payroll
-- Ejecutar después de rrhh-setup.sql y rrhh-control-horario-setup.sql

-- Horas legales por turno (para calcular valor hora)
alter table turnos add column if not exists horas_legales numeric(4,1);

-- Frecuencia de pago por empleado (semanal/quincenal/mensual)
alter table empleado_contratos add column if not exists frecuencia_pago text not null default 'mensual'
  check (frecuencia_pago in ('semanal','quincenal','mensual'));

-- 1. Conceptos de nómina
create table if not exists nomina_conceptos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  codigo text not null,
  nombre text not null,
  tipo text not null check (tipo in ('remunerativo','no_remunerativo','deduccion','aporte_patronal')),
  formula text,
  porcentaje numeric(5,2),
  orden integer not null default 0,
  activo boolean not null default true,
  unique(company_id, codigo)
);
alter table nomina_conceptos enable row level security;
drop policy if exists "nomina_conceptos_select" on nomina_conceptos;
create policy "nomina_conceptos_select" on nomina_conceptos for select using (public.is_member_of(company_id));
drop policy if exists "nomina_conceptos_insert" on nomina_conceptos;
create policy "nomina_conceptos_insert" on nomina_conceptos for insert with check (public.is_member_of(company_id));
drop policy if exists "nomina_conceptos_update" on nomina_conceptos;
create policy "nomina_conceptos_update" on nomina_conceptos for update using (public.is_member_of(company_id));
drop policy if exists "nomina_conceptos_delete" on nomina_conceptos;
create policy "nomina_conceptos_delete" on nomina_conceptos for delete using (public.is_member_of(company_id));

-- Flags de imponibilidad para conceptos (agregados después de la creación de la tabla)
alter table nomina_conceptos add column if not exists es_imponible_ips boolean not null default false;
alter table nomina_conceptos add column if not exists es_imponible_irp boolean not null default false;

-- 2. Períodos de liquidación
create table if not exists nomina_periodos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  nombre text not null,
  fecha_desde date not null,
  fecha_hasta date not null,
  fecha_pago date,
  frecuencia text not null default 'mensual' check (frecuencia in ('semanal','quincenal','mensual')),
  tipo text not null default 'ordinario' check (tipo in ('ordinario','adelanto','aguinaldo','complementario','extraordinario')),
  estado text not null default 'abierto' check (estado in ('abierto','calculado','aprobado','pagado')),
  created_at timestamptz not null default now(),
  unique(company_id, fecha_desde, fecha_hasta, tipo)
);
alter table nomina_periodos enable row level security;
drop policy if exists "nomina_periodos_select" on nomina_periodos;
create policy "nomina_periodos_select" on nomina_periodos for select using (public.is_member_of(company_id));
drop policy if exists "nomina_periodos_insert" on nomina_periodos;
create policy "nomina_periodos_insert" on nomina_periodos for insert with check (public.is_member_of(company_id));
drop policy if exists "nomina_periodos_update" on nomina_periodos;
create policy "nomina_periodos_update" on nomina_periodos for update using (public.is_member_of(company_id));
drop policy if exists "nomina_periodos_delete" on nomina_periodos;
create policy "nomina_periodos_delete" on nomina_periodos for delete using (public.is_member_of(company_id));

-- 3. Detalle por empleado por período
create table if not exists nomina_detalle (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  periodo_id uuid not null references nomina_periodos(id) on delete cascade,
  empleado_id uuid not null references empleados(id) on delete cascade,
  dias_trabajados integer not null default 0,
  horas_legales_total numeric(8,2) not null default 0,
  valor_hora numeric(12,2) not null default 0,
  salario_base numeric(12,2) not null default 0,
  total_remunerativo numeric(12,2) not null default 0,
  total_no_remunerativo numeric(12,2) not null default 0,
  total_deducciones numeric(12,2) not null default 0,
  total_aporte_patronal numeric(12,2) not null default 0,
  neto_pagar numeric(12,2) not null default 0,
  unique(periodo_id, empleado_id)
);
alter table nomina_detalle enable row level security;
drop policy if exists "nomina_detalle_select" on nomina_detalle;
create policy "nomina_detalle_select" on nomina_detalle for select using (public.is_member_of(company_id));
drop policy if exists "nomina_detalle_insert" on nomina_detalle;
create policy "nomina_detalle_insert" on nomina_detalle for insert with check (public.is_member_of(company_id));
drop policy if exists "nomina_detalle_update" on nomina_detalle;
create policy "nomina_detalle_update" on nomina_detalle for update using (public.is_member_of(company_id));
drop policy if exists "nomina_detalle_delete" on nomina_detalle;
create policy "nomina_detalle_delete" on nomina_detalle for delete using (public.is_member_of(company_id));

-- 4. Líneas del detalle (cada concepto aplicado)
create table if not exists nomina_lineas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  nomina_detalle_id uuid not null references nomina_detalle(id) on delete cascade,
  concepto_id uuid not null references nomina_conceptos(id),
  cantidad numeric(12,2),
  monto_unitario numeric(12,2),
  monto_total numeric(12,2) not null,
  origen text check (origen in ('control_horario','ausencia','vacaciones','fijo','manual','adelanto','aguinaldo')),
  referencia_id uuid
);
alter table nomina_lineas enable row level security;
drop policy if exists "nomina_lineas_select" on nomina_lineas;
create policy "nomina_lineas_select" on nomina_lineas for select using (public.is_member_of(company_id));
drop policy if exists "nomina_lineas_insert" on nomina_lineas;
create policy "nomina_lineas_insert" on nomina_lineas for insert with check (public.is_member_of(company_id));
drop policy if exists "nomina_lineas_update" on nomina_lineas;
create policy "nomina_lineas_update" on nomina_lineas for update using (public.is_member_of(company_id));
drop policy if exists "nomina_lineas_delete" on nomina_lineas;
create policy "nomina_lineas_delete" on nomina_lineas for delete using (public.is_member_of(company_id));

-- 5. Configuración de períodos
-- Asegurar columnas company_id en tablas que podrían haberse creado sin ellas
alter table nomina_detalle add column if not exists company_id uuid references companies(id) on delete cascade;
alter table nomina_detalle alter column company_id set not null;
alter table nomina_lineas add column if not exists company_id uuid references companies(id) on delete cascade;
alter table nomina_lineas alter column company_id set not null;

create table if not exists nomina_config (
  company_id uuid primary key references companies(id) on delete cascade,
  frecuencia text not null default 'mensual' check (frecuencia in ('semanal','quincenal','mensual')),
  dia_cierre integer not null default 0,
  dia_pago integer not null default 5,
  numero_patronal text not null default ''
);
alter table nomina_config enable row level security;
drop policy if exists "nomina_config_select" on nomina_config;
create policy "nomina_config_select" on nomina_config for select using (public.is_member_of(company_id));
drop policy if exists "nomina_config_insert" on nomina_config;
create policy "nomina_config_insert" on nomina_config for insert with check (public.is_member_of(company_id));
drop policy if exists "nomina_config_update" on nomina_config;
create policy "nomina_config_update" on nomina_config for update using (public.is_member_of(company_id));

-- 6. Novedades de nómina (bonos, adelantos, descuentos manuales)
create table if not exists nomina_novedades (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  empleado_id uuid not null references empleados(id) on delete cascade,
  concepto_id uuid not null references nomina_conceptos(id),
  periodo_id uuid not null references nomina_periodos(id) on delete cascade,
  tipo_aplicacion text not null default 'unico' check (tipo_aplicacion in ('unico','fijo','prorrateado')),
  monto numeric(12,2) not null default 0,
  monto_periodo numeric(12,2),
  fecha_inicio date not null,
  fecha_fin date not null,
  descripcion text,
  created_at timestamptz not null default now()
);
alter table nomina_novedades enable row level security;
-- Asegurar columnas nuevas si la tabla existía previamente
alter table nomina_novedades add column if not exists tipo_aplicacion text not null default 'unico' check (tipo_aplicacion in ('unico','fijo','prorrateado'));
alter table nomina_novedades add column if not exists monto_periodo numeric(12,2);
alter table nomina_novedades add column if not exists fecha_inicio date;
alter table nomina_novedades add column if not exists fecha_fin date;
drop policy if exists "nomina_novedades_select" on nomina_novedades;
create policy "nomina_novedades_select" on nomina_novedades for select using (public.is_member_of(company_id));
drop policy if exists "nomina_novedades_insert" on nomina_novedades;
create policy "nomina_novedades_insert" on nomina_novedades for insert with check (public.is_member_of(company_id));
drop policy if exists "nomina_novedades_delete" on nomina_novedades;
create policy "nomina_novedades_delete" on nomina_novedades for delete using (public.is_member_of(company_id));


-- ============================================================
-- nomina-asientos-setup.sql
-- ============================================================
-- Asientos contables automáticos de nómina
-- Ejecutar después de accounting-setup.sql y nomina-setup.sql

-- 1. Columna account_id en nomina_conceptos (cuenta contable por concepto)
alter table nomina_conceptos add column if not exists account_id uuid references accounts(id) on delete set null;

-- 2. Seed de cuentas contables para nómina por empresa
do $$
declare
  v_company record;
begin
  for v_company in select id from companies loop
    insert into accounts (company_id, code, name, type, is_active)
    values (v_company.id, '5.1.1', 'Sueldos y Salarios', 'gasto', true)
    on conflict (company_id, code) do nothing;

    insert into accounts (company_id, code, name, type, is_active)
    values (v_company.id, '5.1.2', 'Aportes Patronales', 'gasto', true)
    on conflict (company_id, code) do nothing;

    insert into accounts (company_id, code, name, type, is_active)
    values (v_company.id, '2.1.5', 'Sueldos a Pagar', 'pasivo', true)
    on conflict (company_id, code) do nothing;

    insert into accounts (company_id, code, name, type, is_active)
    values (v_company.id, '2.1.6', 'IPS Obrero por Pagar', 'pasivo', true)
    on conflict (company_id, code) do nothing;

    insert into accounts (company_id, code, name, type, is_active)
    values (v_company.id, '2.1.7', 'IPS Patronal por Pagar', 'pasivo', true)
    on conflict (company_id, code) do nothing;
  end loop;
end;
$$;

-- 3. Agregar 'nomina' y 'pago_nomina' a source_type
alter table journal_entries drop constraint if exists journal_entries_source_type_check;
alter table journal_entries add constraint journal_entries_source_type_check
  check (source_type in ('factura_proveedor','factura_cliente','pago_proveedor','pago_cliente','ajuste_inventario','nota_credito_cliente','nota_debito_cliente','nomina','pago_nomina','manual'));

-- 4. RPC: generar / previsualizar asiento contable desde nómina aprobada
-- Si p_preview=true, retorna las líneas sin insertar nada
create or replace function generar_asiento_nomina(p_periodo_id uuid, p_preview boolean default false)
returns jsonb language plpgsql security definer as $$
declare
  v_periodo record;
  v_cid uuid;
  v_total_debe numeric(12,2) := 0;
  v_total_haber numeric(12,2) := 0;
  v_balance numeric(12,2) := 0;
  v_cuenta_pagar uuid;
  v_entry_id uuid;
  v_entry_number text;
  v_row record;
  v_lineas jsonb := '[]'::jsonb;
  v_codigo_pagar text;
  v_nombre_pagar text;
  v_balanced boolean;
begin
  select * into v_periodo from nomina_periodos where id = p_periodo_id;
  if not found then return jsonb_build_object('error', 'Período no encontrado'); end if;
  if not p_preview and v_periodo.estado != 'aprobado' then
    return jsonb_build_object('error', 'El período debe estar aprobado');
  end if;
  v_cid := v_periodo.company_id;

  select id, code, name into v_cuenta_pagar, v_codigo_pagar, v_nombre_pagar
  from accounts where company_id = v_cid and code = '2.1.5';
  if v_cuenta_pagar is null then return jsonb_build_object('error', 'Cuenta 2.1.5 (Sueldos a pagar) no encontrada'); end if;

  -- Neto real a pagar
  select coalesce(sum(neto_pagar), 0) into v_balance
  from nomina_detalle where periodo_id = p_periodo_id;

  -- Líneas: solo conceptos CON cuenta contable asignada
  for v_row in
    select a.id as cuenta_id, a.code as codigo, a.name as nombre,
           sum(nl.monto_total) as monto_total
    from nomina_lineas nl
    join nomina_conceptos nc on nc.id = nl.concepto_id
    join nomina_detalle nd on nd.id = nl.nomina_detalle_id
    join accounts a on a.id = nc.account_id
    where nd.periodo_id = p_periodo_id and nc.account_id is not null
    group by a.id, a.code, a.name
    having abs(sum(nl.monto_total)) > 0
    order by a.code
  loop
    if v_row.monto_total > 0 then
      v_total_debe := v_total_debe + v_row.monto_total;
      v_lineas := v_lineas || jsonb_build_object('account_id', v_row.cuenta_id, 'code', v_row.codigo, 'name', v_row.nombre, 'debit', v_row.monto_total, 'credit', 0);
    else
      v_total_haber := v_total_haber + abs(v_row.monto_total);
      v_lineas := v_lineas || jsonb_build_object('account_id', v_row.cuenta_id, 'code', v_row.codigo, 'name', v_row.nombre, 'debit', 0, 'credit', abs(v_row.monto_total));
    end if;
  end loop;

  -- Balanceo: neto real a pagar va a 2.1.5
  v_balanced := (v_total_debe - v_total_haber) = v_balance;
  if v_balance > 0 then
    v_lineas := v_lineas || jsonb_build_object('account_id', v_cuenta_pagar, 'code', v_codigo_pagar, 'name', v_nombre_pagar, 'debit', 0, 'credit', v_balance);
    v_total_haber := v_total_haber + v_balance;
  elsif v_balance < 0 then
    v_lineas := v_lineas || jsonb_build_object('account_id', v_cuenta_pagar, 'code', v_codigo_pagar, 'name', v_nombre_pagar, 'debit', abs(v_balance), 'credit', 0);
    v_total_debe := v_total_debe + abs(v_balance);
  end if;

  -- Si es preview, devolver líneas sin insertar + desglose
  if p_preview then
    declare
      v_conceptos jsonb;
    begin
      select jsonb_agg(jsonb_build_object(
        'code', s.code, 'name', s.name,
        'concepto_codigo', s.codigo, 'concepto_nombre', s.nombre,
        'monto', s.monto
      ) order by s.code, s.codigo) into v_conceptos
      from (
        select a.code, a.name, nc.codigo, nc.nombre, sum(nl.monto_total) as monto
        from nomina_lineas nl
        join nomina_conceptos nc on nc.id = nl.concepto_id
        join nomina_detalle nd on nd.id = nl.nomina_detalle_id
        join accounts a on a.id = nc.account_id
        where nd.periodo_id = p_periodo_id and nc.account_id is not null
        group by a.code, a.name, nc.codigo, nc.nombre
        having abs(sum(nl.monto_total)) > 0
        union all
        select v_codigo_pagar, v_nombre_pagar, 'NETO', 'Neto a pagar a empleados', v_balance
        where v_balance > 0
        union all
        select v_codigo_pagar, v_nombre_pagar, 'NETO', 'Ajuste neto a pagar', -v_balance
        where v_balance < 0
      ) s;

      return jsonb_build_object('preview', true, 'lines', v_lineas, 'conceptos', coalesce(v_conceptos, '[]'::jsonb), 'total_debit', v_total_debe, 'total_credit', v_total_haber, 'balanced', v_balanced);
    end;
  end if;

  -- Contabilizar
  v_entry_number := 'NOM-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));
  insert into journal_entries (company_id, entry_number, entry_date, description, source_type, source_id, total_debit, total_credit, estado)
  values (v_cid, v_entry_number, now()::date,
          'Nómina: ' || coalesce(v_periodo.nombre, v_periodo.fecha_desde::text),
          'nomina', p_periodo_id, v_total_debe, v_total_haber, 'contabilizado')
  returning id into v_entry_id;

  -- Insertar líneas desde v_lineas
  insert into journal_entry_lines (journal_entry_id, account_id, debit, credit)
  select v_entry_id, (l->>'account_id')::uuid, (l->>'debit')::numeric, (l->>'credit')::numeric
  from jsonb_array_elements(v_lineas) l;

  return jsonb_build_object('entry_id', v_entry_id, 'entry_number', v_entry_number);
end;
$$;

-- 5. RPC: asiento de pago de nómina (descargo de la deuda vs banco)
create or replace function generar_asiento_pago_nomina(p_periodo_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_periodo record;
  v_cid uuid;
  v_neto numeric(12,2) := 0;
  v_cuenta_pagar uuid;
  v_cuenta_banco uuid;
  v_entry_id uuid;
  v_entry_number text;
begin
  select * into v_periodo from nomina_periodos where id = p_periodo_id;
  if not found then return jsonb_build_object('error', 'Período no encontrado'); end if;
  if v_periodo.estado != 'pagado' then
    return jsonb_build_object('error', 'El período debe estar pagado');
  end if;
  v_cid := v_periodo.company_id;

  select coalesce(sum(neto_pagar), 0) into v_neto
  from nomina_detalle where periodo_id = p_periodo_id;

  select id into v_cuenta_pagar from accounts where company_id = v_cid and code = '2.1.5';
  select id into v_cuenta_banco from accounts where company_id = v_cid and code = '1.1.2';

  if v_cuenta_pagar is null then return jsonb_build_object('error', 'Cuenta 2.1.5 no encontrada'); end if;
  if v_cuenta_banco is null then return jsonb_build_object('error', 'Cuenta 1.1.2 (Bancos) no encontrada. Creala en el Plan de Cuentas.'); end if;

  v_entry_number := 'PAG-NOM-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));

  insert into journal_entries (company_id, entry_number, entry_date, description, source_type, source_id, total_debit, total_credit, estado)
  values (v_cid, v_entry_number, now()::date,
          'Pago nómina: ' || coalesce(v_periodo.nombre, v_periodo.fecha_desde::text),
          'pago_nomina', p_periodo_id, v_neto, v_neto, 'contabilizado')
  returning id into v_entry_id;

  insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
  values (v_entry_id, v_cuenta_pagar, 'Cancelación nómina', v_neto, 0);

  insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
  values (v_entry_id, v_cuenta_banco, 'Pago a empleados', 0, v_neto);

  return jsonb_build_object('entry_id', v_entry_id, 'entry_number', v_entry_number);
end;
$$;


-- ============================================================
-- nomina-orden-calculo.sql
-- ============================================================
-- Orden de cálculo para conceptos de nómina
-- Los conceptos se calculan secuencialmente según orden_calculo
-- Los conceptos con orden_calculo menor se calculan primero y sus valores
-- están disponibles como variables en las fórmulas de los conceptos posteriores

alter table nomina_conceptos add column if not exists orden_calculo integer not null default 0;

-- Actualizar orden de cálculo para conceptos seed PY
update nomina_conceptos set orden_calculo = 1 where codigo = 'SALARIO';
update nomina_conceptos set orden_calculo = 2 where codigo = 'HE50';
update nomina_conceptos set orden_calculo = 3 where codigo = 'HE100';
update nomina_conceptos set orden_calculo = 4 where codigo = 'HE130';
update nomina_conceptos set orden_calculo = 5 where codigo = 'NOCTURNIDAD';
update nomina_conceptos set orden_calculo = 6 where codigo = 'VACACIONES';
update nomina_conceptos set orden_calculo = 7 where codigo = 'AGUINALDO';
update nomina_conceptos set orden_calculo = 10 where codigo = 'AUSENCIA';
update nomina_conceptos set orden_calculo = 15 where codigo = 'ADELANTO_QUINCENAL';
update nomina_conceptos set orden_calculo = 16 where codigo = 'ADELANTO_PAGADO';
update nomina_conceptos set orden_calculo = 17 where codigo = 'DESCUENTO_ADELANTO';
update nomina_conceptos set orden_calculo = 20 where codigo = 'BASE_IPS';
update nomina_conceptos set orden_calculo = 21 where codigo = 'BASE_IRP';
update nomina_conceptos set orden_calculo = 30 where codigo = 'IPS';
update nomina_conceptos set orden_calculo = 31 where codigo = 'IPS_PATRONAL';
update nomina_conceptos set orden_calculo = 40 where codigo = 'PRORRATEO_AGUINALDO';


-- ============================================================
-- nomina-complementario-fix.sql
-- ============================================================
alter table nomina_periodos
  drop constraint if exists nomina_periodos_company_id_fecha_desde_fecha_hasta_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'nomina_periodos_company_id_fecha_desde_fecha_hasta_tipo_key'
  ) then
    alter table nomina_periodos
      add constraint nomina_periodos_company_id_fecha_desde_fecha_hasta_tipo_key
      unique(company_id, fecha_desde, fecha_hasta, tipo);
  end if;
end;
$$;

-- Número Patronal IPS para exportación
alter table nomina_config add column if not exists numero_patronal text not null default '';


-- ============================================================
-- plan-triggers-setup.sql
-- ============================================================
-- Triggers de cuotas por plan
-- Rechazan INSERTS si se supera el límite del plan
-- Cubre todos los puntos de entrada (frontend, API, SQL directo)

-- 1. company_members → cuota: usuarios
create or replace function check_quota_usuarios()
returns trigger
language plpgsql
security definer
as $$
declare
  v_plan text;
  v_max integer;
  v_current integer;
begin
  select plan into v_plan from companies where id = new.company_id;
  if v_plan is null then return new; end if;

  select max_value into v_max from plan_quotas where plan = v_plan and quota_key = 'usuarios';
  if v_max is null or v_max = -1 then return new; end if;

  select count(*) into v_current from company_members where company_id = new.company_id;
  if v_current >= v_max then
    raise exception 'Límite de usuarios alcanzado (%) para tu plan actual. Actualizá tu plan para agregar más.', v_max;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_quota_usuarios on company_members;
create trigger trg_check_quota_usuarios
  before insert on company_members
  for each row execute function check_quota_usuarios();

-- 2. catalogo_productos → cuota: productos
create or replace function check_quota_productos()
returns trigger
language plpgsql
security definer
as $$
declare
  v_plan text;
  v_max integer;
  v_current integer;
begin
  select plan into v_plan from companies where id = new.company_id;
  if v_plan is null then return new; end if;

  select max_value into v_max from plan_quotas where plan = v_plan and quota_key = 'productos';
  if v_max is null or v_max = -1 then return new; end if;

  select count(*) into v_current from catalogo_productos where company_id = new.company_id;
  if v_current >= v_max then
    raise exception 'Límite de productos alcanzado (%) para tu plan actual. Actualizá tu plan para ampliarlo.', v_max;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_quota_productos on catalogo_productos;
create trigger trg_check_quota_productos
  before insert on catalogo_productos
  for each row execute function check_quota_productos();

-- 3. contacts → cuota: contactos
create or replace function check_quota_contactos()
returns trigger
language plpgsql
security definer
as $$
declare
  v_plan text;
  v_max integer;
  v_current integer;
begin
  select plan into v_plan from companies where id = new.company_id;
  if v_plan is null then return new; end if;

  select max_value into v_max from plan_quotas where plan = v_plan and quota_key = 'contactos';
  if v_max is null or v_max = -1 then return new; end if;

  select count(*) into v_current from contacts where company_id = new.company_id;
  if v_current >= v_max then
    raise exception 'Límite de contactos alcanzado (%) para tu plan actual. Actualizá tu plan para ampliarlo.', v_max;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_quota_contactos on contacts;
create trigger trg_check_quota_contactos
  before insert on contacts
  for each row execute function check_quota_contactos();

-- 4. deals → cuota: oportunidades
create or replace function check_quota_oportunidades()
returns trigger
language plpgsql
security definer
as $$
declare
  v_plan text;
  v_max integer;
  v_current integer;
begin
  select plan into v_plan from companies where id = new.company_id;
  if v_plan is null then return new; end if;

  select max_value into v_max from plan_quotas where plan = v_plan and quota_key = 'oportunidades';
  if v_max is null or v_max = -1 then return new; end if;

  select count(*) into v_current from deals where company_id = new.company_id;
  if v_current >= v_max then
    raise exception 'Límite de oportunidades alcanzado (%) para tu plan actual. Actualizá tu plan para ampliarlo.', v_max;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_quota_oportunidades on deals;
create trigger trg_check_quota_oportunidades
  before insert on deals
  for each row execute function check_quota_oportunidades();

-- 5. facturas → cuota: facturas_mes
create or replace function check_quota_facturas_mes()
returns trigger
language plpgsql
security definer
as $$
declare
  v_plan text;
  v_max integer;
  v_current integer;
begin
  select plan into v_plan from companies where id = new.company_id;
  if v_plan is null then return new; end if;

  select max_value into v_max from plan_quotas where plan = v_plan and quota_key = 'facturas_mes';
  if v_max is null or v_max = -1 then return new; end if;

  select count(*) into v_current
  from facturas
  where company_id = new.company_id
    and date_trunc('month', created_at) = date_trunc('month', now());
  if v_current >= v_max then
    raise exception 'Límite de facturas mensuales alcanzado (%) para tu plan actual. Actualizá tu plan para ampliarlo.', v_max;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_quota_facturas_mes on facturas;
create trigger trg_check_quota_facturas_mes
  before insert on facturas
  for each row execute function check_quota_facturas_mes();


-- ============================================================
-- pos-setup.sql
-- ============================================================
-- Módulo POS (Punto de Venta)
-- Ejecutar después de inventario-setup.sql

-- 1. Cajas registradoras
create table if not exists cajas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  nombre text not null,
  estado text not null default 'cerrada' check (estado in ('abierta', 'cerrada')),
  saldo_inicial numeric(12,2) not null default 0,
  saldo_actual numeric(12,2) not null default 0,
  almacen_id uuid references almacenes(id) on delete set null,
  usuario_apertura_id uuid references auth.users(id),
  apertura_en timestamptz,
  cierre_en timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cajas_company on cajas(company_id);

-- 2. Ventas POS (no electrónicas)
create table if not exists ventas_pos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  caja_id uuid not null references cajas(id),
  cliente_id uuid references contacts(id) on delete set null,
  numero integer not null,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(12,2) not null default 0,
  descuento numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  forma_pago text not null check (forma_pago in ('efectivo', 'tarjeta', 'transferencia', 'mixto')),
  monto_efectivo numeric(12,2) not null default 0,
  monto_tarjeta numeric(12,2) not null default 0,
  monto_transferencia numeric(12,2) not null default 0,
  monto_recibido numeric(12,2) not null default 0,
  monto_cambio numeric(12,2) not null default 0,
  factura_id uuid references facturas(id) on delete set null,
  created_at timestamptz not null default now(),
  usuario_id uuid references auth.users(id)
);

create index if not exists idx_ventas_pos_company on ventas_pos(company_id);
create index if not exists idx_ventas_pos_caja on ventas_pos(caja_id);
create index if not exists idx_ventas_pos_fecha on ventas_pos(created_at desc);

-- 3. Cierres de caja (corte Z)
create table if not exists cierres_caja (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  caja_id uuid not null references cajas(id),
  apertura_en timestamptz not null,
  cierre_en timestamptz not null default now(),
  saldo_inicial numeric(12,2) not null default 0,
  saldo_esperado numeric(12,2) not null default 0,
  saldo_real numeric(12,2) not null default 0,
  ventas_count integer not null default 0,
  ventas_total numeric(12,2) not null default 0,
  dif_esperada numeric(12,2) not null default 0,
  observaciones text,
  created_at timestamptz not null default now()
);

create index if not exists idx_cierres_caja_company on cierres_caja(company_id);

-- RLS
alter table cajas enable row level security;
alter table ventas_pos enable row level security;
alter table cierres_caja enable row level security;

drop policy if exists "cajas_select" on cajas;
create policy "cajas_select" on cajas for select using (public.is_member_of(company_id));
drop policy if exists "cajas_insert" on cajas;
create policy "cajas_insert" on cajas for insert with check (public.is_member_of(company_id));
drop policy if exists "cajas_update" on cajas;
create policy "cajas_update" on cajas for update using (public.is_member_of(company_id));
drop policy if exists "cajas_delete" on cajas;
create policy "cajas_delete" on cajas for delete using (public.is_member_of(company_id));

drop policy if exists "ventas_pos_select" on ventas_pos;
create policy "ventas_pos_select" on ventas_pos for select using (public.is_member_of(company_id));
drop policy if exists "ventas_pos_insert" on ventas_pos;
create policy "ventas_pos_insert" on ventas_pos for insert with check (public.is_member_of(company_id));

drop policy if exists "cierres_caja_select" on cierres_caja;
create policy "cierres_caja_select" on cierres_caja for select using (public.is_member_of(company_id));
drop policy if exists "cierres_caja_insert" on cierres_caja;
create policy "cierres_caja_insert" on cierres_caja for insert with check (public.is_member_of(company_id));

-- 4. RPC: Seed consumidor final
create or replace function seed_consumidor_final(p_company_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_id uuid;
begin
  select id into v_id from contacts
  where company_id = p_company_id and name = 'Consumidor Final' and tipo_documento is null;
  if v_id is null then
    insert into contacts (company_id, name, notes)
    values (p_company_id, 'Consumidor Final', 'Cliente por defecto para ventas POS')
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- 5. RPC: Abrir caja
create or replace function abrir_caja(p_caja_id uuid, p_saldo_inicial numeric)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_caja record;
begin
  select * into v_caja from cajas where id = p_caja_id for update;
  if v_caja.estado = 'abierta' then
    return jsonb_build_object('error', 'La caja ya está abierta');
  end if;
  update cajas set
    estado = 'abierta',
    saldo_inicial = p_saldo_inicial,
    saldo_actual = p_saldo_inicial,
    usuario_apertura_id = auth.uid(),
    apertura_en = now(),
    cierre_en = null
  where id = p_caja_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- 6. RPC: Cerrar caja (corte Z)
create or replace function cerrar_caja(p_caja_id uuid, p_saldo_real numeric, p_observaciones text default '')
returns jsonb
language plpgsql
security definer
as $$
declare
  v_caja record;
  v_ventas record;
  v_cierre_id uuid;
begin
  select * into v_caja from cajas where id = p_caja_id for update;
  if v_caja.estado = 'cerrada' then
    return jsonb_build_object('error', 'La caja ya está cerrada');
  end if;
  select count(*) as count, coalesce(sum(total), 0) as sum into v_ventas
  from ventas_pos
  where caja_id = p_caja_id and created_at >= v_caja.apertura_en;

  insert into cierres_caja (company_id, caja_id, apertura_en, cierre_en,
    saldo_inicial, saldo_esperado, saldo_real, ventas_count, ventas_total, dif_esperada, observaciones)
  values (v_caja.company_id, p_caja_id, v_caja.apertura_en, now(),
    v_caja.saldo_inicial, v_caja.saldo_actual, p_saldo_real, v_ventas.count, v_ventas.sum,
    p_saldo_real - v_caja.saldo_actual, p_observaciones)
  returning id into v_cierre_id;

  update cajas set estado = 'cerrada', saldo_actual = p_saldo_real, cierre_en = now()
  where id = p_caja_id;

  return jsonb_build_object('ok', true, 'cierre_id', v_cierre_id);
end;
$$;

-- 7. RPC: Registrar venta POS
create or replace function registrar_venta_pos(
  p_company_id uuid, p_caja_id uuid, p_cliente_id uuid,
  p_items jsonb, p_subtotal numeric, p_descuento numeric, p_total numeric,
  p_forma_pago text,
  p_monto_efectivo numeric, p_monto_tarjeta numeric, p_monto_transferencia numeric,
  p_monto_recibido numeric, p_monto_cambio numeric,
  p_banco text default null, p_referencia text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_caja record;
  v_numero integer;
  v_venta_id uuid;
  v_item jsonb;
  v_stock record;
begin
  -- Validar caja abierta
  select * into v_caja from cajas where id = p_caja_id for update;
  if v_caja.estado != 'abierta' then
    return jsonb_build_object('error', 'La caja no está abierta');
  end if;

  -- Validar y descontar stock
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select cantidad into v_stock
    from producto_stock
    where producto_id = (v_item->>'producto_id')::uuid
      and almacen_id = (v_item->>'almacen_id')::uuid
      and company_id = p_company_id;

    if v_stock is null or v_stock.cantidad < (v_item->>'cantidad')::numeric then
      return jsonb_build_object('error', 'Stock insuficiente para ' || coalesce(v_item->>'nombre', 'producto'));
    end if;
  end loop;

  -- Número correlativo
  select coalesce(max(numero), 0) + 1 into v_numero
  from ventas_pos where company_id = p_company_id;

  -- Insertar venta
  insert into ventas_pos (company_id, caja_id, cliente_id, numero,
    items, subtotal, descuento, total,
    forma_pago, monto_efectivo, monto_tarjeta, monto_transferencia,
    monto_recibido, monto_cambio, usuario_id, banco, referencia)
  values (p_company_id, p_caja_id, p_cliente_id, v_numero,
    p_items, p_subtotal, p_descuento, p_total,
    p_forma_pago, p_monto_efectivo, p_monto_tarjeta, p_monto_transferencia,
    p_monto_recibido, p_monto_cambio, auth.uid(), p_banco, p_referencia)
  returning id into v_venta_id;

  -- Descontar stock
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    update producto_stock
    set cantidad = cantidad - (v_item->>'cantidad')::numeric
    where producto_id = (v_item->>'producto_id')::uuid
      and almacen_id = (v_item->>'almacen_id')::uuid
      and company_id = p_company_id;
  end loop;

  -- Actualizar saldo de caja
  update cajas set saldo_actual = saldo_actual + p_total
  where id = p_caja_id;

  return jsonb_build_object('ok', true, 'venta_id', v_venta_id, 'numero', v_numero);
end;
$$;

-- 9. Agregar QR como forma de pago + banco + referencia
alter table ventas_pos drop constraint if exists ventas_pos_forma_pago_check;
alter table ventas_pos add constraint ventas_pos_forma_pago_check
  check (forma_pago in ('efectivo', 'tarjeta', 'transferencia', 'mixto', 'qr'));
alter table ventas_pos add column if not exists banco text;
alter table ventas_pos add column if not exists referencia text;

-- 10. Trigger: descontar stock en ventas POS (respaldo)
drop trigger if exists trg_venta_pos_descuenta_stock on ventas_pos;
