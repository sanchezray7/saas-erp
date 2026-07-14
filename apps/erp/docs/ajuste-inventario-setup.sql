-- Asiento automático de ajuste de inventario (diferencia de conteo)
-- Ejecutar después de accounting-setup.sql e inventario-setup.sql

-- Referencia al asiento contable en el conteo
alter table conteos add column if not exists asiento_id uuid references journal_entries(id) on delete set null;

alter table journal_entries drop constraint if exists journal_entries_source_type_check;
alter table journal_entries add constraint journal_entries_source_type_check
  check (source_type in ('factura_proveedor', 'factura_cliente', 'pago_proveedor', 'pago_cliente', 'ajuste_inventario', 'manual'));

create or replace function generar_asiento_ajuste_inventario(p_conteo_id uuid, p_fecha date default current_date)
returns jsonb
language plpgsql
as $$
declare
  v_conteo record;
  v_item record;
  v_entry_id uuid;
  v_entry_number text;
  v_total_debit numeric(12,2) := 0;
  v_total_credit numeric(12,2) := 0;
  v_inventario_account_id uuid;
  v_ajuste_account_id uuid;
  v_costo_total numeric(12,2);
  v_valor numeric(12,2);
begin
  -- Obtener conteo
  select c.*, a.nombre as almacen_nombre
  into v_conteo
  from conteos c
  left join almacenes a on a.id = c.almacen_id
  where c.id = p_conteo_id;

  if not found then
    return jsonb_build_object('error', 'Conteo no encontrado');
  end if;

  -- Buscar cuentas contables
  select id into v_inventario_account_id from accounts
  where company_id = v_conteo.company_id and code = '1.1.5' limit 1;

  select id into v_ajuste_account_id from accounts
  where company_id = v_conteo.company_id and code = '6.4' limit 1;

  if v_inventario_account_id is null then
    return jsonb_build_object('error', 'Cuenta de Inventario (1.1.5) no encontrada. Ejecutá la seed de cuentas en Configuración > Plan de Cuentas.');
  end if;

  if v_ajuste_account_id is null then
    return jsonb_build_object('error', 'Cuenta de Ajuste de Inventario (6.4) no encontrada. Ejecutá la seed de cuentas en Configuración > Plan de Cuentas.');
  end if;

  -- Calcular total de ajuste (diferencia × costo_promedio)
  -- Primero verificar si hay diferencias
  select coalesce(sum(abs(ci.diferencia) * coalesce(ps.costo_promedio, 0)), 0)
  into v_costo_total
  from conteo_items ci
  left join producto_stock ps on ps.producto_id = ci.producto_id and ps.almacen_id = v_conteo.almacen_id
  where ci.conteo_id = p_conteo_id and ci.diferencia != 0;

  if v_costo_total = 0 then
    return jsonb_build_object('error', 'No hay diferencias para ajustar');
  end if;

  -- Generar número de asiento
  v_entry_number := 'AS-INV-' || to_char(p_fecha, 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));

  -- Crear asiento (una sola línea de débito y una de crédito con el total)
  insert into journal_entries (company_id, entry_number, entry_date, description, source_type, source_id, total_debit, total_credit, estado)
  values (
    v_conteo.company_id, v_entry_number, p_fecha,
    'Ajuste inventario: ' || v_conteo.numero || ' (' || v_conteo.almacen_nombre || ')',
    'ajuste_inventario', p_conteo_id, v_costo_total, v_costo_total, 'contabilizado'
  )
  returning id into v_entry_id;

  -- Insertar líneas por cada item con diferencia
  for v_item in
    select ci.*, cp.nombre as producto_nombre, coalesce(ps.costo_promedio, 0) as costo_promedio
    from conteo_items ci
    join catalogo_productos cp on cp.id = ci.producto_id
    left join producto_stock ps on ps.producto_id = ci.producto_id and ps.almacen_id = v_conteo.almacen_id
    where ci.conteo_id = p_conteo_id and ci.diferencia != 0
  loop
    v_valor := abs(v_item.diferencia) * v_item.costo_promedio;
    if v_valor = 0 then continue; end if;

    if v_item.diferencia > 0 then
      -- Sobra: Débito a Inventario, Crédito a Ajuste
      insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
      values (v_entry_id, v_inventario_account_id, v_item.producto_nombre || ' (+' || v_item.diferencia || ')', v_valor, 0);
      insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
      values (v_entry_id, v_ajuste_account_id, v_item.producto_nombre || ' (+' || v_item.diferencia || ')', 0, v_valor);
    else
      -- Falta: Débito a Ajuste, Crédito a Inventario
      insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
      values (v_entry_id, v_ajuste_account_id, v_item.producto_nombre || ' (' || v_item.diferencia || ')', v_valor, 0);
      insert into journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
      values (v_entry_id, v_inventario_account_id, v_item.producto_nombre || ' (' || v_item.diferencia || ')', 0, v_valor);
    end if;
  end loop;

  return jsonb_build_object('id', v_entry_id, 'entry_number', v_entry_number);
end;
$$;
