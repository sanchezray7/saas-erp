-- Reportes contables consolidados (multi-sucursal)
-- Ejecutar después de accounting-setup.sql y consolidacion-setup.sql

-- 1. Balance General Consolidado
create or replace function reporte_balance_consolidado(p_company_id uuid, p_fecha_corte date)
returns jsonb
language sql
stable
as $$
  with grupo as (
    select unnest(empresas_del_grupo(p_company_id)) as cid
  )
  select jsonb_build_object(
    'total_activo', coalesce((select sum(jel.debit - jel.credit) from journal_entry_lines jel join journal_entries je on je.id = jel.journal_entry_id join accounts a on a.id = jel.account_id join grupo on grupo.cid = je.company_id where je.entry_date <= p_fecha_corte and je.estado = 'contabilizado' and a.type = 'activo'), 0),
    'total_pasivo', coalesce((select sum(jel.credit - jel.debit) from journal_entry_lines jel join journal_entries je on je.id = jel.journal_entry_id join accounts a on a.id = jel.account_id join grupo on grupo.cid = je.company_id where je.entry_date <= p_fecha_corte and je.estado = 'contabilizado' and a.type = 'pasivo'), 0),
    'total_patrimonio', coalesce((select sum(jel.credit - jel.debit) from journal_entry_lines jel join journal_entries je on je.id = jel.journal_entry_id join accounts a on a.id = jel.account_id join grupo on grupo.cid = je.company_id where je.entry_date <= p_fecha_corte and je.estado = 'contabilizado' and a.type in ('patrimonio', 'ingreso', 'costo', 'gasto')), 0),
    'cuentas', coalesce(jsonb_agg(
      jsonb_build_object('id', a.id, 'code', a.code, 'name', a.name, 'type', a.type, 'parent_id', a.parent_id, 'saldo', round(coalesce(s.saldo, 0), 2))
      order by a.code
    ), '[]'::jsonb)
  )
  from accounts a
  join grupo on grupo.cid = a.company_id
  left join (
    select jel.account_id, sum(jel.debit - jel.credit) as saldo
    from journal_entry_lines jel
    join journal_entries je on je.id = jel.journal_entry_id
    join grupo on grupo.cid = je.company_id
    where je.entry_date <= p_fecha_corte and je.estado = 'contabilizado'
    group by jel.account_id
  ) s on s.account_id = a.id
  where a.is_active = true;
$$;

-- 2. Resultados Consolidado
create or replace function reporte_resultados_consolidado(p_company_id uuid, p_desde date, p_hasta date)
returns jsonb
language sql
stable
as $$
  with grupo as (
    select unnest(empresas_del_grupo(p_company_id)) as cid
  )
  select jsonb_build_object(
    'total_ingresos', coalesce((select sum(jel.credit - jel.debit) from journal_entry_lines jel join journal_entries je on je.id = jel.journal_entry_id join accounts a on a.id = jel.account_id join grupo on grupo.cid = je.company_id where je.entry_date between p_desde and p_hasta and je.estado = 'contabilizado' and a.type = 'ingreso'), 0),
    'total_costos', coalesce((select sum(jel.debit - jel.credit) from journal_entry_lines jel join journal_entries je on je.id = jel.journal_entry_id join accounts a on a.id = jel.account_id join grupo on grupo.cid = je.company_id where je.entry_date between p_desde and p_hasta and je.estado = 'contabilizado' and a.type = 'costo'), 0),
    'total_gastos', coalesce((select sum(jel.debit - jel.credit) from journal_entry_lines jel join journal_entries je on je.id = jel.journal_entry_id join accounts a on a.id = jel.account_id join grupo on grupo.cid = je.company_id where je.entry_date between p_desde and p_hasta and je.estado = 'contabilizado' and a.type = 'gasto'), 0),
    'cuentas', coalesce(jsonb_agg(
      jsonb_build_object('id', a.id, 'code', a.code, 'name', a.name, 'type', a.type, 'parent_id', a.parent_id, 'saldo', round(coalesce(s.saldo, 0), 2))
      order by a.code
    ), '[]'::jsonb)
  )
  from accounts a
  join grupo on grupo.cid = a.company_id
  left join (
    select jel.account_id,
      case when acc.type in ('ingreso') then sum(jel.credit - jel.debit)
           when acc.type in ('costo', 'gasto') then sum(jel.debit - jel.credit)
           else 0 end as saldo
    from journal_entry_lines jel
    join journal_entries je on je.id = jel.journal_entry_id
    join accounts acc on acc.id = jel.account_id
    join grupo on grupo.cid = je.company_id
    where je.entry_date between p_desde and p_hasta and je.estado = 'contabilizado'
      and acc.type in ('ingreso', 'costo', 'gasto')
    group by jel.account_id, acc.type
  ) s on s.account_id = a.id
  where a.is_active = true and a.type in ('ingreso', 'costo', 'gasto');
