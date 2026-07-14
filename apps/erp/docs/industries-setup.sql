-- Industries: tabla para catálogo de industrias por empresa
-- Ejecutar en Supabase SQL Editor

create table if not exists industries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique(company_id, name)
);
alter table industries enable row level security;

drop policy if exists "ind_select" on industries;
create policy "ind_select" on industries for select
  using (public.is_member_of(company_id));

drop policy if exists "ind_insert" on industries;
create policy "ind_insert" on industries for insert
  with check (public.is_member_of(company_id));

drop policy if exists "ind_update" on industries;
create policy "ind_update" on industries for update
  using (public.is_member_of(company_id));

drop policy if exists "ind_delete" on industries;
create policy "ind_delete" on industries for delete
  using (public.is_member_of(company_id));

-- Función RPC para seed (usada desde Edge Function company-signup)
create or replace function seed_default_industries(p_company_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  insert into industries (company_id, name) values
    (p_company_id, 'Tecnología'),
    (p_company_id, 'Salud'),
    (p_company_id, 'Educación'),
    (p_company_id, 'Finanzas'),
    (p_company_id, 'Comercio'),
    (p_company_id, 'Manufactura'),
    (p_company_id, 'Consultoría'),
    (p_company_id, 'Inmobiliario'),
    (p_company_id, 'Logística'),
    (p_company_id, 'Alimentos'),
    (p_company_id, 'Entretenimiento'),
    (p_company_id, 'Energía'),
    (p_company_id, 'Agricultura'),
    (p_company_id, 'Construcción'),
    (p_company_id, 'Telecomunicaciones'),
    (p_company_id, 'Automotriz'),
    (p_company_id, 'Turismo'),
    (p_company_id, 'Legal')
  on conflict (company_id, name) do nothing;
end;
$$;

-- Seed para empresas existentes
do $$
declare
  rec record;
begin
  for rec in select id from companies loop
    perform seed_default_industries(rec.id);
  end loop;
end;
$$;
