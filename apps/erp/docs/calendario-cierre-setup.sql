-- Calendario de cierre contable por empresa
-- Ejecutar después de accounting-setup.sql

create table if not exists cierres_contables (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  periodo text not null,
  estado text not null default 'abierto' check (estado in ('abierto', 'cerrado', 'reabierto')),
  cerrado_por uuid references auth.users(id) on delete set null,
  cerrado_en timestamptz,
  created_at timestamptz not null default now(),
  unique(company_id, periodo)
);

alter table cierres_contables enable row level security;
drop policy if exists "cierres_select" on cierres_contables;
create policy "cierres_select" on cierres_contables for select using (public.is_member_of(company_id));
drop policy if exists "cierres_insert" on cierres_contables;
create policy "cierres_insert" on cierres_contables for insert with check (public.is_member_of(company_id));
drop policy if exists "cierres_update" on cierres_contables;
create policy "cierres_update" on cierres_contables for update using (public.is_member_of(company_id));
