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
