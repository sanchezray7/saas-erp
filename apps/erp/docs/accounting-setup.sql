-- Motor de impuestos LATAM (@saas/accounting)
-- Ejecutar después de crm-setup.sql y srm-setup.sql

-- Grupos de impuestos (IVA, Retención, etc.)
create table if not exists tax_groups (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  type text not null check (type in ('debito_fiscal', 'credito_fiscal', 'retencion_compra', 'retencion_venta')),
  created_at timestamptz not null default now()
);

create index if not exists idx_tax_groups_company on tax_groups(company_id);

-- Impuestos específicos (IVA 10%, Ret. Renta 1%, etc.)
create table if not exists taxes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  tax_group_id uuid not null references tax_groups(id) on delete cascade,
  name text not null,
  percentage numeric(5,2) not null,
  is_withholding boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_taxes_company on taxes(company_id);

-- Líneas de impuestos aplicadas a facturas (polimórfico)
create table if not exists invoice_tax_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  invoice_type text not null check (invoice_type in ('proveedor', 'cliente')),
  invoice_id uuid not null,
  tax_id uuid not null references taxes(id),
  base_amount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_invoice_tax_lines_invoice on invoice_tax_lines(invoice_type, invoice_id);

-- Columna para vincular impuestos a items específicos de la factura
alter table invoice_tax_lines add column if not exists item_id uuid;
create index if not exists idx_invoice_tax_lines_item on invoice_tax_lines(item_id);

-- RLS
alter table tax_groups enable row level security;
alter table taxes enable row level security;
alter table invoice_tax_lines enable row level security;

drop policy if exists "tax_groups_select" on tax_groups;
create policy "tax_groups_select" on tax_groups for select using (public.is_member_of(company_id));
drop policy if exists "tax_groups_insert" on tax_groups;
create policy "tax_groups_insert" on tax_groups for insert with check (public.is_member_of(company_id));
drop policy if exists "tax_groups_update" on tax_groups;
create policy "tax_groups_update" on tax_groups for update using (public.is_member_of(company_id));
drop policy if exists "tax_groups_delete" on tax_groups;
create policy "tax_groups_delete" on tax_groups for delete using (public.is_member_of(company_id));

drop policy if exists "taxes_select" on taxes;
create policy "taxes_select" on taxes for select using (public.is_member_of(company_id));
drop policy if exists "taxes_insert" on taxes;
create policy "taxes_insert" on taxes for insert with check (public.is_member_of(company_id));
drop policy if exists "taxes_update" on taxes;
create policy "taxes_update" on taxes for update using (public.is_member_of(company_id));
drop policy if exists "taxes_delete" on taxes;
create policy "taxes_delete" on taxes for delete using (public.is_member_of(company_id));

drop policy if exists "invoice_tax_lines_select" on invoice_tax_lines;
create policy "invoice_tax_lines_select" on invoice_tax_lines for select using (public.is_member_of(company_id));
drop policy if exists "invoice_tax_lines_insert" on invoice_tax_lines;
create policy "invoice_tax_lines_insert" on invoice_tax_lines for insert with check (public.is_member_of(company_id));
drop policy if exists "invoice_tax_lines_delete" on invoice_tax_lines;
create policy "invoice_tax_lines_delete" on invoice_tax_lines for delete using (public.is_member_of(company_id));

-- ============================================================
-- Plan de Cuentas (@saas/accounting — Fase 2)
-- ============================================================

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  parent_id uuid references accounts(id) on delete set null,
  code text not null,
  name text not null,
  type text not null check (type in ('activo', 'pasivo', 'patrimonio', 'ingreso', 'costo', 'gasto')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, code)
);

create index if not exists idx_accounts_company on accounts(company_id);
create index if not exists idx_accounts_parent on accounts(parent_id);

