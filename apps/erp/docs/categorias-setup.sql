-- Categorías de productos/servicios
-- Ejecutar después de catalogo-setup.sql

create table if not exists categorias (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  nombre text not null,
  tipo text not null check (tipo in ('producto', 'servicio')),
  parent_id uuid references categorias(id) on delete cascade,
  color text not null default '#6366f1',
  icono text not null default '📦',
  unique(company_id, tipo, nombre)
);

alter table catalogo_productos add column if not exists categoria_id uuid references categorias(id) on delete set null;
alter table catalogo_productos alter column tipo set default 'producto';

alter table categorias enable row level security;
drop policy if exists "categorias_select" on categorias;
create policy "categorias_select" on categorias for select using (public.is_member_of(company_id));
drop policy if exists "categorias_insert" on categorias;
create policy "categorias_insert" on categorias for insert with check (public.is_member_of(company_id));
drop policy if exists "categorias_update" on categorias;
create policy "categorias_update" on categorias for update using (public.is_member_of(company_id));
drop policy if exists "categorias_delete" on categorias;
create policy "categorias_delete" on categorias for delete using (public.is_member_of(company_id));
