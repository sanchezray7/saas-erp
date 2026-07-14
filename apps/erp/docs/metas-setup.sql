-- Metas de ventas por vendedor
-- Ejecutar después de crm-setup.sql

create table if not exists metas_ventas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  anio integer not null,
  mes integer not null,
  monto_objetivo numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  unique(company_id, user_id, anio, mes)
);

alter table metas_ventas enable row level security;

drop policy if exists "metas_select" on metas_ventas;
create policy "metas_select" on metas_ventas for select
  using (public.is_member_of(company_id));

drop policy if exists "metas_insert" on metas_ventas;
create policy "metas_insert" on metas_ventas for insert
  with check (public.is_member_of(company_id));

drop policy if exists "metas_update" on metas_ventas;
create policy "metas_update" on metas_ventas for update
  using (public.is_member_of(company_id));

drop policy if exists "metas_delete" on metas_ventas;
create policy "metas_delete" on metas_ventas for delete
  using (public.is_member_of(company_id));

create index if not exists idx_metas_company on metas_ventas(company_id, anio, mes);

-- RPC para obtener progreso de metas
create or replace function obtener_progreso_meta(
  p_company_id uuid,
  p_anio integer,
  p_mes integer
)
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
begin
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'user_id', t.user_id,
      'email', t.email,
      'nombre', t.nombre,
      'monto_objetivo', t.monto_objetivo,
      'monto_alcanzado', t.monto_alcanzado,
      'porcentaje', case when t.monto_objetivo > 0 then round((t.monto_alcanzado / t.monto_objetivo) * 100) else 0 end,
      'deals_ganados', t.deals_ganados
    ) order by t.nombre
  ), '[]'::jsonb)
  into result
  from (
    select
      m.user_id,
      u.email::text,
      u.raw_user_meta_data->>'full_name' as nombre,
      m.monto_objetivo,
      coalesce(
        (select sum(d.value)
         from deals d
         join stages s on s.id = d.stage_id
         where d.company_id = p_company_id
           and d.assigned_to = m.user_id
           and s.name = 'Cerrado ganado'
           and extract(year from d.closed_at) = p_anio
           and extract(month from d.closed_at) = p_mes
        ), 0
      ) as monto_alcanzado,
      (
        select count(*)
        from deals d
        join stages s on s.id = d.stage_id
        where d.company_id = p_company_id
          and d.assigned_to = m.user_id
          and s.name = 'Cerrado ganado'
          and extract(year from d.closed_at) = p_anio
          and extract(month from d.closed_at) = p_mes
      ) as deals_ganados
    from metas_ventas m
    join auth.users u on u.id = m.user_id
    where m.company_id = p_company_id
      and m.anio = p_anio
      and m.mes = p_mes
  ) t;

  return result;
end;
$$;
