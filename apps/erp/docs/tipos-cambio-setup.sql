-- Tipos de cambio para conversión de moneda
-- Ejecutar después de accounting-setup.sql

create table if not exists tipos_cambio (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  moneda_origen text not null,
  moneda_destino text not null default 'PYG',
  tasa numeric(12,6) not null,
  fecha date not null default now()::date,
  unique(company_id, moneda_origen, moneda_destino, fecha)
);

alter table tipos_cambio enable row level security;
drop policy if exists "tipos_cambio_select" on tipos_cambio;
create policy "tipos_cambio_select" on tipos_cambio for select using (public.is_member_of(company_id));
drop policy if exists "tipos_cambio_insert" on tipos_cambio;
create policy "tipos_cambio_insert" on tipos_cambio for insert with check (public.is_member_of(company_id));
drop policy if exists "tipos_cambio_delete" on tipos_cambio;
create policy "tipos_cambio_delete" on tipos_cambio for delete using (public.is_member_of(company_id));

-- RPC: obtener tasa de cambio a una fecha
create or replace function obtener_tasa_cambio(p_company_id uuid, p_origen text, p_destino text, p_fecha date)
returns numeric
language sql
stable
as $$
  select coalesce(
    (select tasa from tipos_cambio
     where company_id = p_company_id and moneda_origen = p_origen and moneda_destino = p_destino
       and fecha <= p_fecha
     order by fecha desc limit 1),
    1
  )
$$;
