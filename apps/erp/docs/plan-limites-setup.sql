-- Plan de límites por suscripción
-- Ejecutar después de crm-setup.sql

-- 1. Features por plan (módulos habilitados/deshabilitados)
create table if not exists plan_features (
  plan text not null,
  feature_key text not null,
  enabled boolean not null default false,
  primary key (plan, feature_key)
);

-- 2. Cuotas numéricas por plan
create table if not exists plan_quotas (
  plan text not null,
  quota_key text not null,
  max_value integer not null default 0,
  primary key (plan, quota_key)
);

-- RLS
alter table plan_features enable row level security;
alter table plan_quotas enable row level security;

drop policy if exists "plan_features_select" on plan_features;
create policy "plan_features_select" on plan_features for select using (true);
drop policy if exists "plan_quotas_select" on plan_quotas;
create policy "plan_quotas_select" on plan_quotas for select using (true);

-- 3. Seed data — Features por plan
insert into plan_features (plan, feature_key, enabled) values
  -- Free
  ('free', 'catalogo', true),
  ('free', 'crm', true),
  ('free', 'facturacion', true),
  ('free', 'notas_cd', false),
  ('free', 'srm', false),
  ('free', 'inventario', false),
  ('free', 'contabilidad', false),
  ('free', 'contabilidad_avanzada', false),
  ('free', 'asientos_automaticos_facturas', false),
  ('free', 'asientos_automaticos_nomina', false),
  ('free', 'rrhh', false),
  ('free', 'nomina', false),
  ('free', 'whatsapp', false),
  ('free', 'reportes', false),
  ('free', 'reportes_avanzados', false),
  -- Starter
  ('starter', 'catalogo', true),
  ('starter', 'crm', true),
  ('starter', 'facturacion', true),
  ('starter', 'notas_cd', true),
  ('starter', 'srm', true),
  ('starter', 'inventario', true),
  ('starter', 'contabilidad', true),
  ('starter', 'contabilidad_avanzada', false),
  ('starter', 'asientos_automaticos_facturas', true),
  ('starter', 'asientos_automaticos_nomina', false),
  ('starter', 'rrhh', false),
  ('starter', 'nomina', false),
  ('starter', 'whatsapp', false),
  ('starter', 'reportes', true),
  ('starter', 'reportes_avanzados', false),
  -- Business
  ('business', 'catalogo', true),
  ('business', 'crm', true),
  ('business', 'facturacion', true),
  ('business', 'notas_cd', true),
  ('business', 'srm', true),
  ('business', 'inventario', true),
  ('business', 'contabilidad', false),
  ('business', 'contabilidad_avanzada', true),
  ('business', 'asientos_automaticos_facturas', true),
  ('business', 'asientos_automaticos_nomina', true),
  ('business', 'rrhh', true),
  ('business', 'nomina', true),
  ('business', 'whatsapp', true),
  ('business', 'reportes', false),
  ('business', 'reportes_avanzados', true)
on conflict (plan, feature_key) do nothing;

-- 4. Seed data — Cuotas por plan
insert into plan_quotas (plan, quota_key, max_value) values
  ('free', 'usuarios', 2),
  ('free', 'productos', 50),
  ('free', 'contactos', 100),
  ('free', 'oportunidades', 50),
  ('free', 'facturas_mes', 50),
  ('starter', 'usuarios', 10),
  ('starter', 'productos', -1),
  ('starter', 'contactos', -1),
  ('starter', 'oportunidades', -1),
  ('starter', 'facturas_mes', -1),
  ('business', 'usuarios', -1),
  ('business', 'productos', -1),
  ('business', 'contactos', -1),
  ('business', 'oportunidades', -1),
  ('business', 'facturas_mes', -1)
on conflict (plan, quota_key) do nothing;

-- 5. Función helper: verificar si una feature está habilitada para una empresa
create or replace function check_feature_enabled(p_company_id uuid, p_feature_key text)
returns boolean
language plpgsql
security definer
stable
as $$
declare
  v_plan text;
  v_enabled boolean;
begin
  select plan into v_plan from companies where id = p_company_id;
  if v_plan is null then return false; end if;
  select enabled into v_enabled from plan_features where plan = v_plan and feature_key = p_feature_key;
  return coalesce(v_enabled, false);
end;
$$;

-- 6. Función helper: verificar cuota disponible para una empresa
create or replace function check_quota(p_company_id uuid, p_quota_key text)
returns jsonb
language plpgsql
security definer
stable
as $$
declare
  v_plan text;
  v_max integer;
  v_current integer := 0;
begin
  select plan into v_plan from companies where id = p_company_id;
  if v_plan is null then
    return jsonb_build_object('current', 0, 'max', 0, 'remaining', 0);
  end if;

  select max_value into v_max from plan_quotas where plan = v_plan and quota_key = p_quota_key;
  if v_max is null then
    return jsonb_build_object('current', 0, 'max', 0, 'remaining', 0);
  end if;

  -- -1 significa ilimitado
  if v_max = -1 then
    return jsonb_build_object('current', 0, 'max', -1, 'remaining', -1);
  end if;

  -- Contar registros actuales según la cuota
  if p_quota_key = 'usuarios' then
    select count(*) into v_current from company_members where company_id = p_company_id;
  elsif p_quota_key = 'productos' then
    select count(*) into v_current from catalogo_productos where company_id = p_company_id;
  elsif p_quota_key = 'contactos' then
    select count(*) into v_current from contacts where company_id = p_company_id;
  elsif p_quota_key = 'oportunidades' then
    select count(*) into v_current from deals where company_id = p_company_id;
  elsif p_quota_key = 'facturas_mes' then
    select count(*) into v_current
    from facturas
    where company_id = p_company_id
      and date_trunc('month', created_at) = date_trunc('month', now());
  end if;

  return jsonb_build_object('current', v_current, 'max', v_max, 'remaining', greatest(v_max - v_current, 0));
end;
$$;

-- 7. Dar permisos
grant usage on schema public to supabase_auth_admin;
grant execute on function check_feature_enabled(uuid, text) to supabase_auth_admin;
grant execute on function check_quota(uuid, text) to supabase_auth_admin;
grant select on plan_features to supabase_auth_admin;
grant select on plan_quotas to supabase_auth_admin;