alter table accounts enable row level security;
drop policy if exists "accounts_select" on accounts;
create policy "accounts_select" on accounts for select using (public.is_member_of(company_id));
drop policy if exists "accounts_insert" on accounts;
create policy "accounts_insert" on accounts for insert with check (public.is_member_of(company_id));
drop policy if exists "accounts_update" on accounts;
create policy "accounts_update" on accounts for update using (public.is_member_of(company_id));
drop policy if exists "accounts_delete" on accounts;
create policy "accounts_delete" on accounts for delete using (public.is_member_of(company_id));

-- Vincular impuestos a cuentas contables
alter table taxes add column if not exists account_id uuid references accounts(id) on delete set null;

-- Cuentas contables para productos (compra/venta)
alter table catalogo_productos add column if not exists account_compra_id uuid references accounts(id) on delete set null;
alter table catalogo_productos add column if not exists account_venta_id uuid references accounts(id) on delete set null;

-- ============================================================
-- Asientos Contables (@saas/accounting — Fase 3)
-- ============================================================

create table if not exists journal_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  entry_number text not null,
  entry_date date not null default now(),
  description text,
  source_type text not null check (source_type in ('factura_proveedor', 'factura_cliente', 'pago_proveedor', 'pago_cliente', 'manual')),
  source_id uuid,
  total_debit numeric(12,2) not null default 0,
  total_credit numeric(12,2) not null default 0,
  estado text not null default 'borrador' check (estado in ('borrador', 'contabilizado', 'anulado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_journal_entries_company on journal_entries(company_id);

create table if not exists journal_entry_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references journal_entries(id) on delete cascade,
  account_id uuid not null references accounts(id),
  description text,
  debit numeric(12,2) not null default 0,
  credit numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_journal_entry_lines_entry on journal_entry_lines(journal_entry_id);

-- RLS
alter table journal_entries enable row level security;
alter table journal_entry_lines enable row level security;

drop policy if exists "journal_entries_select" on journal_entries;
create policy "journal_entries_select" on journal_entries for select using (public.is_member_of(company_id));
drop policy if exists "journal_entries_insert" on journal_entries;
create policy "journal_entries_insert" on journal_entries for insert with check (public.is_member_of(company_id));
drop policy if exists "journal_entries_update" on journal_entries;
create policy "journal_entries_update" on journal_entries for update using (public.is_member_of(company_id));
drop policy if exists "journal_entries_delete" on journal_entries;
create policy "journal_entries_delete" on journal_entries for delete using (public.is_member_of(company_id));

drop policy if exists "journal_entry_lines_select" on journal_entry_lines;
create policy "journal_entry_lines_select" on journal_entry_lines for select using (exists (select 1 from journal_entries je where je.id = journal_entry_id and public.is_member_of(je.company_id)));
drop policy if exists "journal_entry_lines_insert" on journal_entry_lines;
create policy "journal_entry_lines_insert" on journal_entry_lines for insert with check (exists (select 1 from journal_entries je where je.id = journal_entry_id and public.is_member_of(je.company_id)));
drop policy if exists "journal_entry_lines_delete" on journal_entry_lines;
create policy "journal_entry_lines_delete" on journal_entry_lines for delete using (exists (select 1 from journal_entries je where je.id = journal_entry_id and public.is_member_of(je.company_id)));

-- RPC: generar asiento contable desde factura de proveedor
create or replace function generar_asiento_factura_proveedor(p_factura_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_factura record;
  v_entry_id uuid;
  v_entry_number text;
  v_account_gasto_id uuid;
  v_account_proveedor_id uuid;
  v_base numeric(12,2);
  v_iva numeric(12,2);
  v_total numeric(12,2);
  v_line record;
begin
  -- Obtener datos de la factura
  select pf.*, p.nombre as proveedor_nombre
  into v_factura
  from proveedor_facturas pf
  join proveedores p on p.id = pf.proveedor_id
  where pf.id = p_factura_id;

  if not found then
    return jsonb_build_object('error', 'Factura no encontrada');
  end if;

  if v_factura.estado not in ('conciliada', 'pagada') then
    return jsonb_build_object('error', 'La factura debe estar conciliada o pagada');
  end if;

  -- Buscar cuentas por defecto
  -- Buscar cuenta de proveedor (específica del proveedor o genérica 2.1.1)
  select coalesce(p.account_proveedor_id, a.id) into v_account_proveedor_id
  from proveedores p
  left join accounts a on a.company_id = p.company_id and a.code = '2.1.1'
  where p.id = v_factura.proveedor_id
  limit 1;

  -- Generar número de asiento
  v_entry_number := 'AS-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));

  -- Calcular montos
  v_base := coalesce(v_factura.subtotal, 0);
  v_iva := coalesce(v_factura.impuesto, 0);
  v_total := coalesce(v_factura.total, 0);

  -- Crear asiento
  insert into journal_entries (company_id, entry_number, entry_date, description, source_type, source_id, total_debit, total_credit, estado)
  values (v_factura.company_id, v_entry_number, now()::date,
          'Factura proveedor: ' || v_factura.numero_factura || ' - ' || v_factura.proveedor_nombre,
          'factura_proveedor', p_factura_id, v_total, v_total, 'contabilizado')
  returning id into v_entry_id;

  -- Línea 1: Débito a Gasto (base imponible)
  select coalesce(cp.account_compra_id, v_account_gasto_id) into v_account_gasto_id
  from proveedor_factura_items pfi
  left join catalogo_productos cp on cp.id = pfi.producto_id
  where pfi.factura_id = p_factura_id
  limit 1;

  if v_account_gasto_id is null then
    select id into v_account_gasto_id from accounts
    where company_id = v_factura.company_id and code like '6.%' order by code limit 1;
  end if;

  if v_base > 0 and v_account_gasto_id is not null then
    insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
    values (v_entry_id, v_account_gasto_id, 'Base imponible factura ' || v_factura.numero_factura, v_total - v_iva, 0);
  end if;

  -- Línea 2: Débito a IVA Crédito Fiscal
  if v_iva > 0 then
    declare
      v_iva_account_id uuid;
    begin
      -- Buscar cuenta desde invoice_tax_lines o fallback
      select distinct t.account_id into v_iva_account_id
      from invoice_tax_lines itl
      join taxes t on t.id = itl.tax_id
      where itl.invoice_type = 'proveedor' and itl.invoice_id = p_factura_id and not t.is_withholding and t.account_id is not null
      limit 1;

      if v_iva_account_id is null then
        select id into v_iva_account_id from accounts
        where company_id = v_factura.company_id and (code = '1.1.4' or name ilike '%iva%credito%')
        limit 1;
      end if;

      if v_iva_account_id is not null then
        insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
        values (v_entry_id, v_iva_account_id, 'IVA factura ' || v_factura.numero_factura, v_iva, 0);
      end if;
    end;
  end if;

  -- Línea 3: Crédito a Proveedores (total)
  if v_account_proveedor_id is not null then
    insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
    values (v_entry_id, v_account_proveedor_id, 'Proveedor: ' || v_factura.proveedor_nombre, 0, v_total);
  end if;

  return jsonb_build_object('id', v_entry_id, 'entry_number', v_entry_number);
end;
$$;

-- RPC: generar asiento contable desde factura de cliente
create or replace function generar_asiento_factura_cliente(p_factura_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_factura record;
  v_entry_id uuid;
  v_entry_number text;
  v_account_cliente_id uuid;
  v_account_ingreso_id uuid;
  v_account_iva_debito_id uuid;
  v_base numeric(12,2);
  v_iva numeric(12,2);
  v_total numeric(12,2);
  v_contact_name text;
  v_line record;
  v_items_total numeric(12,2);
begin
  select f.*, c.name as contacto_nombre, co.name as empresa_nombre
  into v_factura
  from facturas f
  left join cotizaciones ct on ct.id = f.cotizacion_id
  left join contacts c on c.id = ct.contact_id
  join companies co on co.id = f.company_id
  where f.id = p_factura_id;

  if not found then
    return jsonb_build_object('error', 'Factura no encontrada');
  end if;

  -- Buscar cuentas
  select coalesce(c.account_cliente_id, a.id) into v_account_cliente_id
  from facturas f
  left join cotizaciones ct on ct.id = f.cotizacion_id
  left join contacts c on c.id = ct.contact_id
  left join accounts a on a.company_id = f.company_id and a.code = '1.1.3'
  where f.id = p_factura_id
  limit 1;
  select id into v_account_ingreso_id from accounts
  where company_id = v_factura.company_id and (code = '4.1' or name ilike '%venta%') limit 1;
  select id into v_account_iva_debito_id from accounts
  where company_id = v_factura.company_id and (code = '2.1.2' or name ilike '%iva%debito%') limit 1;

  v_entry_number := 'AS-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));
  v_total := coalesce(v_factura.total, 0);
  v_iva := coalesce(v_factura.impuesto, 0);
  v_base := v_total - v_iva;

  -- Crear asiento
  insert into journal_entries (company_id, entry_number, entry_date, description, source_type, source_id, total_debit, total_credit, estado)
  values (v_factura.company_id, v_entry_number, now()::date,
          'Factura cliente: ' || coalesce(v_factura.numero, '') || ' - ' || coalesce(v_contact_name, ''),
          'factura_cliente', p_factura_id, v_total, v_total, 'contabilizado')
  returning id into v_entry_id;

  -- Línea 1: Débito a Clientes (total)
  if v_account_cliente_id is not null then
    insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
    values (v_entry_id, v_account_cliente_id, 'Cliente: ' || coalesce(v_contact_name, ''), v_total, 0);
  end if;

  -- Calcular suma de subtotales de items para distribución proporcional
  select coalesce(sum(ci.cantidad * ci.precio_unitario), 0) into v_items_total
  from cotizacion_items ci
  where ci.cotizacion_id = v_factura.cotizacion_id;

  -- Línea 2: Crédito a Ingresos (una línea por item, base proporcional sin IVA)
  for v_line in
    select ci.descripcion,
           (ci.cantidad * ci.precio_unitario) as subtotal,
           coalesce(ci.account_venta_id, v_account_ingreso_id) as account_id
    from cotizacion_items ci
    where ci.cotizacion_id = v_factura.cotizacion_id
  loop
    if v_line.account_id is not null and v_line.subtotal > 0 and v_items_total > 0 then
      insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
      values (v_entry_id, v_line.account_id, v_line.descripcion, 0, v_line.subtotal * v_base / v_items_total);
    end if;
  end loop;

  -- Línea 3: Crédito a IVA Débito Fiscal
  if v_account_iva_debito_id is not null and v_iva > 0 then
    insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
    values (v_entry_id, v_account_iva_debito_id, 'IVA factura ' || coalesce(v_factura.numero, ''), 0, v_iva);
  end if;

  return jsonb_build_object('id', v_entry_id, 'entry_number', v_entry_number);
end;
$$;

-- RPC: generar número de asiento manual
create or replace function generar_numero_asiento(p_company_id uuid)
returns text
language sql
stable
as $$
  select 'AS-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(
    ((select count(*) from journal_entries where company_id = p_company_id and created_at::date = now()::date) + 1)::text,
  5, '0');
$$;

-- Cuentas contables por defecto para proveedores y clientes
alter table proveedores add column if not exists account_proveedor_id uuid references accounts(id) on delete set null;
alter table contacts add column if not exists account_cliente_id uuid references accounts(id) on delete set null;

-- RPC: generar asiento contable de pago a proveedor
create or replace function generar_asiento_pago_proveedor(p_factura_id uuid, p_cuenta_banco_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_factura record;
  v_entry_id uuid;
  v_entry_number text;
  v_account_proveedor_id uuid;
  v_total numeric(12,2);
begin
  select pf.*, p.nombre as proveedor_nombre
  into v_factura
  from proveedor_facturas pf
  join proveedores p on p.id = pf.proveedor_id
  where pf.id = p_factura_id;

  if not found then return jsonb_build_object('error', 'Factura no encontrada'); end if;
  if v_factura.estado != 'pagada' then return jsonb_build_object('error', 'La factura debe estar pagada'); end if;

  select coalesce(p.account_proveedor_id, a.id) into v_account_proveedor_id
  from proveedores p
  left join accounts a on a.company_id = p.company_id and a.code = '2.1.1'
  where p.id = v_factura.proveedor_id
  limit 1;

  v_entry_number := 'AS-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));
  v_total := coalesce(v_factura.total, 0);

  insert into journal_entries (company_id, entry_number, entry_date, description, source_type, source_id, total_debit, total_credit, estado)
  values (v_factura.company_id, v_entry_number, now()::date,
          'Pago factura: ' || v_factura.numero_factura || ' - ' || v_factura.proveedor_nombre,
          'pago_proveedor', p_factura_id, v_total, v_total, 'contabilizado')
  returning id into v_entry_id;

  if v_account_proveedor_id is not null then
    insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
    values (v_entry_id, v_account_proveedor_id, 'Cancelación ' || v_factura.numero_factura, v_total, 0);
  end if;

  if p_cuenta_banco_id is not null then
    insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
    values (v_entry_id, p_cuenta_banco_id, 'Pago ' || v_factura.numero_factura, 0, v_total);
  end if;

  return jsonb_build_object('id', v_entry_id, 'entry_number', v_entry_number);
end;
$$;

-- RPC: Reporte de Balance General
create or replace function reporte_balance(p_company_id uuid, p_fecha_corte date)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'total_activo', coalesce((select sum(jel.debit - jel.credit) from journal_entry_lines jel join journal_entries je on je.id = jel.journal_entry_id join accounts a on a.id = jel.account_id where je.company_id = p_company_id and je.entry_date <= p_fecha_corte and je.estado = 'contabilizado' and a.type = 'activo'), 0),
    'total_pasivo', coalesce((select sum(jel.credit - jel.debit) from journal_entry_lines jel join journal_entries je on je.id = jel.journal_entry_id join accounts a on a.id = jel.account_id where je.company_id = p_company_id and je.entry_date <= p_fecha_corte and je.estado = 'contabilizado' and a.type = 'pasivo'), 0),
    'total_patrimonio', coalesce((select sum(jel.credit - jel.debit) from journal_entry_lines jel join journal_entries je on je.id = jel.journal_entry_id join accounts a on a.id = jel.account_id where je.company_id = p_company_id and je.entry_date <= p_fecha_corte and je.estado = 'contabilizado' and a.type in ('patrimonio', 'ingreso', 'costo', 'gasto')), 0),
    'cuentas', coalesce(jsonb_agg(
      jsonb_build_object('id', a.id, 'code', a.code, 'name', a.name, 'type', a.type, 'parent_id', a.parent_id, 'saldo', round(coalesce(s.saldo, 0), 2))
      order by a.code
    ), '[]'::jsonb)
  )
  from accounts a
  left join (
    select jel.account_id, sum(jel.debit - jel.credit) as saldo
    from journal_entry_lines jel
    join journal_entries je on je.id = jel.journal_entry_id
    where je.company_id = p_company_id and je.entry_date <= p_fecha_corte and je.estado = 'contabilizado'
    group by jel.account_id
  ) s on s.account_id = a.id
  where a.company_id = p_company_id and a.is_active = true;
$$;

-- RPC: Reporte de Resultados
create or replace function reporte_resultados(p_company_id uuid, p_desde date, p_hasta date)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'total_ingresos', coalesce((select sum(jel.credit - jel.debit) from journal_entry_lines jel join journal_entries je on je.id = jel.journal_entry_id join accounts a on a.id = jel.account_id where je.company_id = p_company_id and je.entry_date between p_desde and p_hasta and je.estado = 'contabilizado' and a.type = 'ingreso'), 0),
    'total_costos', coalesce((select sum(jel.debit - jel.credit) from journal_entry_lines jel join journal_entries je on je.id = jel.journal_entry_id join accounts a on a.id = jel.account_id where je.company_id = p_company_id and je.entry_date between p_desde and p_hasta and je.estado = 'contabilizado' and a.type = 'costo'), 0),
    'total_gastos', coalesce((select sum(jel.debit - jel.credit) from journal_entry_lines jel join journal_entries je on je.id = jel.journal_entry_id join accounts a on a.id = jel.account_id where je.company_id = p_company_id and je.entry_date between p_desde and p_hasta and je.estado = 'contabilizado' and a.type = 'gasto'), 0),
    'cuentas', coalesce(jsonb_agg(
      jsonb_build_object('id', a.id, 'code', a.code, 'name', a.name, 'type', a.type, 'parent_id', a.parent_id, 'saldo', round(coalesce(s.saldo, 0), 2))
      order by a.code
    ), '[]'::jsonb)
  )
  from accounts a
  left join (
    select jel.account_id,
      case when acc.type in ('ingreso') then sum(jel.credit - jel.debit)
           when acc.type in ('costo', 'gasto') then sum(jel.debit - jel.credit)
           else 0 end as saldo
    from journal_entry_lines jel
    join journal_entries je on je.id = jel.journal_entry_id
    join accounts acc on acc.id = jel.account_id
    where je.company_id = p_company_id and je.entry_date between p_desde and p_hasta and je.estado = 'contabilizado'
      and acc.type in ('ingreso', 'costo', 'gasto')
    group by jel.account_id, acc.type
  ) s on s.account_id = a.id
  where a.company_id = p_company_id and a.is_active = true and a.type in ('ingreso', 'costo', 'gasto');
$$;

-- RPC: Reporte de IVA
create or replace function reporte_iva(p_company_id uuid, p_desde date, p_hasta date)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'iva_debito', coalesce((select sum(itl.tax_amount) from invoice_tax_lines itl join taxes t on t.id = itl.tax_id join tax_groups tg on tg.id = t.tax_group_id where itl.company_id = p_company_id and itl.created_at::date between p_desde and p_hasta and tg.type = 'debito_fiscal'), 0),
    'iva_credito', coalesce((select sum(itl.tax_amount) from invoice_tax_lines itl join taxes t on t.id = itl.tax_id join tax_groups tg on tg.id = t.tax_group_id where itl.company_id = p_company_id and itl.created_at::date between p_desde and p_hasta and tg.type = 'credito_fiscal'), 0),
    'iva_a_pagar', coalesce((select sum(itl.tax_amount) from invoice_tax_lines itl join taxes t on t.id = itl.tax_id join tax_groups tg on tg.id = t.tax_group_id where itl.company_id = p_company_id and itl.created_at::date between p_desde and p_hasta and tg.type = 'debito_fiscal'), 0)
    - coalesce((select sum(itl.tax_amount) from invoice_tax_lines itl join taxes t on t.id = itl.tax_id join tax_groups tg on tg.id = t.tax_group_id where itl.company_id = p_company_id and itl.created_at::date between p_desde and p_hasta and tg.type = 'credito_fiscal'), 0),
    'detalle', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', d.tipo, 'tasa', d.tasa, 'monto', d.monto) order by d.tipo, d.tasa)
      from (
        select tg.type as tipo, t.name as tasa, sum(itl.tax_amount) as monto
        from invoice_tax_lines itl
        join taxes t on t.id = itl.tax_id
        join tax_groups tg on tg.id = t.tax_group_id
        where itl.company_id = p_company_id and itl.created_at::date between p_desde and p_hasta
        group by tg.type, t.name
      ) d
    ), '[]'::jsonb)
  );
