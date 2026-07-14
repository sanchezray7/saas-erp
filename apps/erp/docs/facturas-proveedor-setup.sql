-- Facturas de proveedor + cotejo 3 vías (OC ↔ Recepción ↔ Factura)
-- Ejecutar después de srm-setup.sql

-- Cabecera de factura de proveedor
create table if not exists proveedor_facturas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  proveedor_id uuid not null references proveedores(id),
  orden_id uuid references ordenes_compra(id) on delete set null,
  numero_factura text not null,
  timbrado text,
  fecha_emision date not null default now()::date,
  fecha_vencimiento date,
  subtotal numeric(12,2) not null default 0,
  impuesto numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  moneda text not null default 'PYG',
  estado text not null default 'pendiente' check (estado in ('pendiente', 'conciliada', 'discrepancia', 'pagada', 'anulada')),
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_proveedor_facturas_company on proveedor_facturas(company_id, created_at desc);

-- Ítems de factura de proveedor
create table if not exists proveedor_factura_items (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references proveedor_facturas(id) on delete cascade,
  producto_id uuid references catalogo_productos(id) on delete set null,
  orden_item_id uuid references orden_compra_items(id) on delete set null,
  descripcion text,
  cantidad numeric(12,2) not null default 1,
  precio_unitario numeric(12,2) not null default 0,
  subtotal numeric(12,2) not null default 0
);

-- Columna para IVA por item en facturas de proveedor
alter table proveedor_factura_items add column if not exists iva_id uuid references taxes(id) on delete set null;
alter table proveedor_factura_items add column if not exists account_compra_id uuid references accounts(id) on delete set null;

-- RLS
alter table proveedor_facturas enable row level security;
alter table proveedor_factura_items enable row level security;

drop policy if exists "proveedor_facturas_select" on proveedor_facturas;
create policy "proveedor_facturas_select" on proveedor_facturas for select using (public.is_member_of(company_id));
drop policy if exists "proveedor_facturas_insert" on proveedor_facturas;
create policy "proveedor_facturas_insert" on proveedor_facturas for insert with check (public.is_member_of(company_id));
drop policy if exists "proveedor_facturas_update" on proveedor_facturas;
create policy "proveedor_facturas_update" on proveedor_facturas for update using (public.is_member_of(company_id));
drop policy if exists "proveedor_facturas_delete" on proveedor_facturas;
create policy "proveedor_facturas_delete" on proveedor_facturas for delete using (public.is_member_of(company_id));

drop policy if exists "proveedor_factura_items_select" on proveedor_factura_items;
create policy "proveedor_factura_items_select" on proveedor_factura_items for select using (exists (select 1 from proveedor_facturas f where f.id = factura_id and public.is_member_of(f.company_id)));
drop policy if exists "proveedor_factura_items_insert" on proveedor_factura_items;
create policy "proveedor_factura_items_insert" on proveedor_factura_items for insert with check (exists (select 1 from proveedor_facturas f where f.id = factura_id and public.is_member_of(f.company_id)));
drop policy if exists "proveedor_factura_items_delete" on proveedor_factura_items;
create policy "proveedor_factura_items_delete" on proveedor_factura_items for delete using (exists (select 1 from proveedor_facturas f where f.id = factura_id and public.is_member_of(f.company_id)));

-- RPC: cotejar factura contra OC y recepción
create or replace function cotejar_factura(p_factura_id uuid)
returns jsonb
language plpgsql
stable
as $$
declare
  v_factura record;
  v_resultado jsonb;
  v_discrepancia boolean := false;
  v_items jsonb := '[]'::jsonb;
  v_item jsonb;
  v_orden_cantidad numeric(12,2);
  v_orden_precio numeric(12,2);
  v_orden_recibido numeric(12,2);
  v_orden_item_id uuid;
begin
  select f.*, p.nombre as proveedor_nombre
  into v_factura
  from proveedor_facturas f
  join proveedores p on p.id = f.proveedor_id
  where f.id = p_factura_id;

  if not found then
    return jsonb_build_object('error', 'Factura no encontrada');
  end if;

  -- Para cada item de la factura, buscar su contraparte en la OC y recepción
  for v_item in select to_jsonb(t.*) from proveedor_factura_items t where factura_id = p_factura_id
  loop
    v_orden_item_id := (v_item->>'orden_item_id')::uuid;
    v_orden_recibido := 0;

    if v_orden_item_id is not null then
      select cantidad, precio_unitario, cantidad_recibida into v_orden_cantidad, v_orden_precio, v_orden_recibido
      from orden_compra_items where id = v_orden_item_id;
    else
      select id, cantidad, precio_unitario, cantidad_recibida into v_orden_item_id, v_orden_cantidad, v_orden_precio, v_orden_recibido
      from orden_compra_items
      where orden_id = v_factura.orden_id and producto_id = (v_item->>'producto_id')::uuid
      limit 1;
    end if;

    v_items := v_items || jsonb_build_object(
      'producto_id', v_item->>'producto_id',
      'descripcion', v_item->>'descripcion',
      'cantidad_pedida', coalesce(v_orden_cantidad, 0),
      'cantidad_recibida', coalesce(v_orden_recibido, 0),
      'cantidad_facturada', (v_item->>'cantidad')::numeric,
      'precio_oc', coalesce(v_orden_precio, 0),
      'precio_factura', (v_item->>'precio_unitario')::numeric,
      'coincide_cantidad', case when v_orden_item_id is not null then coalesce(v_orden_recibido, 0) = (v_item->>'cantidad')::numeric else null end,
      'coincide_precio', case when v_orden_item_id is not null then (coalesce(v_orden_precio, 0) = (v_item->>'precio_unitario')::numeric) else null end
    );

    if (v_orden_item_id is null)
      or (coalesce(v_orden_recibido, 0) != (v_item->>'cantidad')::numeric)
      or (coalesce(v_orden_precio, 0) != (v_item->>'precio_unitario')::numeric)
    then
      v_discrepancia := true;
    end if;
  end loop;

  v_resultado := jsonb_build_object(
    'factura_id', p_factura_id,
    'proveedor_nombre', v_factura.proveedor_nombre,
    'numero_factura', v_factura.numero_factura,
    'total_factura', v_factura.total,
    'moneda', v_factura.moneda,
    'discrepancia', v_discrepancia,
    'items', v_items
  );

  return v_resultado;
end;
$$;
