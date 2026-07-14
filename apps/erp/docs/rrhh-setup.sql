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
