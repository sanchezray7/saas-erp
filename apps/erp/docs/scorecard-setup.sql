-- Scorecard de proveedores (evaluación automática + manual)
-- Ejecutar después de srm-setup.sql

create table if not exists proveedor_scorecard (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  proveedor_id uuid not null references proveedores(id) on delete cascade,
  unique(company_id, proveedor_id),
  entrega_tiempo numeric(3,2) not null default 0,
  precision_cantidad numeric(3,2) not null default 0,
  precision_precio numeric(3,2) not null default 0,
  calidad numeric(3,2) not null default 0,
  comunicacion numeric(3,2) not null default 0,
  notas text,
  puntaje_general numeric(3,2) not null default 0,
  fecha_ultimo_calculo timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_proveedor_scorecard_company on proveedor_scorecard(company_id);

-- RLS
alter table proveedor_scorecard enable row level security;
drop policy if exists "proveedor_scorecard_select" on proveedor_scorecard;
create policy "proveedor_scorecard_select" on proveedor_scorecard for select using (public.is_member_of(company_id));
drop policy if exists "proveedor_scorecard_insert" on proveedor_scorecard;
create policy "proveedor_scorecard_insert" on proveedor_scorecard for insert with check (public.is_member_of(company_id));
drop policy if exists "proveedor_scorecard_update" on proveedor_scorecard;
create policy "proveedor_scorecard_update" on proveedor_scorecard for update using (public.is_member_of(company_id));
drop policy if exists "proveedor_scorecard_delete" on proveedor_scorecard;
create policy "proveedor_scorecard_delete" on proveedor_scorecard for delete using (public.is_member_of(company_id));

-- RPC: calcular scorecards para todos los proveedores activos de una empresa
create or replace function calcular_scorecards(p_company_id uuid)
returns void
language plpgsql
as $$
declare
  v_prov record;
  v_entrega numeric(3,2);
  v_cantidad numeric(3,2);
  v_precio numeric(3,2);
  v_total_oc int;
  v_oc_a_tiempo int;
  v_total_items int;
  v_items_completos int;
  v_total_factura_items int;
  v_items_precio_ok int;
  v_general numeric(3,2);
begin
  for v_prov in select id from proveedores where company_id = p_company_id and estado = 'activo'
  loop
    -- Entrega a tiempo: % de OCs recibidas antes o en la fecha estimada
    select count(*), count(*) filter (
      where r.fecha_recepcion::date <= o.fecha_entrega_estimada
    ) into v_total_oc, v_oc_a_tiempo
    from ordenes_compra o
    join recepciones r on r.orden_id = o.id
    where o.proveedor_id = v_prov.id and o.estado = 'recibida' and o.fecha_entrega_estimada is not null;

    if v_total_oc > 0 then
      v_entrega := least(5.0, (v_oc_a_tiempo::numeric / v_total_oc) * 5.0);
    else
      v_entrega := 0;
    end if;

    -- Precisión cantidad: items donde cantidad_recibida >= cantidad pedida
    select count(*), count(*) filter (
      where oi.cantidad_recibida >= oi.cantidad
    ) into v_total_items, v_items_completos
    from orden_compra_items oi
    join ordenes_compra o on o.id = oi.orden_id
    where o.proveedor_id = v_prov.id and o.estado = 'recibida';

    if v_total_items > 0 then
      v_cantidad := least(5.0, (v_items_completos::numeric / v_total_items) * 5.0);
    else
      v_cantidad := 0;
    end if;

    -- Precisión precio: items de factura vs items de OC (precio coincide)
    select count(*), count(*) filter (
      where pfi.precio_unitario = oi.precio_unitario
    ) into v_total_factura_items, v_items_precio_ok
    from proveedor_factura_items pfi
    join proveedor_facturas pf on pf.id = pfi.factura_id
    join orden_compra_items oi on oi.id = pfi.orden_item_id
    join ordenes_compra o on o.id = oi.orden_id
    where pf.proveedor_id = v_prov.id and pf.estado in ('conciliada', 'discrepancia', 'pagada');

    if v_total_factura_items > 0 then
      v_precio := least(5.0, (v_items_precio_ok::numeric / v_total_factura_items) * 5.0);
    else
      v_precio := 0;
    end if;

    -- Puntaje general: weighted average
    v_general := round(
      coalesce(v_entrega, 0) * 0.30 +
      coalesce(v_cantidad, 0) * 0.20 +
      coalesce(v_precio, 0) * 0.20,
      2
    );

    -- Upsert
    insert into proveedor_scorecard (company_id, proveedor_id, entrega_tiempo, precision_cantidad, precision_precio, puntaje_general, fecha_ultimo_calculo)
    values (p_company_id, v_prov.id, v_entrega, v_cantidad, v_precio, v_general, now())
    on conflict (company_id, proveedor_id)
    do update set
      entrega_tiempo = excluded.entrega_tiempo,
      precision_cantidad = excluded.precision_cantidad,
      precision_precio = excluded.precision_precio,
      puntaje_general = round(
        excluded.entrega_tiempo * 0.30 +
        excluded.precision_cantidad * 0.20 +
        excluded.precision_precio * 0.20 +
        coalesce(proveedor_scorecard.calidad, 0) * 0.15 +
        coalesce(proveedor_scorecard.comunicacion, 0) * 0.15,
        2
      ),
      fecha_ultimo_calculo = now();
  end loop;
end;
$$;

-- RPC: obtener scorecards con datos del proveedor
create or replace function obtener_scorecards(p_company_id uuid)
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'proveedor_id', s.proveedor_id,
      'proveedor_nombre', p.nombre,
      'proveedor_categoria', p.categoria,
      'proveedor_estado', p.estado,
      'entrega_tiempo', s.entrega_tiempo,
      'precision_cantidad', s.precision_cantidad,
      'precision_precio', s.precision_precio,
      'calidad', s.calidad,
      'comunicacion', s.comunicacion,
      'notas', s.notas,
      'puntaje_general', s.puntaje_general,
      'fecha_ultimo_calculo', s.fecha_ultimo_calculo,
      'total_evaluaciones', (select count(*) from evaluacion_proveedores e where e.proveedor_id = s.proveedor_id)
    ) order by s.puntaje_general desc nulls last
  ), '[]'::jsonb)
  from proveedor_scorecard s
  join proveedores p on p.id = s.proveedor_id
  where s.company_id = p_company_id;
$$;

-- RPC: guardar campos manuales del scorecard
create or replace function guardar_scorecard_manual(p_id uuid, p_calidad numeric, p_comunicacion numeric, p_notas text)
returns void
language plpgsql
as $$
begin
  update proveedor_scorecard set
    calidad = p_calidad,
    comunicacion = p_comunicacion,
    notas = p_notas,
    puntaje_general = round(
      entrega_tiempo * 0.30 +
      precision_cantidad * 0.20 +
      precision_precio * 0.20 +
      p_calidad * 0.15 +
      p_comunicacion * 0.15,
      2
    ),
    updated_at = now()
  where id = p_id;
end;
$$;
