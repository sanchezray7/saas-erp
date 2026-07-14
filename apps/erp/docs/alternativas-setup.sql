-- Alternativas: productos por proveedor + otros proveedores que lo ofrecen

create or replace function productos_con_alternativas(p_proveedor_id uuid, p_company_id uuid)
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'producto_id', cp.id,
      'producto_nombre', cp.nombre,
      'producto_codigo', cp.codigo,
      'precio_actual', pp.precio_proveedor,
      'moneda', pp.moneda,
      'unidad_medida', cp.unidad_medida,
      'alternativas', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'proveedor_id', alt.proveedor_id,
            'proveedor_nombre', alt_p.nombre,
            'precio', alt.precio_proveedor,
            'moneda', alt.moneda
          ) order by alt.precio_proveedor
        ), '[]'::jsonb)
        from proveedor_productos alt
        join proveedores alt_p on alt_p.id = alt.proveedor_id
        where alt.producto_id = cp.id
          and alt.proveedor_id != p_proveedor_id
          and alt_p.company_id = p_company_id
          and alt_p.estado = 'activo'
      )
    ) order by cp.nombre
  ), '[]'::jsonb)
  from proveedor_productos pp
  join catalogo_productos cp on cp.id = pp.producto_id
  where pp.proveedor_id = p_proveedor_id
    and cp.company_id = p_company_id;
$$;
