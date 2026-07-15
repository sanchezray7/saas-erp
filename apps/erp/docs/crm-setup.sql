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
           jsonb_agg(distinct jsonb_build_object('id', c.id, 'name', c.name)),
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
