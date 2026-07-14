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
