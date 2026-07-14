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
