-- Módulo de Inventario (@saas/inventario)
-- Ejecutar después de srm-setup.sql y accounting-setup.sql

-- Centros logísticos
create table if not exists centros_logisticos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  nombre text not null,
  direccion text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_centros_company on centros_logisticos(company_id);

-- Almacenes dentro de cada centro
create table if not exists almacenes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  centro_id uuid not null references centros_logisticos(id) on delete cascade,
  nombre text not null,
  tipo text not null default 'general' check (tipo in ('general', 'refrigerado', 'congelado', 'peligroso', 'cuarentena')),
  direccion text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_almacenes_company on almacenes(company_id);
create index if not exists idx_almacenes_centro on almacenes(centro_id);

-- Stock actual por producto + almacén
create table if not exists producto_stock (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  producto_id uuid not null references catalogo_productos(id) on delete cascade,
  almacen_id uuid not null references almacenes(id) on delete cascade,
  cantidad numeric(12,2) not null default 0,
  costo_promedio numeric(12,2) not null default 0,
  stock_minimo numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, producto_id, almacen_id)
);

create index if not exists idx_producto_stock_company on producto_stock(company_id);
create index if not exists idx_producto_stock_producto on producto_stock(producto_id);
create index if not exists idx_producto_stock_almacen on producto_stock(almacen_id);

-- Historial de movimientos
create table if not exists movimientos_stock (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  producto_id uuid not null references catalogo_productos(id) on delete cascade,
  almacen_id uuid not null references almacenes(id) on delete cascade,
  tipo text not null check (tipo in ('entrada', 'salida', 'ajuste')),
  cantidad numeric(12,2) not null,
  costo_unitario numeric(12,2),
  lote text,
  fecha_vencimiento date,
  referencia_type text,
  referencia_id uuid,
  motivo text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_movimientos_company on movimientos_stock(company_id);
create index if not exists idx_movimientos_producto on movimientos_stock(producto_id);
create index if not exists idx_movimientos_almacen on movimientos_stock(almacen_id);

-- RLS
alter table centros_logisticos enable row level security;
alter table almacenes enable row level security;
alter table producto_stock enable row level security;
alter table movimientos_stock enable row level security;

drop policy if exists "centros_select" on centros_logisticos;
create policy "centros_select" on centros_logisticos for select using (public.is_member_of(company_id));
drop policy if exists "centros_insert" on centros_logisticos;
create policy "centros_insert" on centros_logisticos for insert with check (public.is_member_of(company_id));
drop policy if exists "centros_update" on centros_logisticos;
create policy "centros_update" on centros_logisticos for update using (public.is_member_of(company_id));
drop policy if exists "centros_delete" on centros_logisticos;
create policy "centros_delete" on centros_logisticos for delete using (public.is_member_of(company_id));

drop policy if exists "almacenes_select" on almacenes;
create policy "almacenes_select" on almacenes for select using (public.is_member_of(company_id));
drop policy if exists "almacenes_insert" on almacenes;
create policy "almacenes_insert" on almacenes for insert with check (public.is_member_of(company_id));
drop policy if exists "almacenes_update" on almacenes;
create policy "almacenes_update" on almacenes for update using (public.is_member_of(company_id));
drop policy if exists "almacenes_delete" on almacenes;
create policy "almacenes_delete" on almacenes for delete using (public.is_member_of(company_id));

drop policy if exists "producto_stock_select" on producto_stock;
create policy "producto_stock_select" on producto_stock for select using (public.is_member_of(company_id));
drop policy if exists "producto_stock_insert" on producto_stock;
create policy "producto_stock_insert" on producto_stock for insert with check (public.is_member_of(company_id));
drop policy if exists "producto_stock_update" on producto_stock;
create policy "producto_stock_update" on producto_stock for update using (public.is_member_of(company_id));

drop policy if exists "movimientos_stock_select" on movimientos_stock;
create policy "movimientos_stock_select" on movimientos_stock for select using (public.is_member_of(company_id));
drop policy if exists "movimientos_stock_insert" on movimientos_stock;
create policy "movimientos_stock_insert" on movimientos_stock for insert with check (public.is_member_of(company_id));

-- Stock mínimo global por producto
alter table catalogo_productos add column if not exists stock_minimo numeric(12,2) not null default 0;

-- Conteos cíclicos / inventario físico
create table if not exists conteos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  almacen_id uuid not null references almacenes(id),
  numero text not null,
  fecha date not null default now(),
  estado text not null default 'abierto' check (estado in ('abierto', 'contando', 'cerrado')),
  observaciones text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_conteos_company on conteos(company_id);

create table if not exists conteo_items (
  id uuid primary key default gen_random_uuid(),
  conteo_id uuid not null references conteos(id) on delete cascade,
  producto_id uuid not null references catalogo_productos(id),
  lote text,
  cantidad_sistema numeric(12,2) not null default 0,
  cantidad_contada numeric(12,2),
  diferencia numeric(12,2) not null default 0,
  unique(conteo_id, producto_id)
);

alter table conteos enable row level security;
alter table conteo_items enable row level security;

drop policy if exists "conteos_select" on conteos;
create policy "conteos_select" on conteos for select using (public.is_member_of(company_id));
drop policy if exists "conteos_insert" on conteos;
create policy "conteos_insert" on conteos for insert with check (public.is_member_of(company_id));
drop policy if exists "conteos_update" on conteos;
create policy "conteos_update" on conteos for update using (public.is_member_of(company_id));
drop policy if exists "conteos_delete" on conteos;
create policy "conteos_delete" on conteos for delete using (public.is_member_of(company_id));

drop policy if exists "conteo_items_select" on conteo_items;
create policy "conteo_items_select" on conteo_items for select using (exists (select 1 from conteos c where c.id = conteo_id and public.is_member_of(c.company_id)));
drop policy if exists "conteo_items_insert" on conteo_items;
create policy "conteo_items_insert" on conteo_items for insert with check (exists (select 1 from conteos c where c.id = conteo_id and public.is_member_of(c.company_id)));
drop policy if exists "conteo_items_update" on conteo_items;
create policy "conteo_items_update" on conteo_items for update using (exists (select 1 from conteos c where c.id = conteo_id and public.is_member_of(c.company_id)));

-- RPC: generar número de conteo
create or replace function generar_numero_conteo(p_company_id uuid)
returns text
language sql
stable
as $$
  select 'CT-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(
    ((select count(*) from conteos where company_id = p_company_id and created_at::date = now()::date) + 1)::text,
  4, '0');
