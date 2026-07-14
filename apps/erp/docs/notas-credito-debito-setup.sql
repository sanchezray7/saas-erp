-- Notas de Crédito/Débito (SIFEN tipoDE=5/6)
-- Ejecutar después de facturacion-setup.sql y accounting-setup.sql

-- 1. Tabla principal
create table if not exists notas_credito_debito (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  factura_origen_id uuid not null references facturas(id),
  cotizacion_id uuid references cotizaciones(id) on delete set null,
  tipo text not null check (tipo in ('credito', 'debito')),
  cdc text,
  numero text,
  timbrado text,
  xml_generado text,
  motivo text not null,
  items jsonb not null default '[]',
  subtotal numeric(12,2) not null default 0,
  impuesto numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  moneda text not null default 'PYG',
  estado text not null default 'borrador' check (estado in ('borrador', 'emitida', 'aprobada', 'rechazada', 'cancelada')),
  errores text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table notas_credito_debito enable row level security;
drop policy if exists "notas_select" on notas_credito_debito;
create policy "notas_select" on notas_credito_debito for select using (public.is_member_of(company_id));
drop policy if exists "notas_insert" on notas_credito_debito;
create policy "notas_insert" on notas_credito_debito for insert with check (public.is_member_of(company_id));
drop policy if exists "notas_update" on notas_credito_debito;
create policy "notas_update" on notas_credito_debito for update using (public.is_member_of(company_id));

-- 2. Contadores independientes por tipo
create table if not exists nota_contadores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  tipo text not null check (tipo in ('credito', 'debito')),
  establecimiento text not null default '001',
  punto_expedicion text not null default '001',
  contador integer not null default 0,
  unique(company_id, tipo, establecimiento, punto_expedicion)
);

alter table nota_contadores enable row level security;
drop policy if exists "nota_contadores_select" on nota_contadores;
create policy "nota_contadores_select" on nota_contadores for select using (public.is_member_of(company_id));
drop policy if exists "nota_contadores_insert" on nota_contadores;
create policy "nota_contadores_insert" on nota_contadores for insert with check (public.is_member_of(company_id));

-- 3. RPC: incrementar contador de nota
create or replace function incrementar_contador_nota(p_company_id uuid, p_tipo text, p_establecimiento text default '001', p_punto_exp text default '001')
returns jsonb
language plpgsql
security definer
as $$
declare
  v_count integer;
  v_formato text;
begin
  insert into nota_contadores (company_id, tipo, establecimiento, punto_expedicion, contador)
  values (p_company_id, p_tipo, p_establecimiento, p_punto_exp, 1)
  on conflict (company_id, tipo, establecimiento, punto_expedicion)
  do update set contador = nota_contadores.contador + 1
  returning contador into v_count;

  v_formato := p_establecimiento || '-' || p_punto_exp || '-' || lpad(v_count::text, 7, '0');
  return jsonb_build_object('numero_doc', v_count, 'numero_formateado', v_formato);
end;
$$;

-- 4. Agregar source_type para notas en asientos contables
alter table journal_entries drop constraint if exists journal_entries_source_type_check;
alter table journal_entries add constraint journal_entries_source_type_check
  check (source_type in ('factura_proveedor', 'factura_cliente', 'pago_proveedor', 'pago_cliente', 'ajuste_inventario', 'nota_credito_cliente', 'nota_debito_cliente', 'manual'));

