-- Módulo POS (Punto de Venta)
-- Ejecutar después de inventario-setup.sql

-- 1. Cajas registradoras
create table if not exists cajas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  nombre text not null,
  estado text not null default 'cerrada' check (estado in ('abierta', 'cerrada')),
  saldo_inicial numeric(12,2) not null default 0,
  saldo_actual numeric(12,2) not null default 0,
  almacen_id uuid references almacenes(id) on delete set null,
  usuario_apertura_id uuid references auth.users(id),
  apertura_en timestamptz,
  cierre_en timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cajas_company on cajas(company_id);

-- 2. Ventas POS (no electrónicas)
create table if not exists ventas_pos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  caja_id uuid not null references cajas(id),
  cliente_id uuid references contacts(id) on delete set null,
  numero integer not null,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(12,2) not null default 0,
  descuento numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  forma_pago text not null check (forma_pago in ('efectivo', 'tarjeta', 'transferencia', 'mixto')),
  monto_efectivo numeric(12,2) not null default 0,
  monto_tarjeta numeric(12,2) not null default 0,
  monto_transferencia numeric(12,2) not null default 0,
  monto_recibido numeric(12,2) not null default 0,
  monto_cambio numeric(12,2) not null default 0,
  factura_id uuid references facturas(id) on delete set null,
  created_at timestamptz not null default now(),
  usuario_id uuid references auth.users(id)
);

create index if not exists idx_ventas_pos_company on ventas_pos(company_id);
create index if not exists idx_ventas_pos_caja on ventas_pos(caja_id);
create index if not exists idx_ventas_pos_fecha on ventas_pos(created_at desc);

-- 3. Cierres de caja (corte Z)
create table if not exists cierres_caja (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  caja_id uuid not null references cajas(id),
  apertura_en timestamptz not null,
  cierre_en timestamptz not null default now(),
  saldo_inicial numeric(12,2) not null default 0,
  saldo_esperado numeric(12,2) not null default 0,
  saldo_real numeric(12,2) not null default 0,
  ventas_count integer not null default 0,
  ventas_total numeric(12,2) not null default 0,
  dif_esperada numeric(12,2) not null default 0,
  observaciones text,
  created_at timestamptz not null default now()
);

create index if not exists idx_cierres_caja_company on cierres_caja(company_id);

-- RLS
alter table cajas enable row level security;
alter table ventas_pos enable row level security;
alter table cierres_caja enable row level security;

drop policy if exists "cajas_select" on cajas;
create policy "cajas_select" on cajas for select using (public.is_member_of(company_id));
drop policy if exists "cajas_insert" on cajas;
create policy "cajas_insert" on cajas for insert with check (public.is_member_of(company_id));
drop policy if exists "cajas_update" on cajas;
create policy "cajas_update" on cajas for update using (public.is_member_of(company_id));
drop policy if exists "cajas_delete" on cajas;
create policy "cajas_delete" on cajas for delete using (public.is_member_of(company_id));

drop policy if exists "ventas_pos_select" on ventas_pos;
create policy "ventas_pos_select" on ventas_pos for select using (public.is_member_of(company_id));
drop policy if exists "ventas_pos_insert" on ventas_pos;
create policy "ventas_pos_insert" on ventas_pos for insert with check (public.is_member_of(company_id));

drop policy if exists "cierres_caja_select" on cierres_caja;
create policy "cierres_caja_select" on cierres_caja for select using (public.is_member_of(company_id));
drop policy if exists "cierres_caja_insert" on cierres_caja;
create policy "cierres_caja_insert" on cierres_caja for insert with check (public.is_member_of(company_id));