$$;

-- Código de barras en productos
alter table catalogo_productos add column if not exists codigo_barras text;

-- Ubicaciones dentro de almacenes
create table if not exists ubicaciones (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  almacen_id uuid not null references almacenes(id) on delete cascade,
  nombre text not null,
  pasillo text,
  estante text,
  posicion text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique(company_id, almacen_id, nombre)
);

create index if not exists idx_ubicaciones_almacen on ubicaciones(almacen_id);

alter table ubicaciones enable row level security;
drop policy if exists "ubicaciones_select" on ubicaciones;
create policy "ubicaciones_select" on ubicaciones for select using (public.is_member_of(company_id));
drop policy if exists "ubicaciones_insert" on ubicaciones;
create policy "ubicaciones_insert" on ubicaciones for insert with check (public.is_member_of(company_id));
drop policy if exists "ubicaciones_update" on ubicaciones;
create policy "ubicaciones_update" on ubicaciones for update using (public.is_member_of(company_id));
drop policy if exists "ubicaciones_delete" on ubicaciones;
create policy "ubicaciones_delete" on ubicaciones for delete using (public.is_member_of(company_id));

-- Ubicación en stock
alter table producto_stock add column if not exists ubicacion_id uuid references ubicaciones(id) on delete set null;

-- Transportistas
create table if not exists transportistas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  nombre text not null,
  ruc text,
  telefono text,
  contacto text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_transportistas_company on transportistas(company_id);