-- 5. RPC: generar asiento contable para NC/ND
create or replace function generar_asiento_nota_credito_debito(p_nota_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_nota record;
  v_factura record;
  v_entry_id uuid;
  v_entry_number text;
  v_account_cliente_id uuid;
  v_account_ingreso_id uuid;
  v_account_iva_debito_id uuid;
begin
  select n.* into v_nota from notas_credito_debito n where n.id = p_nota_id;
  if not found then return jsonb_build_object('error', 'Nota no encontrada'); end if;
  if v_nota.estado != 'aprobada' then return jsonb_build_object('error', 'La nota debe estar aprobada'); end if;

  -- Obtener factura original
  select f.* into v_factura from facturas f where f.id = v_nota.factura_origen_id;
  if not found then return jsonb_build_object('error', 'Factura original no encontrada'); end if;

  -- Buscar cuentas
  select coalesce(c.account_cliente_id, a.id) into v_account_cliente_id
  from facturas ff
  left join cotizaciones ct on ct.id = ff.cotizacion_id
  left join contacts c on c.id = ct.contact_id
  left join accounts a on a.company_id = ff.company_id and a.code = '1.1.3'
  where ff.id = v_nota.factura_origen_id limit 1;
  select id into v_account_ingreso_id from accounts
  where company_id = v_nota.company_id and (code = '4.1' or name ilike '%venta%') limit 1;
  select id into v_account_iva_debito_id from accounts
  where company_id = v_nota.company_id and (code = '2.1.2' or name ilike '%iva%debito%') limit 1;

  v_entry_number := 'AS-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));
  v_entry_number := case when v_nota.tipo = 'credito' then 'NC-' else 'ND-' end || v_entry_number;

  if v_nota.tipo = 'credito' then
    -- NC: reversión — Haber Clientes, Debe Ingresos+IVA
    insert into journal_entries (company_id, entry_number, entry_date, description, source_type, source_id, total_debit, total_credit, estado)
    values (v_nota.company_id, v_entry_number, now()::date,
            'Nota de Crédito: ' || coalesce(v_nota.numero, '') || ' - Factura: ' || coalesce(v_factura.numero, ''),
            'nota_credito_cliente', p_nota_id, v_nota.total, v_nota.total, 'contabilizado')
    returning id into v_entry_id;

    if v_account_ingreso_id is not null then
      insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
      values (v_entry_id, v_account_ingreso_id, 'NC: ' || coalesce(v_nota.motivo, ''), v_nota.subtotal, 0);
    end if;
    if v_account_iva_debito_id is not null and v_nota.impuesto > 0 then
      insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
      values (v_entry_id, v_account_iva_debito_id, 'IVA NC ' || coalesce(v_nota.numero, ''), v_nota.impuesto, 0);
    end if;
    if v_account_cliente_id is not null then
      insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
      values (v_entry_id, v_account_cliente_id, 'NC Cliente: ' || coalesce(v_nota.motivo, ''), 0, v_nota.total);
    end if;

  else
    -- ND: cargo adicional — Debe Clientes, Haber Ingresos+IVA
    insert into journal_entries (company_id, entry_number, entry_date, description, source_type, source_id, total_debit, total_credit, estado)
    values (v_nota.company_id, v_entry_number, now()::date,
            'Nota de Débito: ' || coalesce(v_nota.numero, '') || ' - Factura: ' || coalesce(v_factura.numero, ''),
            'nota_debito_cliente', p_nota_id, v_nota.total, v_nota.total, 'contabilizado')
    returning id into v_entry_id;

    if v_account_cliente_id is not null then
      insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
      values (v_entry_id, v_account_cliente_id, 'ND Cliente: ' || coalesce(v_nota.motivo, ''), v_nota.total, 0);
    end if;
    if v_account_ingreso_id is not null then
      insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
      values (v_entry_id, v_account_ingreso_id, 'ND: ' || coalesce(v_nota.motivo, ''), 0, v_nota.subtotal);
    end if;
    if v_account_iva_debito_id is not null and v_nota.impuesto > 0 then
      insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
      values (v_entry_id, v_account_iva_debito_id, 'IVA ND ' || coalesce(v_nota.numero, ''), 0, v_nota.impuesto);
    end if;
  end if;

  return jsonb_build_object('id', v_entry_id, 'entry_number', v_entry_number);
end;
$$;

-- 6. RPC: actualizar saldo de factura desde NC/ND
create or replace function actualizar_saldo_por_nota(p_nota_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_nota record;
begin
  select * into v_nota from notas_credito_debito where id = p_nota_id;
  if not found then return jsonb_build_object('error', 'Nota no encontrada'); end if;
  if v_nota.estado != 'aprobada' then return jsonb_build_object('error', 'La nota debe estar aprobada'); end if;

  if v_nota.tipo = 'credito' then
    -- NC: reduce saldo
    update facturas set saldo_pendiente = greatest(0, coalesce(saldo_pendiente, total) - v_nota.total)
    where id = v_nota.factura_origen_id;
    -- Si quedó saldo 0 y estaba aprobada, marcarla como cobrada
    update facturas set estado = 'cobrada'
    where id = v_nota.factura_origen_id and estado = 'aprobada' and coalesce(saldo_pendiente, total) <= 0;
  else
    -- ND: aumenta saldo
    update facturas set saldo_pendiente = coalesce(saldo_pendiente, total) + v_nota.total
    where id = v_nota.factura_origen_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;