$$;

-- Agregar estado 'cobrada' a facturas de cliente
alter table facturas drop constraint if exists facturas_estado_check;
alter table facturas add constraint facturas_estado_check check (estado in ('emitida', 'aprobada', 'rechazada', 'cancelada', 'cobrada'));

-- Agregar estado 'cobrada' a cotizaciones
alter table cotizaciones drop constraint if exists cotizaciones_estado_check;
alter table cotizaciones add constraint cotizaciones_estado_check check (estado in ('borrador', 'enviada', 'aceptada', 'rechazada', 'facturada', 'cobrada'));

-- Policy update para facturas
drop policy if exists "facturas_update" on facturas;
create policy "facturas_update" on facturas for update
  using (public.is_member_of(company_id));

-- RPC: generar asiento contable de cobro a cliente
create or replace function generar_asiento_pago_cliente(p_factura_id uuid, p_cuenta_banco_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_factura record;
  v_entry_id uuid;
  v_entry_number text;
  v_account_cliente_id uuid;
  v_total numeric(12,2);
  v_contact_name text;
begin
  select f.*, c.name as contacto_nombre
  into v_factura
  from facturas f
  left join cotizaciones ct on ct.id = f.cotizacion_id
  left join contacts c on c.id = ct.contact_id
  where f.id = p_factura_id;

  if not found then return jsonb_build_object('error', 'Factura no encontrada'); end if;
  if v_factura.estado != 'cobrada' then return jsonb_build_object('error', 'La factura debe estar cobrada'); end if;

  -- Cuenta del cliente (específica o genérica)
  select coalesce(c.account_cliente_id, a.id) into v_account_cliente_id
  from contacts c
  join cotizaciones ct on ct.contact_id = c.id
  left join accounts a on a.company_id = v_factura.company_id and a.code = '1.1.3'
  where ct.id = v_factura.cotizacion_id
  limit 1;

  v_entry_number := 'AS-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));
  v_total := coalesce(v_factura.total, 0);

  insert into journal_entries (company_id, entry_number, entry_date, description, source_type, source_id, total_debit, total_credit, estado)
  values (v_factura.company_id, v_entry_number, now()::date,
          'Cobro factura: ' || coalesce(v_factura.numero, '') || ' - ' || coalesce(v_contact_name, ''),
          'pago_cliente', p_factura_id, v_total, v_total, 'contabilizado')
  returning id into v_entry_id;

  -- Débito: Banco/Caja (entra el dinero)
  if p_cuenta_banco_id is not null then
    insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
    values (v_entry_id, p_cuenta_banco_id, 'Cobro ' || coalesce(v_factura.numero, ''), v_total, 0);
  end if;

  -- Crédito: Clientes (se cancela la deuda)
  if v_account_cliente_id is not null then
    insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
    values (v_entry_id, v_account_cliente_id, 'Cancelación ' || coalesce(v_factura.numero, ''), 0, v_total);
  end if;

  return jsonb_build_object('id', v_entry_id, 'entry_number', v_entry_number);
end;
$$;

-- RPC: Mayor Contable (movimientos de una cuenta en un período)
create or replace function reporte_mayor_contable(p_company_id uuid, p_account_id uuid, p_desde date, p_hasta date, p_source_type text default null)
returns jsonb
language plpgsql
stable
as $$
declare
  v_saldo_inicial numeric(12,2);
  v_movimientos jsonb;
begin
  select coalesce(sum(debit - credit), 0) into v_saldo_inicial
  from journal_entry_lines jel
  join journal_entries je on je.id = jel.journal_entry_id
  where je.company_id = p_company_id
    and jel.account_id = p_account_id
    and je.entry_date < p_desde
    and je.estado = 'contabilizado';

  select jsonb_agg(
    jsonb_build_object(
      'fecha', je.entry_date,
      'entry_number', je.entry_number,
      'entry_id', je.id,
      'descripcion', je.description,
      'debit', jel.debit,
      'credit', jel.credit,
      'source_type', je.source_type
    ) order by je.entry_date, je.id
  ) into v_movimientos
  from journal_entry_lines jel
  join journal_entries je on je.id = jel.journal_entry_id
  where je.company_id = p_company_id
    and jel.account_id = p_account_id
    and je.entry_date between p_desde and p_hasta
    and je.estado = 'contabilizado'
    and (p_source_type is null or je.source_type = p_source_type);

  return jsonb_build_object(
    'saldo_inicial', v_saldo_inicial,
    'account_id', p_account_id,
    'movimientos', coalesce(v_movimientos, '[]'::jsonb)
  );
end;
$$;
