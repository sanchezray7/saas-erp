-- Unidades de medida para productos/servicios
-- Basado en codificación SIFEN (TABLA 5)

create table if not exists unidades_medida (
  codigo int primary key,
  sigla text not null,
  nombre text not null,
  activo boolean not null default true
);

alter table unidades_medida enable row level security;

drop policy if exists "unidades_medida_select" on unidades_medida;
create policy "unidades_medida_select" on unidades_medida for select
  using (true);

-- Seed data
insert into unidades_medida (codigo, sigla, nombre) values
  (1, 'KG', 'Kilogramo'),
  (2, 'GR', 'Gramo'),
  (3, 'LT', 'Litro'),
  (4, 'ML', 'Mililitro'),
  (5, 'M', 'Metro'),
  (6, 'M2', 'Metro cuadrado'),
  (7, 'M3', 'Metro cúbico'),
  (8, 'CM', 'Centímetro'),
  (9, 'UNI', 'Unidad'),
  (10, 'PAR', 'Par'),
  (11, 'DOC', 'Docena'),
  (12, 'CAJ', 'Caja'),
  (13, 'PAQ', 'Paquete'),
  (14, 'BOL', 'Bolsa'),
  (15, 'TAR', 'Tarjeta'),
  (16, 'KIT', 'Kit'),
  (17, 'HR', 'Hora'),
  (18, 'DIA', 'Día'),
  (19, 'MES', 'Mes'),
  (20, 'SER', 'Servicio'),
  (21, 'CON', 'Consultoría'),
  (22, 'PRO', 'Proyecto'),
  (23, 'LTS', 'Lote'),
  (24, 'CIL', 'Cilindro'),
  (25, 'TON', 'Tonelada')
on conflict (codigo) do nothing;

-- RPC
create or replace function listar_unidades_medida()
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object('codigo', u.codigo, 'sigla', u.sigla, 'nombre', u.nombre)
    order by u.sigla
  ), '[]'::jsonb)
  from unidades_medida u
  where u.activo = true;
$$;
