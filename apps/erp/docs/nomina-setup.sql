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
