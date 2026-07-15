-- Triggers de cuotas por plan
-- Rechazan INSERTS si se supera el límite del plan
-- Cubre todos los puntos de entrada (frontend, API, SQL directo)

-- 1. company_members → cuota: usuarios
create or replace function check_quota_usuarios()
returns trigger
language plpgsql
security definer
as $$
declare
  v_plan text;
  v_max integer;
  v_current integer;
begin
  select plan into v_plan from companies where id = new.company_id;
  if v_plan is null then return new; end if;

  select max_value into v_max from plan_quotas where plan = v_plan and quota_key = 'usuarios';
  if v_max is null or v_max = -1 then return new; end if;

  select count(*) into v_current from company_members where company_id = new.company_id;
  if v_current >= v_max then
    raise exception 'Límite de usuarios alcanzado (%) para tu plan actual. Actualizá tu plan para agregar más.', v_max;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_quota_usuarios on company_members;
create trigger trg_check_quota_usuarios
  before insert on company_members
  for each row execute function check_quota_usuarios();

-- 2. catalogo_productos → cuota: productos
create or replace function check_quota_productos()
returns trigger
language plpgsql
security definer
as $$
declare
  v_plan text;
  v_max integer;
  v_current integer;
begin
  select plan into v_plan from companies where id = new.company_id;
  if v_plan is null then return new; end if;

  select max_value into v_max from plan_quotas where plan = v_plan and quota_key = 'productos';
  if v_max is null or v_max = -1 then return new; end if;

  select count(*) into v_current from catalogo_productos where company_id = new.company_id;
  if v_current >= v_max then
    raise exception 'Límite de productos alcanzado (%) para tu plan actual. Actualizá tu plan para ampliarlo.', v_max;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_quota_productos on catalogo_productos;
create trigger trg_check_quota_productos
  before insert on catalogo_productos
  for each row execute function check_quota_productos();

-- 3. contacts → cuota: contactos
create or replace function check_quota_contactos()
returns trigger
language plpgsql
security definer
as $$
declare
  v_plan text;
  v_max integer;
  v_current integer;
begin
  select plan into v_plan from companies where id = new.company_id;
  if v_plan is null then return new; end if;

  select max_value into v_max from plan_quotas where plan = v_plan and quota_key = 'contactos';
  if v_max is null or v_max = -1 then return new; end if;

  select count(*) into v_current from contacts where company_id = new.company_id;
  if v_current >= v_max then
    raise exception 'Límite de contactos alcanzado (%) para tu plan actual. Actualizá tu plan para ampliarlo.', v_max;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_quota_contactos on contacts;
create trigger trg_check_quota_contactos
  before insert on contacts
  for each row execute function check_quota_contactos();

-- 4. deals → cuota: oportunidades
create or replace function check_quota_oportunidades()
returns trigger
language plpgsql
security definer
as $$
declare
  v_plan text;
  v_max integer;
  v_current integer;
begin
  select plan into v_plan from companies where id = new.company_id;
  if v_plan is null then return new; end if;

  select max_value into v_max from plan_quotas where plan = v_plan and quota_key = 'oportunidades';
  if v_max is null or v_max = -1 then return new; end if;

  select count(*) into v_current from deals where company_id = new.company_id;
  if v_current >= v_max then
    raise exception 'Límite de oportunidades alcanzado (%) para tu plan actual. Actualizá tu plan para ampliarlo.', v_max;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_quota_oportunidades on deals;
create trigger trg_check_quota_oportunidades
  before insert on deals
  for each row execute function check_quota_oportunidades();

-- 5. facturas → cuota: facturas_mes
create or replace function check_quota_facturas_mes()
returns trigger
language plpgsql
security definer
as $$
declare
  v_plan text;
  v_max integer;
  v_current integer;
begin
  select plan into v_plan from companies where id = new.company_id;
  if v_plan is null then return new; end if;

  select max_value into v_max from plan_quotas where plan = v_plan and quota_key = 'facturas_mes';
  if v_max is null or v_max = -1 then return new; end if;

  select count(*) into v_current
  from facturas
  where company_id = new.company_id
    and date_trunc('month', created_at) = date_trunc('month', now());
  if v_current >= v_max then
    raise exception 'Límite de facturas mensuales alcanzado (%) para tu plan actual. Actualizá tu plan para ampliarlo.', v_max;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_quota_facturas_mes on facturas;
create trigger trg_check_quota_facturas_mes
  before insert on facturas
  for each row execute function check_quota_facturas_mes();
