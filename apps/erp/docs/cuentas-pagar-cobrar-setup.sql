-- Cuentas por Pagar / Cuentas por Cobrar
-- Ejecutar después de accounting-setup.sql y facturas-proveedor-setup.sql

-- ============================================================
-- 1. Medios de pago
-- ============================================================
create table if not exists medios_pago (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table medios_pago enable row level security;
drop policy if exists "medios_pago_select" on medios_pago;
create policy "medios_pago_select" on medios_pago for select using (public.is_member_of(company_id));
drop policy if exists "medios_pago_insert" on medios_pago;
create policy "medios_pago_insert" on medios_pago for insert with check (public.is_member_of(company_id));
drop policy if exists "medios_pago_delete" on medios_pago;
create policy "medios_pago_delete" on medios_pago for delete using (public.is_member_of(company_id));

-- ============================================================
-- 2. Pagos a proveedores (AP)
-- ============================================================
create table if not exists pagos_proveedor (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  factura_id uuid not null references proveedor_facturas(id) on delete cascade,
  medio_pago_id uuid references medios_pago(id) on delete set null,
  cuenta_banco_id uuid references accounts(id) on delete set null,
  monto numeric(12,2) not null,
  fecha_pago date not null default now()::date,
  referencia text,
  notas text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table pagos_proveedor enable row level security;
drop policy if exists "pagos_proveedor_select" on pagos_proveedor;
create policy "pagos_proveedor_select" on pagos_proveedor for select using (public.is_member_of(company_id));
drop policy if exists "pagos_proveedor_insert" on pagos_proveedor;
create policy "pagos_proveedor_insert" on pagos_proveedor for insert with check (public.is_member_of(company_id));
drop policy if exists "pagos_proveedor_delete" on pagos_proveedor;
create policy "pagos_proveedor_delete" on pagos_proveedor for delete using (public.is_member_of(company_id));

create index if not exists idx_pagos_proveedor_factura on pagos_proveedor(factura_id);
create index if not exists idx_pagos_proveedor_company on pagos_proveedor(company_id);

-- ============================================================
-- 3. Cobros a clientes (AR)
-- ============================================================
create table if not exists cobros_cliente (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  factura_id uuid not null references facturas(id) on delete cascade,
  medio_pago_id uuid references medios_pago(id) on delete set null,
  cuenta_banco_id uuid references accounts(id) on delete set null,
  monto numeric(12,2) not null,
  fecha_cobro date not null default now()::date,
  referencia text,
  notas text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table cobros_cliente enable row level security;
drop policy if exists "cobros_cliente_select" on cobros_cliente;
create policy "cobros_cliente_select" on cobros_cliente for select using (public.is_member_of(company_id));
drop policy if exists "cobros_cliente_insert" on cobros_cliente;
create policy "cobros_cliente_insert" on cobros_cliente for insert with check (public.is_member_of(company_id));
drop policy if exists "cobros_cliente_delete" on cobros_cliente;
create policy "cobros_cliente_delete" on cobros_cliente for delete using (public.is_member_of(company_id));

create index if not exists idx_cobros_cliente_factura on cobros_cliente(factura_id);
create index if not exists idx_cobros_cliente_company on cobros_cliente(company_id);

-- ============================================================
-- 4. Saldo pendiente en facturas
-- ============================================================
alter table proveedor_facturas add column if not exists saldo_pendiente numeric(12,2);

alter table facturas add column if not exists saldo_pendiente numeric(12,2);

-- ============================================================
-- 5. RPC: Calendario de pagos desde facturas proveedor (reemplaza OC)
-- ============================================================
create or replace function obtener_calendario_pagos(p_company_id uuid)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'resumen', jsonb_build_object(
      'vencidas', coalesce((select sum(coalesce(saldo_pendiente, total)) from proveedor_facturas
        where company_id = p_company_id and estado not in ('pagada', 'anulada')
        and fecha_vencimiento < now()::date), 0),
      'dias7', coalesce((select sum(coalesce(saldo_pendiente, total)) from proveedor_facturas
        where company_id = p_company_id and estado not in ('pagada', 'anulada')
        and fecha_vencimiento between now()::date and now()::date + 7), 0),
      'dias15', coalesce((select sum(coalesce(saldo_pendiente, total)) from proveedor_facturas
        where company_id = p_company_id and estado not in ('pagada', 'anulada')
        and fecha_vencimiento between now()::date + 8 and now()::date + 15), 0),
      'dias30', coalesce((select sum(coalesce(saldo_pendiente, total)) from proveedor_facturas
        where company_id = p_company_id and estado not in ('pagada', 'anulada')
        and fecha_vencimiento between now()::date + 16 and now()::date + 30), 0)
    ),
    'facturas', coalesce(jsonb_agg(
      jsonb_build_object(
        'id', f.id,
        'numero_factura', f.numero_factura,
        'total', f.total,
        'saldo_pendiente', coalesce(f.saldo_pendiente, f.total),
        'moneda', f.moneda,
        'fecha_vencimiento', f.fecha_vencimiento,
        'dias_restantes', (f.fecha_vencimiento - now()::date)::int,
        'estado', f.estado,
        'proveedor', jsonb_build_object('nombre', p.nombre, 'id', p.id)
      ) order by f.fecha_vencimiento
    ) filter (where f.estado not in ('pagada', 'anulada')), '[]'::jsonb)
  )
  from proveedor_facturas f
  join proveedores p on p.id = f.proveedor_id
  where f.company_id = p_company_id
  limit 1;
$$;

-- ============================================================
-- 6. RPC: Aging AP (antigüedad de deudas con proveedores)
-- ============================================================
create or replace function obtener_aging_ap(p_company_id uuid)
returns jsonb
language plpgsql
stable
as $$
declare
  v_total_vencido numeric;
  v_total_por_vencer numeric;
  v_total_general numeric;
  v_por_proveedor jsonb;
begin
  -- Totales generales
  select
    coalesce(sum(case when f.fecha_vencimiento < now()::date then coalesce(f.saldo_pendiente, f.total) else 0 end), 0),
    coalesce(sum(case when f.fecha_vencimiento >= now()::date then coalesce(f.saldo_pendiente, f.total) else 0 end), 0),
    coalesce(sum(coalesce(f.saldo_pendiente, f.total)), 0)
  into v_total_vencido, v_total_por_vencer, v_total_general
  from proveedor_facturas f
  where f.company_id = p_company_id and f.estado not in ('pagada', 'anulada');

  -- Por proveedor
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'proveedor_id', x.id,
      'proveedor_nombre', x.nombre,
      'total', x.total,
      'vencido', x.vencido,
      'por_vencer', x.por_vencer,
      'facturas', x.facturas
    ) order by x.total desc
  ), '[]'::jsonb) into v_por_proveedor
  from (
    select p.id, p.nombre,
      sum(coalesce(f.saldo_pendiente, f.total)) as total,
      sum(case when f.fecha_vencimiento < now()::date then coalesce(f.saldo_pendiente, f.total) else 0 end) as vencido,
      sum(case when f.fecha_vencimiento >= now()::date then coalesce(f.saldo_pendiente, f.total) else 0 end) as por_vencer,
      count(*) as facturas
    from proveedor_facturas f
    join proveedores p on p.id = f.proveedor_id
    where f.company_id = p_company_id and f.estado not in ('pagada', 'anulada')
    group by p.id, p.nombre
  ) x;

  return jsonb_build_object(
    'total_vencido', v_total_vencido,
    'total_por_vencer', v_total_por_vencer,
    'total_general', v_total_general,
    'buckets', jsonb_build_object(
      'a_vencer', coalesce((select sum(coalesce(saldo_pendiente, total)) from proveedor_facturas
        where company_id = p_company_id and estado not in ('pagada', 'anulada')
        and fecha_vencimiento >= now()::date), 0),
      'vencidas_30', coalesce((select sum(coalesce(saldo_pendiente, total)) from proveedor_facturas
        where company_id = p_company_id and estado not in ('pagada', 'anulada')
        and fecha_vencimiento < now()::date and fecha_vencimiento >= now()::date - 30), 0),
      'vencidas_60', coalesce((select sum(coalesce(saldo_pendiente, total)) from proveedor_facturas
        where company_id = p_company_id and estado not in ('pagada', 'anulada')
        and fecha_vencimiento < now()::date - 30 and fecha_vencimiento >= now()::date - 60), 0),
      'vencidas_90', coalesce((select sum(coalesce(saldo_pendiente, total)) from proveedor_facturas
        where company_id = p_company_id and estado not in ('pagada', 'anulada')
        and fecha_vencimiento < now()::date - 60 and fecha_vencimiento >= now()::date - 90), 0),
      'vencidas_mas_90', coalesce((select sum(coalesce(saldo_pendiente, total)) from proveedor_facturas
        where company_id = p_company_id and estado not in ('pagada', 'anulada')
        and fecha_vencimiento < now()::date - 90), 0)
    ),
    'por_proveedor', v_por_proveedor
  );