-- 4. RPC: Seed consumidor final
create or replace function seed_consumidor_final(p_company_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_id uuid;
begin
  select id into v_id from contacts
  where company_id = p_company_id and name = 'Consumidor Final' and tipo_documento is null;
  if v_id is null then
    insert into contacts (company_id, name, notes)
    values (p_company_id, 'Consumidor Final', 'Cliente por defecto para ventas POS')
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- 5. RPC: Abrir caja
create or replace function abrir_caja(p_caja_id uuid, p_saldo_inicial numeric)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_caja record;
begin
  select * into v_caja from cajas where id = p_caja_id for update;
  if v_caja.estado = 'abierta' then
    return jsonb_build_object('error', 'La caja ya está abierta');
  end if;
  update cajas set
    estado = 'abierta',
    saldo_inicial = p_saldo_inicial,
    saldo_actual = p_saldo_inicial,
    usuario_apertura_id = auth.uid(),
    apertura_en = now(),
    cierre_en = null
  where id = p_caja_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- 6. RPC: Cerrar caja (corte Z)
create or replace function cerrar_caja(p_caja_id uuid, p_saldo_real numeric, p_observaciones text default '')
returns jsonb
language plpgsql
security definer
as $$
declare
  v_caja record;
  v_ventas record;
  v_cierre_id uuid;
begin
  select * into v_caja from cajas where id = p_caja_id for update;
  if v_caja.estado = 'cerrada' then
    return jsonb_build_object('error', 'La caja ya está cerrada');
  end if;
  select count(*) as count, coalesce(sum(total), 0) as sum into v_ventas
  from ventas_pos
  where caja_id = p_caja_id and created_at >= v_caja.apertura_en;

  insert into cierres_caja (company_id, caja_id, apertura_en, cierre_en,
    saldo_inicial, saldo_esperado, saldo_real, ventas_count, ventas_total, dif_esperada, observaciones)
  values (v_caja.company_id, p_caja_id, v_caja.apertura_en, now(),
    v_caja.saldo_inicial, v_caja.saldo_actual, p_saldo_real, v_ventas.count, v_ventas.sum,
    p_saldo_real - v_caja.saldo_actual, p_observaciones)
  returning id into v_cierre_id;

  update cajas set estado = 'cerrada', saldo_actual = p_saldo_real, cierre_en = now()
  where id = p_caja_id;

  return jsonb_build_object('ok', true, 'cierre_id', v_cierre_id);
end;
$$;

-- 7. RPC: Registrar venta POS
create or replace function registrar_venta_pos(
  p_company_id uuid, p_caja_id uuid, p_cliente_id uuid,
  p_items jsonb, p_subtotal numeric, p_descuento numeric, p_total numeric,
  p_forma_pago text,
  p_monto_efectivo numeric, p_monto_tarjeta numeric, p_monto_transferencia numeric,
  p_monto_recibido numeric, p_monto_cambio numeric,
  p_banco text default null, p_referencia text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_caja record;
  v_numero integer;
  v_venta_id uuid;
  v_item jsonb;
  v_stock record;
begin
  -- Validar caja abierta
  select * into v_caja from cajas where id = p_caja_id for update;
  if v_caja.estado != 'abierta' then
    return jsonb_build_object('error', 'La caja no está abierta');
  end if;

  -- Validar y descontar stock
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select cantidad into v_stock
    from producto_stock
    where producto_id = (v_item->>'producto_id')::uuid
      and almacen_id = (v_item->>'almacen_id')::uuid
      and company_id = p_company_id;

    if v_stock is null or v_stock.cantidad < (v_item->>'cantidad')::numeric then
      return jsonb_build_object('error', 'Stock insuficiente para ' || coalesce(v_item->>'nombre', 'producto'));
    end if;
  end loop;

  -- Número correlativo
  select coalesce(max(numero), 0) + 1 into v_numero
  from ventas_pos where company_id = p_company_id;

  -- Insertar venta
  insert into ventas_pos (company_id, caja_id, cliente_id, numero,
    items, subtotal, descuento, total,
    forma_pago, monto_efectivo, monto_tarjeta, monto_transferencia,
    monto_recibido, monto_cambio, usuario_id, banco, referencia)
  values (p_company_id, p_caja_id, p_cliente_id, v_numero,
    p_items, p_subtotal, p_descuento, p_total,
    p_forma_pago, p_monto_efectivo, p_monto_tarjeta, p_monto_transferencia,
    p_monto_recibido, p_monto_cambio, auth.uid(), p_banco, p_referencia)
  returning id into v_venta_id;

  -- Descontar stock
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    update producto_stock
    set cantidad = cantidad - (v_item->>'cantidad')::numeric
    where producto_id = (v_item->>'producto_id')::uuid
      and almacen_id = (v_item->>'almacen_id')::uuid
      and company_id = p_company_id;
  end loop;

  -- Actualizar saldo de caja
  update cajas set saldo_actual = saldo_actual + p_total
  where id = p_caja_id;

  return jsonb_build_object('ok', true, 'venta_id', v_venta_id, 'numero', v_numero);
end;
$$;

-- 9. Agregar QR como forma de pago + banco + referencia
alter table ventas_pos drop constraint if exists ventas_pos_forma_pago_check;
alter table ventas_pos add constraint ventas_pos_forma_pago_check
  check (forma_pago in ('efectivo', 'tarjeta', 'transferencia', 'mixto', 'qr'));
alter table ventas_pos add column if not exists banco text;
alter table ventas_pos add column if not exists referencia text;

-- 10. Trigger: descontar stock en ventas POS (respaldo)
drop trigger if exists trg_venta_pos_descuenta_stock on ventas_pos;