$$;

-- 3. IVA Consolidado
create or replace function reporte_iva_consolidado(p_company_id uuid, p_desde date, p_hasta date)
returns jsonb
language sql
stable
as $$
  with grupo as (
    select unnest(empresas_del_grupo(p_company_id)) as cid
  )
  select jsonb_build_object(
    'iva_debito', coalesce((select sum(itl.tax_amount) from invoice_tax_lines itl join taxes t on t.id = itl.tax_id join tax_groups tg on tg.id = t.tax_group_id join grupo on grupo.cid = itl.company_id where itl.created_at::date between p_desde and p_hasta and tg.type = 'debito_fiscal'), 0),
    'iva_credito', coalesce((select sum(itl.tax_amount) from invoice_tax_lines itl join taxes t on t.id = itl.tax_id join tax_groups tg on tg.id = t.tax_group_id join grupo on grupo.cid = itl.company_id where itl.created_at::date between p_desde and p_hasta and tg.type = 'credito_fiscal'), 0),
    'iva_a_pagar', coalesce(
      (select sum(itl.tax_amount) from invoice_tax_lines itl join taxes t on t.id = itl.tax_id join tax_groups tg on tg.id = t.tax_group_id join grupo on grupo.cid = itl.company_id where itl.created_at::date between p_desde and p_hasta and tg.type = 'debito_fiscal'), 0
    ) - coalesce(
      (select sum(itl.tax_amount) from invoice_tax_lines itl join taxes t on t.id = itl.tax_id join tax_groups tg on tg.id = t.tax_group_id join grupo on grupo.cid = itl.company_id where itl.created_at::date between p_desde and p_hasta and tg.type = 'credito_fiscal'), 0
    ),
    'detalle', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', d.tipo, 'tasa', d.tasa, 'monto', d.monto) order by d.tipo, d.tasa)
      from (
        select tg.type as tipo, t.name as tasa, sum(itl.tax_amount) as monto
        from invoice_tax_lines itl
        join taxes t on t.id = itl.tax_id
        join tax_groups tg on tg.id = t.tax_group_id
        join grupo on grupo.cid = itl.company_id
        where itl.created_at::date between p_desde and p_hasta
        group by tg.type, t.name
      ) d
    ), '[]'::jsonb)
  );
$$;

-- 4. Mayor Contable Consolidado
create or replace function reporte_mayor_consolidado(p_company_id uuid, p_account_id uuid, p_desde date, p_hasta date, p_source_type text default null)
returns jsonb
language plpgsql
stable
as $$
declare
  v_saldo_inicial numeric(12,2);
  v_movimientos jsonb;
begin
  with grupo as (
    select unnest(empresas_del_grupo(p_company_id)) as cid
  )
  select coalesce(sum(jel.debit - jel.credit), 0) into v_saldo_inicial
  from journal_entry_lines jel
  join journal_entries je on je.id = jel.journal_entry_id
  join grupo on grupo.cid = je.company_id
  where jel.account_id = p_account_id
    and je.entry_date < p_desde
    and je.estado = 'contabilizado';

  with grupo as (
    select unnest(empresas_del_grupo(p_company_id)) as cid
  )
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
  join grupo on grupo.cid = je.company_id
  where jel.account_id = p_account_id
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
