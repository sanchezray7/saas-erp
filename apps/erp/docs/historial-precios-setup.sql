-- Historial de precios de productos en órdenes de compra

create or replace function productos_con_historial(p_company_id uuid)
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'producto_id', cp.id,
      'producto_nombre', cp.nombre,
      'producto_codigo', cp.codigo,
      'precio_venta', cp.precio_venta,
      'precio_compra', cp.precio_compra,
      'moneda', cp.moneda,
      'unidad_medida', cp.unidad_medida,
      'total_ocs', (select count(*) from orden_compra_items oi join ordenes_compra o on o.id = oi.orden_id where o.company_id = p_company_id and oi.producto_id = cp.id and o.estado in ('confirmada', 'recibida')),
      'ultimo_precio', (select oi.precio_unitario from orden_compra_items oi join ordenes_compra o on o.id = oi.orden_id where o.company_id = p_company_id and oi.producto_id = cp.id and o.estado in ('confirmada', 'recibida') order by o.fecha_emision desc limit 1)
    ) order by cp.nombre
  ), '[]'::jsonb)
  from catalogo_productos cp
  where cp.company_id = p_company_id
    and cp.activo = true
    and exists (select 1 from orden_compra_items oi join ordenes_compra o on o.id = oi.orden_id where o.company_id = p_company_id and oi.producto_id = cp.id and o.estado in ('confirmada', 'recibida'));
$$;

create or replace function historial_precios_producto(p_company_id uuid, p_producto_id uuid)
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'fecha', o.fecha_emision,
      'precio', oi.precio_unitario,
      'cantidad', oi.cantidad,
      'subtotal', oi.subtotal,
      'oc_id', o.id,
      'oc_numero', o.numero,
      'proveedor_id', p.id,
      'proveedor_nombre', p.nombre,
      'moneda', o.moneda
    ) order by o.fecha_emision
  ), '[]'::jsonb)
  from orden_compra_items oi
  join ordenes_compra o on o.id = oi.orden_id
  join proveedores p on p.id = o.proveedor_id
  where o.company_id = p_company_id
    and oi.producto_id = p_producto_id
    and o.estado in ('confirmada', 'recibida');
$$;
