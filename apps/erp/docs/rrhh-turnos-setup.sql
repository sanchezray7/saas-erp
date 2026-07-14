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

