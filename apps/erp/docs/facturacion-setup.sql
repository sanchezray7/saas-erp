-- Facturación electrónica (e-kuatia/SIFEN)
-- Ejecutar después de crm-setup.sql

create table if not exists facturas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  cotizacion_id uuid references cotizaciones(id) on delete set null,
  cdc text,
  numero text,
  timbrado text,
  xml_generado text,
  total numeric(12,2) not null default 0,
  moneda text not null default 'PYG',
  estado text not null default 'emitida'
    check (estado in ('emitida', 'aprobada', 'rechazada', 'cancelada')),
  errores text,
  created_at timestamptz not null default now()
);

-- subtotal e impuesto para asientos contables
alter table facturas add column if not exists subtotal numeric(12,2) not null default 0;
alter table facturas add column if not exists impuesto numeric(12,2) not null default 0;

drop policy if exists "facturas_select" on facturas;
create policy "facturas_select" on facturas for select
  using (public.is_member_of(company_id));

drop policy if exists "facturas_insert" on facturas;
create policy "facturas_insert" on facturas for insert
  with check (public.is_member_of(company_id));

drop policy if exists "facturas_update" on facturas;
create policy "facturas_update" on facturas for update
  using (public.is_member_of(company_id));

create index if not exists idx_facturas_company on facturas(company_id, created_at desc);

-- Contador secuencial por establecimiento + punto de expedición
create table if not exists factura_contadores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  establecimiento text not null,
  punto_expedicion text not null,
  contador integer not null default 0,
  created_at timestamptz not null default now(),
  unique(company_id, establecimiento, punto_expedicion)
);

alter table factura_contadores enable row level security;

drop policy if exists "factura_contadores_select" on factura_contadores;
create policy "factura_contadores_select" on factura_contadores for select
  using (public.is_member_of(company_id));

drop policy if exists "factura_contadores_insert" on factura_contadores;
create policy "factura_contadores_insert" on factura_contadores for insert
  with check (public.is_member_of(company_id));

drop policy if exists "factura_contadores_update" on factura_contadores;
create policy "factura_contadores_update" on factura_contadores for update
  using (public.is_member_of(company_id));

create or replace function incrementar_contador_factura(p_company_id uuid, p_establecimiento text default '001', p_punto_exp text default '001')
returns jsonb
language plpgsql
security definer
as $$
declare
  v_count integer;
  v_formato text;
begin
  insert into factura_contadores (company_id, establecimiento, punto_expedicion, contador)
  values (p_company_id, p_establecimiento, p_punto_exp, 1)
  on conflict (company_id, establecimiento, punto_expedicion)
  do update set contador = factura_contadores.contador + 1
  returning contador into v_count;

  v_formato := p_establecimiento || '-' || p_punto_exp || '-' || lpad(v_count::text, 7, '0');

  return jsonb_build_object('numero_doc', v_count, 'numero_formateado', v_formato);
end;
$$;