alter table transportistas enable row level security;
drop policy if exists "transportistas_select" on transportistas;
create policy "transportistas_select" on transportistas for select using (public.is_member_of(company_id));
drop policy if exists "transportistas_insert" on transportistas;
create policy "transportistas_insert" on transportistas for insert with check (public.is_member_of(company_id));
drop policy if exists "transportistas_update" on transportistas;
create policy "transportistas_update" on transportistas for update using (public.is_member_of(company_id));
drop policy if exists "transportistas_delete" on transportistas;
create policy "transportistas_delete" on transportistas for delete using (public.is_member_of(company_id));

-- Órdenes de picking
create table if not exists picking_ordenes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  factura_id uuid references facturas(id) on delete set null,
  numero text not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'preparando', 'preparado', 'despachado')),
  creado_por uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_picking_company on picking_ordenes(company_id);

create table if not exists picking_items (
  id uuid primary key default gen_random_uuid(),
  picking_id uuid not null references picking_ordenes(id) on delete cascade,
  producto_id uuid not null references catalogo_productos(id),
  cantidad_solicitada numeric(12,2) not null default 0,
  cantidad_preparada numeric(12,2) not null default 0,
  ubicacion_id uuid references ubicaciones(id) on delete set null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'listo')),
  unique(picking_id, producto_id)
);

alter table picking_ordenes enable row level security;
alter table picking_items enable row level security;

drop policy if exists "picking_ordenes_select" on picking_ordenes;
create policy "picking_ordenes_select" on picking_ordenes for select using (public.is_member_of(company_id));
drop policy if exists "picking_ordenes_insert" on picking_ordenes;
create policy "picking_ordenes_insert" on picking_ordenes for insert with check (public.is_member_of(company_id));
drop policy if exists "picking_ordenes_update" on picking_ordenes;
create policy "picking_ordenes_update" on picking_ordenes for update using (public.is_member_of(company_id));

drop policy if exists "picking_items_select" on picking_items;
create policy "picking_items_select" on picking_items for select using (exists (select 1 from picking_ordenes po where po.id = picking_id and public.is_member_of(po.company_id)));
drop policy if exists "picking_items_insert" on picking_items;
create policy "picking_items_insert" on picking_items for insert with check (exists (select 1 from picking_ordenes po where po.id = picking_id and public.is_member_of(po.company_id)));
drop policy if exists "picking_items_update" on picking_items;
create policy "picking_items_update" on picking_items for update using (exists (select 1 from picking_ordenes po where po.id = picking_id and public.is_member_of(po.company_id)));

-- Remitos
create table if not exists remitos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  picking_id uuid references picking_ordenes(id) on delete set null,
  factura_id uuid references facturas(id) on delete set null,
  numero text not null,
  fecha date not null default now(),
  transportista_id uuid references transportistas(id) on delete set null,
  chofer text,
  patente text,
  destino text,
  created_at timestamptz not null default now()
);

create index if not exists idx_remitos_company on remitos(company_id);

alter table remitos enable row level security;
drop policy if exists "remitos_select" on remitos;
create policy "remitos_select" on remitos for select using (public.is_member_of(company_id));
drop policy if exists "remitos_insert" on remitos;
create policy "remitos_insert" on remitos for insert with check (public.is_member_of(company_id));

-- RPC número de picking
create or replace function generar_numero_picking(p_company_id uuid)
returns text
language sql
stable
as $$
  select 'PK-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(
    ((select count(*) from picking_ordenes where company_id = p_company_id and created_at::date = now()::date) + 1)::text, 4, '0');
$$;

-- RPC número de remito
create or replace function generar_numero_remito(p_company_id uuid)
returns text
language sql
stable
as $$
  select 'RE-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(
    ((select count(*) from remitos where company_id = p_company_id and created_at::date = now()::date) + 1)::text, 4, '0');
$$;
