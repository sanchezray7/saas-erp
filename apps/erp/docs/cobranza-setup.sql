-- Cobranza automatizada por WhatsApp
-- Ejecutar después de facturacion-setup.sql

-- 1. Fecha de vencimiento en facturas
alter table facturas add column if not exists fecha_vencimiento timestamptz;
alter table facturas add column if not exists ultimo_recordatorio timestamptz;
alter table facturas add column if not exists recordatorios_enviados integer not null default 0;

-- 2. Config de cobranza por empresa
create table if not exists cobranza_config (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  activo boolean not null default false,
  dias_antes integer not null default 3,
  dias_despues integer not null default 1,
  intervalo_dias integer not null default 3,
  plantilla_id uuid,
  created_at timestamptz not null default now(),
  unique(company_id)
);

alter table cobranza_config enable row level security;

drop policy if exists "cobranza_config_select" on cobranza_config;
create policy "cobranza_config_select" on cobranza_config for select
  using (public.is_member_of(company_id));

drop policy if exists "cobranza_config_insert" on cobranza_config;
create policy "cobranza_config_insert" on cobranza_config for insert
  with check (public.is_member_of(company_id));

drop policy if exists "cobranza_config_update" on cobranza_config;
create policy "cobranza_config_update" on cobranza_config for update
  using (public.is_member_of(company_id));