end;
$$;

-- ============================================================
-- 7. RPC: Aging AR (antigüedad de deudas de clientes)
-- ============================================================
create or replace function obtener_aging_ar(p_company_id uuid)
returns jsonb
language plpgsql
stable
as $$
declare
  v_total_vencido numeric;
  v_total_por_vencer numeric;
  v_total_general numeric;
  v_por_cliente jsonb;
begin
  select
    coalesce(sum(case when f.fecha_vencimiento < now()::date then coalesce(f.saldo_pendiente, f.total) else 0 end), 0),
    coalesce(sum(case when f.fecha_vencimiento >= now()::date then coalesce(f.saldo_pendiente, f.total) else 0 end), 0),
    coalesce(sum(coalesce(f.saldo_pendiente, f.total)), 0)
  into v_total_vencido, v_total_por_vencer, v_total_general
  from facturas f
  join cotizaciones cot on cot.id = f.cotizacion_id
  where cot.company_id = p_company_id and f.estado = 'aprobada';

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'cliente_id', sub.id,
      'cliente_nombre', sub.nombre,
      'total', sub.total,
      'vencido', sub.vencido,
      'por_vencer', sub.por_vencer,
      'facturas', sub.cantidad
    ) order by sub.total desc
  ), '[]'::jsonb) into v_por_cliente
  from (
    select
      coalesce(c.id::text, 'sin-cliente') as id,
      coalesce(c.name, 'Sin cliente') as nombre,
      sum(coalesce(f.saldo_pendiente, f.total)) as total,
      sum(case when f.fecha_vencimiento < now()::date then coalesce(f.saldo_pendiente, f.total) else 0 end) as vencido,
      sum(case when f.fecha_vencimiento >= now()::date then coalesce(f.saldo_pendiente, f.total) else 0 end) as por_vencer,
      count(*) as cantidad
    from facturas f
    join cotizaciones cot on cot.id = f.cotizacion_id
    left join contacts c on c.id = cot.contact_id
    where cot.company_id = p_company_id and f.estado = 'aprobada'
    group by c.id, c.name
  ) sub;

  return jsonb_build_object(
    'total_vencido', v_total_vencido,
    'total_por_vencer', v_total_por_vencer,
    'total_general', v_total_general,
    'buckets', jsonb_build_object(
      'a_vencer', coalesce((select sum(coalesce(ff.saldo_pendiente, ff.total)) from facturas ff
        join cotizaciones cot on cot.id = ff.cotizacion_id
        where cot.company_id = p_company_id and ff.estado = 'aprobada' and ff.fecha_vencimiento >= now()::date), 0),
      'vencidas_30', coalesce((select sum(coalesce(ff.saldo_pendiente, ff.total)) from facturas ff
        join cotizaciones cot on cot.id = ff.cotizacion_id
        where cot.company_id = p_company_id and ff.estado = 'aprobada'
        and ff.fecha_vencimiento < now()::date and ff.fecha_vencimiento >= now()::date - 30), 0),
      'vencidas_60', coalesce((select sum(coalesce(ff.saldo_pendiente, ff.total)) from facturas ff
        join cotizaciones cot on cot.id = ff.cotizacion_id
        where cot.company_id = p_company_id and ff.estado = 'aprobada'
        and ff.fecha_vencimiento < now()::date - 30 and ff.fecha_vencimiento >= now()::date - 60), 0),
      'vencidas_90', coalesce((select sum(coalesce(ff.saldo_pendiente, ff.total)) from facturas ff
        join cotizaciones cot on cot.id = ff.cotizacion_id
        where cot.company_id = p_company_id and ff.estado = 'aprobada'
        and ff.fecha_vencimiento < now()::date - 60 and ff.fecha_vencimiento >= now()::date - 90), 0),
      'vencidas_mas_90', coalesce((select sum(coalesce(ff.saldo_pendiente, ff.total)) from facturas ff
        join cotizaciones cot on cot.id = ff.cotizacion_id
        where cot.company_id = p_company_id and ff.estado = 'aprobada' and ff.fecha_vencimiento < now()::date - 90), 0)
    ),
    'por_cliente', v_por_cliente
  );
end;
$$;
