-- Calendario de pagos (cuentas por pagar)
-- Ejecutar después de srm-setup.sql

create or replace function obtener_calendario_pagos(p_company_id uuid)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'resumen', jsonb_build_object(
      'vencidas', coalesce((select sum(total) from ordenes_compra where company_id = p_company_id and estado in ('confirmada', 'recibida') and fecha_entrega_estimada < now()::date), 0),
      'dias7', coalesce((select sum(total) from ordenes_compra where company_id = p_company_id and estado in ('confirmada', 'recibida') and fecha_entrega_estimada between now()::date and now()::date + interval '7 days'), 0),
      'dias15', coalesce((select sum(total) from ordenes_compra where company_id = p_company_id and estado in ('confirmada', 'recibida') and fecha_entrega_estimada between now()::date + interval '8 days' and now()::date + interval '15 days'), 0),
      'dias30', coalesce((select sum(total) from ordenes_compra where company_id = p_company_id and estado in ('confirmada', 'recibida') and fecha_entrega_estimada between now()::date + interval '16 days' and now()::date + interval '30 days'), 0)
    ),
    'ordenes', coalesce(jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'numero', o.numero,
        'total', o.total,
        'moneda', o.moneda,
        'fecha_vencimiento', o.fecha_entrega_estimada,
        'dias_restantes', (o.fecha_entrega_estimada - now()::date)::int,
        'estado', o.estado,
        'proveedor', jsonb_build_object('nombre', p.nombre, 'id', p.id)
      ) order by o.fecha_entrega_estimada
    ) filter (where o.estado in ('confirmada', 'recibida')), '[]'::jsonb)
  )
  from ordenes_compra o
  join proveedores p on p.id = o.proveedor_id
  where o.company_id = p_company_id
  limit 1;
$$;
