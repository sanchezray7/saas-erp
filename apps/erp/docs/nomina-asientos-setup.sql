-- Asientos contables automáticos de nómina
-- Ejecutar después de accounting-setup.sql y nomina-setup.sql

-- 1. Columna account_id en nomina_conceptos (cuenta contable por concepto)
alter table nomina_conceptos add column if not exists account_id uuid references accounts(id) on delete set null;

-- 2. Seed de cuentas contables para nómina por empresa
do $$
declare
  v_company record;
begin
  for v_company in select id from companies loop
    insert into accounts (company_id, code, name, type, is_active)
    values (v_company.id, '5.1.1', 'Sueldos y Salarios', 'gasto', true)
    on conflict (company_id, code) do nothing;

    insert into accounts (company_id, code, name, type, is_active)
    values (v_company.id, '5.1.2', 'Aportes Patronales', 'gasto', true)
    on conflict (company_id, code) do nothing;

    insert into accounts (company_id, code, name, type, is_active)
    values (v_company.id, '2.1.5', 'Sueldos a Pagar', 'pasivo', true)
    on conflict (company_id, code) do nothing;

    insert into accounts (company_id, code, name, type, is_active)
    values (v_company.id, '2.1.6', 'IPS Obrero por Pagar', 'pasivo', true)
    on conflict (company_id, code) do nothing;

    insert into accounts (company_id, code, name, type, is_active)
    values (v_company.id, '2.1.7', 'IPS Patronal por Pagar', 'pasivo', true)
    on conflict (company_id, code) do nothing;
  end loop;
end;
$$;

-- 3. Agregar 'nomina' y 'pago_nomina' a source_type
alter table journal_entries drop constraint if exists journal_entries_source_type_check;
alter table journal_entries add constraint journal_entries_source_type_check
  check (source_type in ('factura_proveedor','factura_cliente','pago_proveedor','pago_cliente','ajuste_inventario','nota_credito_cliente','nota_debito_cliente','nomina','pago_nomina','manual'));

-- 4. RPC: generar / previsualizar asiento contable desde nómina aprobada
-- Si p_preview=true, retorna las líneas sin insertar nada
create or replace function generar_asiento_nomina(p_periodo_id uuid, p_preview boolean default false)
returns jsonb language plpgsql security definer as $$
declare
  v_periodo record;
  v_cid uuid;
  v_total_debe numeric(12,2) := 0;
  v_total_haber numeric(12,2) := 0;
  v_balance numeric(12,2) := 0;
  v_cuenta_pagar uuid;
  v_entry_id uuid;
  v_entry_number text;
  v_row record;
  v_lineas jsonb := '[]'::jsonb;
  v_codigo_pagar text;
  v_nombre_pagar text;
  v_balanced boolean;
