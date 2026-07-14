-- Catálogo de productos/servicios
-- Ejecutar después de crm-setup.sql

create table if not exists catalogo_productos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  codigo text,
  nombre text not null,
  descripcion text,
  precio_unitario numeric(12,2) not null default 0,
  moneda text not null default 'PYG',
  unidad_medida text default 'UNI',
  cod_unidad int default 77,
  activo boolean not null default true,
  tipo text not null default 'producto' check (tipo in ('producto', 'servicio')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table catalogo_productos enable row level security;

drop policy if exists "catalogo_select" on catalogo_productos;
create policy "catalogo_select" on catalogo_productos for select
  using (public.is_member_of(company_id));

drop policy if exists "catalogo_insert" on catalogo_productos;
create policy "catalogo_insert" on catalogo_productos for insert
  with check (public.is_member_of(company_id));

drop policy if exists "catalogo_update" on catalogo_productos;
create policy "catalogo_update" on catalogo_productos for update
  using (public.is_member_of(company_id));

drop policy if exists "catalogo_delete" on catalogo_productos;
create policy "catalogo_delete" on catalogo_productos for delete
  using (public.is_member_of(company_id));

create index if not exists idx_catalogo_company on catalogo_productos(company_id, nombre);
