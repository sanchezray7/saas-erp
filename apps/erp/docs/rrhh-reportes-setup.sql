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