begin
  select * into v_periodo from nomina_periodos where id = p_periodo_id;
  if not found then return jsonb_build_object('error', 'Período no encontrado'); end if;
  if not p_preview and v_periodo.estado != 'aprobado' then
    return jsonb_build_object('error', 'El período debe estar aprobado');
  end if;
  v_cid := v_periodo.company_id;

  select id, code, name into v_cuenta_pagar, v_codigo_pagar, v_nombre_pagar
  from accounts where company_id = v_cid and code = '2.1.5';
  if v_cuenta_pagar is null then return jsonb_build_object('error', 'Cuenta 2.1.5 (Sueldos a pagar) no encontrada'); end if;

  -- Neto real a pagar
  select coalesce(sum(neto_pagar), 0) into v_balance
  from nomina_detalle where periodo_id = p_periodo_id;

  -- Líneas: solo conceptos CON cuenta contable asignada
  for v_row in
    select a.id as cuenta_id, a.code as codigo, a.name as nombre,
           sum(nl.monto_total) as monto_total
    from nomina_lineas nl
    join nomina_conceptos nc on nc.id = nl.concepto_id
    join nomina_detalle nd on nd.id = nl.nomina_detalle_id
    join accounts a on a.id = nc.account_id
    where nd.periodo_id = p_periodo_id and nc.account_id is not null
    group by a.id, a.code, a.name
    having abs(sum(nl.monto_total)) > 0
    order by a.code
  loop
    if v_row.monto_total > 0 then
      v_total_debe := v_total_debe + v_row.monto_total;
      v_lineas := v_lineas || jsonb_build_object('account_id', v_row.cuenta_id, 'code', v_row.codigo, 'name', v_row.nombre, 'debit', v_row.monto_total, 'credit', 0);
    else
      v_total_haber := v_total_haber + abs(v_row.monto_total);
      v_lineas := v_lineas || jsonb_build_object('account_id', v_row.cuenta_id, 'code', v_row.codigo, 'name', v_row.nombre, 'debit', 0, 'credit', abs(v_row.monto_total));
    end if;
  end loop;

  -- Balanceo: neto real a pagar va a 2.1.5
  v_balanced := (v_total_debe - v_total_haber) = v_balance;
  if v_balance > 0 then
    v_lineas := v_lineas || jsonb_build_object('account_id', v_cuenta_pagar, 'code', v_codigo_pagar, 'name', v_nombre_pagar, 'debit', 0, 'credit', v_balance);
    v_total_haber := v_total_haber + v_balance;
  elsif v_balance < 0 then
    v_lineas := v_lineas || jsonb_build_object('account_id', v_cuenta_pagar, 'code', v_codigo_pagar, 'name', v_nombre_pagar, 'debit', abs(v_balance), 'credit', 0);
    v_total_debe := v_total_debe + abs(v_balance);
  end if;

  -- Si es preview, devolver líneas sin insertar + desglose
  if p_preview then
    declare
      v_conceptos jsonb;
    begin
      select jsonb_agg(jsonb_build_object(
        'code', s.code, 'name', s.name,
        'concepto_codigo', s.codigo, 'concepto_nombre', s.nombre,
        'monto', s.monto
      ) order by s.code, s.codigo) into v_conceptos
      from (
        select a.code, a.name, nc.codigo, nc.nombre, sum(nl.monto_total) as monto
        from nomina_lineas nl
        join nomina_conceptos nc on nc.id = nl.concepto_id
        join nomina_detalle nd on nd.id = nl.nomina_detalle_id
        join accounts a on a.id = nc.account_id
        where nd.periodo_id = p_periodo_id and nc.account_id is not null
        group by a.code, a.name, nc.codigo, nc.nombre
        having abs(sum(nl.monto_total)) > 0
        union all
        select v_codigo_pagar, v_nombre_pagar, 'NETO', 'Neto a pagar a empleados', v_balance
        where v_balance > 0
        union all
        select v_codigo_pagar, v_nombre_pagar, 'NETO', 'Ajuste neto a pagar', -v_balance
        where v_balance < 0
      ) s;

      return jsonb_build_object('preview', true, 'lines', v_lineas, 'conceptos', coalesce(v_conceptos, '[]'::jsonb), 'total_debit', v_total_debe, 'total_credit', v_total_haber, 'balanced', v_balanced);
    end;
  end if;

  -- Contabilizar
  v_entry_number := 'NOM-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));
  insert into journal_entries (company_id, entry_number, entry_date, description, source_type, source_id, total_debit, total_credit, estado)
  values (v_cid, v_entry_number, now()::date,
          'Nómina: ' || coalesce(v_periodo.nombre, v_periodo.fecha_desde::text),
          'nomina', p_periodo_id, v_total_debe, v_total_haber, 'contabilizado')
  returning id into v_entry_id;

  -- Insertar líneas desde v_lineas
  insert into journal_entry_lines (journal_entry_id, account_id, debit, credit)
  select v_entry_id, (l->>'account_id')::uuid, (l->>'debit')::numeric, (l->>'credit')::numeric
  from jsonb_array_elements(v_lineas) l;

  return jsonb_build_object('entry_id', v_entry_id, 'entry_number', v_entry_number);
end;
$$;

-- 5. RPC: asiento de pago de nómina (descargo de la deuda vs banco)
create or replace function generar_asiento_pago_nomina(p_periodo_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_periodo record;
  v_cid uuid;
  v_neto numeric(12,2) := 0;
  v_cuenta_pagar uuid;
  v_cuenta_banco uuid;
  v_entry_id uuid;
  v_entry_number text;
begin
  select * into v_periodo from nomina_periodos where id = p_periodo_id;
  if not found then return jsonb_build_object('error', 'Período no encontrado'); end if;
  if v_periodo.estado != 'pagado' then
    return jsonb_build_object('error', 'El período debe estar pagado');
  end if;
  v_cid := v_periodo.company_id;

  select coalesce(sum(neto_pagar), 0) into v_neto
  from nomina_detalle where periodo_id = p_periodo_id;

  select id into v_cuenta_pagar from accounts where company_id = v_cid and code = '2.1.5';
  select id into v_cuenta_banco from accounts where company_id = v_cid and code = '1.1.2';

  if v_cuenta_pagar is null then return jsonb_build_object('error', 'Cuenta 2.1.5 no encontrada'); end if;
  if v_cuenta_banco is null then return jsonb_build_object('error', 'Cuenta 1.1.2 (Bancos) no encontrada. Creala en el Plan de Cuentas.'); end if;

  v_entry_number := 'PAG-NOM-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));

  insert into journal_entries (company_id, entry_number, entry_date, description, source_type, source_id, total_debit, total_credit, estado)
  values (v_cid, v_entry_number, now()::date,
          'Pago nómina: ' || coalesce(v_periodo.nombre, v_periodo.fecha_desde::text),
          'pago_nomina', p_periodo_id, v_neto, v_neto, 'contabilizado')
  returning id into v_entry_id;

  insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
  values (v_entry_id, v_cuenta_pagar, 'Cancelación nómina', v_neto, 0);

  insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
  values (v_entry_id, v_cuenta_banco, 'Pago a empleados', 0, v_neto);

  return jsonb_build_object('entry_id', v_entry_id, 'entry_number', v_entry_number);
end;
$$;
