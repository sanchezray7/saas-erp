-- Cotizaciones / Proformas para CRM LATAM
-- Ejecutar después de crm-setup.sql

-- 1. Tabla de cotizaciones
create table if not exists cotizaciones (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  deal_id uuid references deals(id) on delete set null,
  numero text not null,
  moneda text not null default 'PYG',
  subtotal numeric(12,2) not null default 0,
  impuesto numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  notas text,
  estado text not null default 'borrador'
    check (estado in ('borrador', 'enviada', 'aceptada', 'rechazada', 'facturada', 'cobrada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table cotizaciones enable row level security;

drop policy if exists "cotizaciones_select" on cotizaciones;
create policy "cotizaciones_select" on cotizaciones for select
  using (public.is_member_of(company_id));

drop policy if exists "cotizaciones_insert" on cotizaciones;
create policy "cotizaciones_insert" on cotizaciones for insert
  with check (public.is_member_of(company_id));

drop policy if exists "cotizaciones_update" on cotizaciones;
create policy "cotizaciones_update" on cotizaciones for update
  using (public.is_member_of(company_id));

drop policy if exists "cotizaciones_delete" on cotizaciones;
create policy "cotizaciones_delete" on cotizaciones for delete
  using (public.is_member_of(company_id));

create index if not exists idx_cotizaciones_company on cotizaciones(company_id, created_at desc);

-- 2. Tabla de items de cotización
create table if not exists cotizacion_items (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references cotizaciones(id) on delete cascade,
  descripcion text not null,
  cantidad numeric(12,2) not null default 1,
  precio_unitario numeric(12,2) not null default 0,
  subtotal numeric(12,2) not null default 0
);

-- Columna para IVA por item en cotizaciones
alter table cotizacion_items add column if not exists iva_id uuid references taxes(id) on delete set null;
-- Columna para cuenta de ingreso por item en cotizaciones
alter table cotizacion_items add column if not exists account_venta_id uuid references accounts(id) on delete set null;
alter table cotizacion_items add column if not exists producto_id uuid references catalogo_productos(id) on delete set null;

alter table cotizacion_items enable row level security;

drop policy if exists "cotizacion_items_select" on cotizacion_items;
create policy "cotizacion_items_select" on cotizacion_items for select
  using (exists (select 1 from cotizaciones c where c.id = cotizacion_id and public.is_member_of(c.company_id)));

drop policy if exists "cotizacion_items_insert" on cotizacion_items;
create policy "cotizacion_items_insert" on cotizacion_items for insert
  with check (exists (select 1 from cotizaciones c where c.id = cotizacion_id and public.is_member_of(c.company_id)));

drop policy if exists "cotizacion_items_delete" on cotizacion_items;
create policy "cotizacion_items_delete" on cotizacion_items for delete
  using (exists (select 1 from cotizaciones c where c.id = cotizacion_id and public.is_member_of(c.company_id)));

create index if not exists idx_cotizacion_items_cotizacion on cotizacion_items(cotizacion_id);

-- 3. Trigger para actualizar updated_at
create or replace function trg_cotizaciones_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_cotizaciones_updated_at on cotizaciones;
create trigger trg_cotizaciones_updated_at
  before update on cotizaciones
  for each row execute function trg_cotizaciones_updated_at();

-- 4. RPC para generar número de cotización
create or replace function generar_numero_cotizacion(p_company_id uuid)
returns text
language sql
stable
as $$
  select 'COT-' || to_char(now(), 'YYYY') || '-' ||
    lpad((coalesce(
      (select count(*)::int + 1 from cotizaciones where company_id = p_company_id and extract(year from created_at) = extract(year from now())),
      1
    )::text), 6, '0');
$$;

-- 5. Token público para compartir cotización sin login
alter table cotizaciones add column if not exists token uuid not null default gen_random_uuid();
create index if not exists idx_cotizaciones_token on cotizaciones(token);

-- 6. RPC público para obtener cotización por token (sin JWT)
create or replace function obtener_cotizacion_publica(p_token uuid)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'numero', c.numero,
    'moneda', c.moneda,
    'subtotal', c.subtotal,
    'impuesto', c.impuesto,
    'total', c.total,
    'notas', c.notas,
    'estado', c.estado,
    'created_at', c.created_at,
    'contacto', jsonb_build_object('name', ct.name),
    'empresa', jsonb_build_object('name', co.name, 'rif', co.rif, 'pais', co.pais),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'descripcion', i.descripcion,
        'cantidad', i.cantidad,
        'precio_unitario', i.precio_unitario,
        'subtotal', i.subtotal
      )) from cotizacion_items i where i.cotizacion_id = c.id
    ), '[]'::jsonb)
  )
  from cotizaciones c
  left join contacts ct on ct.id = c.contact_id
  join companies co on co.id = c.company_id
  where c.token = p_token;
$$;
