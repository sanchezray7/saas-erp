-- Anular factura de cliente + reversión contable
-- Ejecutar después de accounting-setup.sql

create or replace function anular_factura_cliente(p_factura_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_factura record;
  v_cot record;
  v_asiento record;
begin
  select * into v_factura from facturas where id = p_factura_id;
  if not found then
    return jsonb_build_object('error', 'Factura no encontrada');
  end if;
  if v_factura.estado = 'cancelada' then
    return jsonb_build_object('error', 'La factura ya está cancelada');
  end if;
  if v_factura.estado = 'cobrada' then
    return jsonb_build_object('error', 'No se puede anular una factura cobrada. Emití una Nota de Crédito.');
  end if;

  -- Cambiar estado de la factura
  update facturas set estado = 'cancelada', saldo_pendiente = 0
  where id = p_factura_id;

  -- Anular asiento contable si existe
  for v_asiento in
    select id, entry_number from journal_entries
    where source_type = 'factura_cliente' and source_id = p_factura_id and estado = 'contabilizado'
  loop
    update journal_entries set estado = 'anulado' where id = v_asiento.id;
  end loop;

  -- Retornar cotización a estado aceptada (para poder re-facturar)
  update cotizaciones set estado = 'aceptada'
  where id = v_factura.cotizacion_id and estado = 'facturada';

  return jsonb_build_object('ok', true, 'factura_id', p_factura_id);
end;
$$;
