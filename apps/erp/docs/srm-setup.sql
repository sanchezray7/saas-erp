-- SRM — Supplier Relationship Management
-- Ejecutar después de crm-setup.sql y catalogo-setup.sql

-- 1. Proveedores
create table if not exists proveedores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  nombre text not null,
  ruc text,
  email text,
  telefono text,
  direccion text,
  sitio_web text,
  categoria text,
  estado text not null default 'activo' check (estado in ('activo', 'inactivo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table proveedores enable row level security;

drop policy if exists "proveedores_select" on proveedores;
create policy "proveedores_select" on proveedores for select using (public.is_member_of(company_id));
drop policy if exists "proveedores_insert" on proveedores;
create policy "proveedores_insert" on proveedores for insert with check (public.is_member_of(company_id));
drop policy if exists "proveedores_update" on proveedores;
create policy "proveedores_update" on proveedores for update using (public.is_member_of(company_id));
drop policy if exists "proveedores_delete" on proveedores;
create policy "proveedores_delete" on proveedores for delete using (public.is_member_of(company_id));

create index if not exists idx_proveedores_company on proveedores(company_id, nombre);

-- 2. Precios de productos por proveedor
create table if not exists proveedor_productos (
  proveedor_id uuid not null references proveedores(id) on delete cascade,
  producto_id uuid not null references catalogo_productos(id) on delete cascade,
  precio_proveedor numeric(12,2) default 0,
  moneda text default 'PYG',
  created_at timestamptz not null default now(),
  primary key (proveedor_id, producto_id)
);

alter table proveedor_productos enable row level security;
drop policy if exists "proveedor_productos_select" on proveedor_productos;
create policy "proveedor_productos_select" on proveedor_productos for select
  using (exists (select 1 from proveedores p where p.id = proveedor_id and public.is_member_of(p.company_id)));
drop policy if exists "proveedor_productos_insert" on proveedor_productos;
create policy "proveedor_productos_insert" on proveedor_productos for insert
  with check (exists (select 1 from proveedores p where p.id = proveedor_id and public.is_member_of(p.company_id)));
drop policy if exists "proveedor_productos_delete" on proveedor_productos;
create policy "proveedor_productos_delete" on proveedor_productos for delete
  using (exists (select 1 from proveedores p where p.id = proveedor_id and public.is_member_of(p.company_id)));

-- 3. Órdenes de compra
create table if not exists ordenes_compra (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  proveedor_id uuid not null references proveedores(id),
  numero text not null,
  fecha_emision timestamptz not null default now(),
  fecha_entrega_estimada date,
  estado text not null default 'borrador'
    check (estado in ('borrador', 'enviada', 'confirmada', 'recibida', 'cancelada')),
  subtotal numeric(12,2) not null default 0,
  impuesto numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  moneda text not null default 'PYG',
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table ordenes_compra enable row level security;
drop policy if exists "ordenes_compra_select" on ordenes_compra;
create policy "ordenes_compra_select" on ordenes_compra for select using (public.is_member_of(company_id));
drop policy if exists "ordenes_compra_insert" on ordenes_compra;
create policy "ordenes_compra_insert" on ordenes_compra for insert with check (public.is_member_of(company_id));
drop policy if exists "ordenes_compra_update" on ordenes_compra;
create policy "ordenes_compra_update" on ordenes_compra for update using (public.is_member_of(company_id));
drop policy if exists "ordenes_compra_delete" on ordenes_compra;
create policy "ordenes_compra_delete" on ordenes_compra for delete using (public.is_member_of(company_id));

create index if not exists idx_ordenes_compra_company on ordenes_compra(company_id, created_at desc);

-- 4. Items de orden de compra
create table if not exists orden_compra_items (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references ordenes_compra(id) on delete cascade,
  producto_id uuid not null references catalogo_productos(id),
  descripcion text,
  cantidad numeric(12,2) not null default 1,
  precio_unitario numeric(12,2) not null default 0,
  subtotal numeric(12,2) not null default 0,
  cantidad_recibida numeric(12,2) not null default 0
);

alter table orden_compra_items enable row level security;
drop policy if exists "orden_compra_items_select" on orden_compra_items;
create policy "orden_compra_items_select" on orden_compra_items for select
  using (exists (select 1 from ordenes_compra o where o.id = orden_id and public.is_member_of(o.company_id)));
drop policy if exists "orden_compra_items_insert" on orden_compra_items;
create policy "orden_compra_items_insert" on orden_compra_items for insert
  with check (exists (select 1 from ordenes_compra o where o.id = orden_id and public.is_member_of(o.company_id)));
drop policy if exists "orden_compra_items_delete" on orden_compra_items;
create policy "orden_compra_items_delete" on orden_compra_items for delete
  using (exists (select 1 from ordenes_compra o where o.id = orden_id and public.is_member_of(o.company_id)));
drop policy if exists "orden_compra_items_update" on orden_compra_items;
create policy "orden_compra_items_update" on orden_compra_items for update
  using (exists (select 1 from ordenes_compra o where o.id = orden_id and public.is_member_of(o.company_id)));

-- 5. Recepciones
create table if not exists recepciones (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  orden_id uuid references ordenes_compra(id) on delete set null,
  proveedor_id uuid not null references proveedores(id),
  fecha_recepcion timestamptz not null default now(),
  observaciones text,
  created_at timestamptz not null default now()
);

alter table recepciones enable row level security;
drop policy if exists "recepciones_select" on recepciones;
create policy "recepciones_select" on recepciones for select using (public.is_member_of(company_id));
drop policy if exists "recepciones_insert" on recepciones;
create policy "recepciones_insert" on recepciones for insert with check (public.is_member_of(company_id));
drop policy if exists "recepciones_delete" on recepciones;
create policy "recepciones_delete" on recepciones for delete using (public.is_member_of(company_id));

-- 6. Items recibidos
create table if not exists recepcion_items (
  id uuid primary key default gen_random_uuid(),
  recepcion_id uuid not null references recepciones(id) on delete cascade,
  producto_id uuid not null references catalogo_productos(id),
  cantidad_recibida numeric(12,2) not null,
  lote text,
  fecha_vencimiento date
);

alter table recepcion_items enable row level security;
drop policy if exists "recepcion_items_select" on recepcion_items;
create policy "recepcion_items_select" on recepcion_items for select
  using (exists (select 1 from recepciones r where r.id = recepcion_id and public.is_member_of(r.company_id)));
drop policy if exists "recepcion_items_insert" on recepcion_items;
create policy "recepcion_items_insert" on recepcion_items for insert
  with check (exists (select 1 from recepciones r where r.id = recepcion_id and public.is_member_of(r.company_id)));

-- 7. Evaluaciones de proveedores
create table if not exists evaluacion_proveedores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  proveedor_id uuid not null references proveedores(id),
  puntaje integer not null check (puntaje between 1 and 5),
  comentario text,
  evaluado_por uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table evaluacion_proveedores enable row level security;
drop policy if exists "evaluacion_proveedores_select" on evaluacion_proveedores;
create policy "evaluacion_proveedores_select" on evaluacion_proveedores for select using (public.is_member_of(company_id));
drop policy if exists "evaluacion_proveedores_insert" on evaluacion_proveedores;
create policy "evaluacion_proveedores_insert" on evaluacion_proveedores for insert with check (public.is_member_of(company_id));
drop policy if exists "evaluacion_proveedores_delete" on evaluacion_proveedores;
create policy "evaluacion_proveedores_delete" on evaluacion_proveedores for delete using (public.is_member_of(company_id));

create index if not exists idx_evaluacion_proveedor on evaluacion_proveedores(proveedor_id);
