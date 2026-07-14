-- Países soportados por el CRM LATAM
-- Ejecutar después de crm-setup.sql

create table if not exists paises (
  codigo text primary key,
  nombre text not null,
  tax_id_label text not null,
  moneda text not null,
  locale text not null default 'es',
  bandera text not null,
  activo boolean not null default true
);

alter table paises enable row level security;

-- Cualquiera puede leer paises (público)
drop policy if exists "paises_select" on paises;
create policy "paises_select" on paises for select
  using (true);

-- Seed data
insert into paises (codigo, nombre, tax_id_label, moneda, locale, bandera) values
  ('PY', 'Paraguay', 'RUC', 'PYG', 'es', '🇵🇾'),
  ('AR', 'Argentina', 'CUIT', 'ARS', 'es', '🇦🇷'),
  ('CL', 'Chile', 'RUT', 'CLP', 'es', '🇨🇱'),
  ('CO', 'Colombia', 'NIT', 'COP', 'es', '🇨🇴'),
  ('PE', 'Perú', 'RUC', 'PEN', 'es', '🇵🇪'),
  ('UY', 'Uruguay', 'RUT', 'UYU', 'es', '🇺🇾'),
  ('BO', 'Bolivia', 'NIT', 'BOB', 'es', '🇧🇴'),
  ('EC', 'Ecuador', 'RUC', 'USD', 'es', '🇪🇨'),
  ('VE', 'Venezuela', 'RIF', 'USD', 'es', '🇻🇪'),
  ('MX', 'México', 'RFC', 'MXN', 'es', '🇲🇽'),
  ('BR', 'Brasil', 'CNPJ', 'BRL', 'pt-BR', '🇧🇷')
on conflict (codigo) do nothing;

-- RPC para listar países activos
create or replace function listar_paises()
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'codigo', p.codigo,
      'nombre', p.nombre,
      'tax_id_label', p.tax_id_label,
      'moneda', p.moneda,
      'locale', p.locale,
      'bandera', p.bandera
    ) order by p.nombre
  ), '[]'::jsonb)
  from paises p
  where p.activo = true;
$$;
