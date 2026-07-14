-- Sugerencias de compra: stock bajo + proveedores
-- Ejecutar después de srm-setup.sql e inventario-setup.sql

create or replace function productos_stock_bajo_con_proveedores(p_company_id uuid)
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'producto_id', cp.id,
      'producto_nombre', cp.nombre,
      'producto_codigo', cp.codigo,
      'unidad_medida', cp.unidad_medida,
      'stock_total', coalesce((
        select sum(ps.cantidad) from producto_stock ps
        where ps.producto_id = cp.id and ps.company_id = p_company_id
      ), 0),
      'stock_minimo', coalesce(cp.stock_minimo, 0),
      'proveedores', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'proveedor_id', pp.proveedor_id,
            'proveedor_nombre', pv.nombre,
            'precio', pp.precio_proveedor,
            'moneda', pp.moneda
          ) order by pp.precio_proveedor
        ), '[]'::jsonb)
        from proveedor_productos pp
        join proveedores pv on pv.id = pp.proveedor_id
        where pp.producto_id = cp.id
          and pv.company_id = p_company_id
          and pv.estado = 'activo'
      )
    ) order by cp.nombre
  ), '[]'::jsonb)
  from catalogo_productos cp
  where cp.company_id = p_company_id
    and cp.activo = true
    and cp.stock_minimo > 0
    and (
      select coalesce(sum(ps.cantidad), 0)
      from producto_stock ps
      where ps.producto_id = cp.id and ps.company_id = p_company_id
    ) <= cp.stock_minimo
$$;
