-- Reporte de Flujo de Efectivo (método indirecto simplificado)
-- Ejecutar después de accounting-setup.sql

create or replace function reporte_flujo_efectivo(p_company_id uuid, p_desde date, p_hasta date)
returns jsonb
language plpgsql
stable
as $$
declare
  v_resultado_neto numeric;
  v_ingresos numeric;
  v_costos_gastos numeric;
  v_var_ctas_cobrar numeric;
  v_var_ctas_pagar numeric;
  v_var_inventario numeric;
  v_depreciacion numeric;
  v_flujo_operativo numeric;
begin
  -- Resultado neto del período
  select coalesce(sum(jel.credit - jel.debit), 0) into v_ingresos
  from journal_entry_lines jel
  join journal_entries je on je.id = jel.journal_entry_id
  join accounts a on a.id = jel.account_id
  where je.company_id = p_company_id and je.entry_date between p_desde and p_hasta
    and je.estado = 'contabilizado' and a.type = 'ingreso';

  select coalesce(sum(jel.debit - jel.credit), 0) into v_costos_gastos
  from journal_entry_lines jel
  join journal_entries je on je.id = jel.journal_entry_id
  join accounts a on a.id = jel.account_id
  where je.company_id = p_company_id and je.entry_date between p_desde and p_hasta
    and je.estado = 'contabilizado' and a.type in ('costo', 'gasto');

  v_resultado_neto := v_ingresos - v_costos_gastos;

  -- Variación de cuentas por cobrar (1.1.3) = saldo inicio - saldo fin
  -- Si la variación es negativa, aumentaron las cuentas por cobrar (usó efectivo)
  with saldos as (
    select a.id, a.code,
      coalesce(sum(case when je.entry_date < p_desde then jel.debit - jel.credit else 0 end), 0) as saldo_inicial,
      coalesce(sum(case when je.entry_date <= p_hasta then jel.debit - jel.credit else 0 end), 0) as saldo_final
    from accounts a
    join journal_entry_lines jel on jel.account_id = a.id
    join journal_entries je on je.id = jel.journal_entry_id
    where je.company_id = p_company_id and je.estado = 'contabilizado' and a.code = '1.1.3'
    group by a.id, a.code
  )
  select coalesce(saldo_final - saldo_inicial, 0) into v_var_ctas_cobrar from saldos limit 1;

  -- Variación de proveedores (2.1.1)
  with saldos as (
    select a.id, a.code,
      coalesce(sum(case when je.entry_date < p_desde then jel.credit - jel.debit else 0 end), 0) as saldo_inicial,
      coalesce(sum(case when je.entry_date <= p_hasta then jel.credit - jel.debit else 0 end), 0) as saldo_final
    from accounts a
    join journal_entry_lines jel on jel.account_id = a.id
    join journal_entries je on je.id = jel.journal_entry_id
    where je.company_id = p_company_id and je.estado = 'contabilizado' and a.code = '2.1.1'
    group by a.id, a.code
  )
  select coalesce(saldo_final - saldo_inicial, 0) into v_var_ctas_pagar from saldos limit 1;

  -- Variación de inventario (1.1.5)
  with saldos as (
    select a.id, a.code,
      coalesce(sum(case when je.entry_date < p_desde then jel.debit - jel.credit else 0 end), 0) as saldo_inicial,
      coalesce(sum(case when je.entry_date <= p_hasta then jel.debit - jel.credit else 0 end), 0) as saldo_final
    from accounts a
    join journal_entry_lines jel on jel.account_id = a.id
    join journal_entries je on je.id = jel.journal_entry_id
    where je.company_id = p_company_id and je.estado = 'contabilizado' and a.code = '1.1.5'
    group by a.id, a.code
  )
  select coalesce(saldo_final - saldo_inicial, 0) into v_var_inventario from saldos limit 1;

  -- Depreciación aproximada (cuentas 6.x con 'depreciacion' en el nombre)
  select coalesce(sum(jel.debit - jel.credit), 0) into v_depreciacion
  from journal_entry_lines jel
  join journal_entries je on je.id = jel.journal_entry_id
  join accounts a on a.id = jel.account_id
  where je.company_id = p_company_id and je.entry_date between p_desde and p_hasta
    and je.estado = 'contabilizado' and a.type = 'gasto' and a.name ilike '%depreciacion%';

  v_flujo_operativo := v_resultado_neto + v_depreciacion - v_var_ctas_cobrar + v_var_ctas_pagar - v_var_inventario;

  return jsonb_build_object(
    'resultado_neto', v_resultado_neto,
    'depreciacion', v_depreciacion,
    'var_ctas_cobrar', -v_var_ctas_cobrar,
    'var_ctas_pagar', v_var_ctas_pagar,
    'var_inventario', -v_var_inventario,
    'flujo_operativo', v_flujo_operativo,
    'detalle', jsonb_build_array(
      jsonb_build_object('concepto', 'Resultado Neto', 'monto', v_resultado_neto, 'tipo', 'resultado'),
      jsonb_build_object('concepto', 'Depreciación / Amortización', 'monto', v_depreciacion, 'tipo', 'ajuste'),
      jsonb_build_object('concepto', 'Variación Cuentas por Cobrar', 'monto', -v_var_ctas_cobrar, 'tipo', 'capital_trabajo'),
      jsonb_build_object('concepto', 'Variación Cuentas por Pagar', 'monto', v_var_ctas_pagar, 'tipo', 'capital_trabajo'),
      jsonb_build_object('concepto', 'Variación Inventario', 'monto', -v_var_inventario, 'tipo', 'capital_trabajo'),
      jsonb_build_object('concepto', 'Flujo de Efectivo Operativo', 'monto', v_flujo_operativo, 'tipo', 'total')
    )
  );
end;
$$;
