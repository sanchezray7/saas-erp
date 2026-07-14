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
