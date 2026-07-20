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
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cal_turnos_cal_fecha') then
    alter table calendario_turnos add constraint cal_turnos_cal_fecha unique (calendario_id, fecha);
  end if;
end;
$$;

-- 3. Agregar calendario_id a empleado_rotacion
alter table empleado_rotacion add column if not exists calendario_id uuid references calendarios(id) on delete set null;

-- 4. Migrar datos existentes: crear calendario por cada empleado que tenga datos en calendario_turnos
-- (opcional, para bases existentes)
