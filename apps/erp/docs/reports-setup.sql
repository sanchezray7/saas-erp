-- =============================================================================
-- Reportes / Analytics — RPCs para el módulo de reportes
-- Ejecutar en Supabase SQL Editor
-- =============================================================================

-- 1. Resumen de ventas por etapa
create or replace function obtener_resumen_ventas(p_company_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'stage_id', s.id,
        'stage_name', s.name,
        'color', s.color,
        'probability', s.probability,
        'count', coalesce(d.count, 0),
        'total_value', coalesce(d.total_value, 0)
      ) order by s.position
    ),
    '[]'::jsonb
  )
  into result
  from stages s
  left join (
    select stage_id, count(*) as count, sum(value) as total_value
    from deals
    where company_id = p_company_id
    group by stage_id
  ) d on d.stage_id = s.id
  where s.pipeline_id in (
    select id from pipelines where company_id = p_company_id
  );

  return result;
end;
$$;

-- 2. Ingresos mensuales (deals cerrados ganados, probability = 100)
create or replace function obtener_ingresos_mensuales(p_company_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'year', d.year,
        'month', d.month,
        'total', d.total
      ) order by d.year, d.month
    ),
    '[]'::jsonb
  )
  into result
  from (
    select
      extract(year from updated_at)::int as year,
      extract(month from updated_at)::int as month,
      sum(value) as total
    from deals
    where company_id = p_company_id
      and probability = 100
      and updated_at >= now() - interval '12 months'
    group by year, month
  ) d;

  return result;
end;
$$;

-- 3. Actividades por tipo en un rango de fechas
create or replace function obtener_actividades_por_tipo(
  p_company_id uuid,
  p_desde timestamptz default now() - interval '30 days',
  p_hasta timestamptz default now()
)
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object('type', a.type, 'count', a.count)
    ),
    '[]'::jsonb
  )
  into result
  from (
    select type, count(*) as count
    from activities
    where company_id = p_company_id
      and created_at >= p_desde
      and created_at <= p_hasta
    group by type
    order by count desc
  ) a;

  return result;
end;
$$;

-- 4. Top vendedores por valor de deals (vinculados via contacts.assigned_to)
create or replace function obtener_top_vendedores(p_company_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', t.user_id,
        'email', t.email,
        'nombre', t.nombre,
        'total_deals', t.total_deals,
        'total_value', t.total_value
      ) order by t.total_value desc
    ),
    '[]'::jsonb
  )
  into result
  from (
    select
      u.id as user_id,
      u.email::text,
      u.raw_user_meta_data->>'full_name' as nombre,
      count(d.id)::int as total_deals,
      coalesce(sum(d.value), 0) as total_value
    from auth.users u
    join contacts c on c.assigned_to = u.id
    join deals d on d.contact_id = c.id
    where d.company_id = p_company_id
    group by u.id, u.email, u.raw_user_meta_data
    order by total_value desc
    limit 10
  ) t;

  return result;
end;
$$;

-- 5. Tasa de conversión entre etapas (deals activos por etapa, ordenados por posición)
create or replace function obtener_conversion_etapas(p_company_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'stage_id', s.id,
        'stage_name', s.name,
        'position', s.position,
        'color', s.color,
        'count', coalesce(d.c, 0)
      ) order by s.position
    ),
    '[]'::jsonb
  )
  into result
  from stages s
  left join (
    select stage_id, count(*) as c
    from deals
    where company_id = p_company_id
    group by stage_id
  ) d on d.stage_id = s.id
  where s.pipeline_id in (
    select id from pipelines where company_id = p_company_id
  );

  return result;
end;
$$;

-- 6. Velocidad de ventas (días promedio para ganar/perder/activos)
create or replace function obtener_velocidad_ventas(p_company_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'ganados', coalesce((
      select round(avg(extract(epoch from (closed_at - created_at)) / 86400))::int
      from deals
      where company_id = p_company_id and stage_id in (
        select id from stages where name = 'Cerrado ganado' and pipeline_id in (
          select id from pipelines where company_id = p_company_id
        )
      ) and closed_at is not null
    ), 0),
    'perdidos', coalesce((
      select round(avg(extract(epoch from (closed_at - created_at)) / 86400))::int
      from deals
      where company_id = p_company_id and stage_id in (
        select id from stages where name = 'Cerrado perdido' and pipeline_id in (
          select id from pipelines where company_id = p_company_id
        )
      ) and closed_at is not null
    ), 0),
    'activos', coalesce((
      select round(avg(extract(epoch from (now() - created_at)) / 86400))::int
      from deals
      where company_id = p_company_id and stage_id not in (
        select id from stages where name in ('Cerrado ganado', 'Cerrado perdido') and pipeline_id in (
          select id from pipelines where company_id = p_company_id
        )
      )
    ), 0)
  ) into result;

  return result;
end;
$$;
