-- ============================================================
-- Webhook leads: tabla webhook_tokens + RLS + RPCs
-- Ejecutar después de crm-setup.sql
-- ============================================================

-- 0. Agregar columnas faltantes a contacts (necesarias para triggers de notificaciones)
alter table contacts add column if not exists assigned_to uuid references auth.users(id) on delete set null;
alter table contacts add column if not exists created_by uuid references auth.users(id) on delete set null;

create index if not exists idx_contacts_assigned_to on contacts(assigned_to);

-- 1. TABLA webhook_tokens
create table if not exists public.webhook_tokens (
  company_id uuid primary key references public.companies(id) on delete cascade,
  token      uuid not null default gen_random_uuid() unique,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.webhook_tokens enable row level security;

-- RLS: miembros pueden leer, admin puede actualizar
drop policy if exists "wt_select" on public.webhook_tokens;
create policy "wt_select" on public.webhook_tokens for select
  using (public.is_member_of(company_id));

drop policy if exists "wt_update" on public.webhook_tokens;
create policy "wt_update" on public.webhook_tokens for update
  using (public.is_admin_of(company_id));

-- 2. RPC: obtener token webhook de la empresa activa
create or replace function public.obtener_token_webhook(p_company_id uuid)
returns jsonb
language plpgsql
security definer
stable
as $$
declare
  v_token uuid;
  v_active boolean;
begin
  select wt.token, wt.is_active into v_token, v_active
  from public.webhook_tokens wt
  where wt.company_id = p_company_id;

  if not found then
    -- auto-crear si no existe
    insert into public.webhook_tokens (company_id)
    values (p_company_id)
    returning token, is_active into v_token, v_active;
  end if;

  return jsonb_build_object(
    'token', v_token,
    'is_active', v_active
  );
end;
$$;

-- 3. RPC: regenerar token
create or replace function public.regenerar_token_webhook(p_company_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_new uuid := gen_random_uuid();
begin
  insert into public.webhook_tokens (company_id, token)
  values (p_company_id, v_new)
  on conflict (company_id)
  do update set token = v_new, updated_at = now();
  return v_new;
end;
$$;

-- 4. RPC: activar/desactivar webhook
create or replace function public.toggle_webhook_activo(p_company_id uuid, p_active boolean)
returns void
language plpgsql
security definer
as $$
begin
  update public.webhook_tokens
  set is_active = p_active, updated_at = now()
  where company_id = p_company_id;
end;
$$;

-- 5. Auto-crear token al crear empresa (modificar función)
-- Reemplazar crear_empresa_crm para que también inserte webhook_tokens
create or replace function public.crear_empresa_crm(
  empresa_nombre text,
  p_user_id uuid default auth.uid(),
  p_rif text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_company_id uuid;
  v_pipeline_id uuid;
  v_user_id uuid;
begin
  v_user_id := coalesce(p_user_id, auth.uid());

  if v_user_id is null then
    raise exception 'No se puede identificar al usuario. Registrate primero.';
  end if;

  insert into companies (name, rif) values (empresa_nombre, p_rif)
    returning id into v_company_id;

  insert into company_members (company_id, user_id, role)
    values (v_company_id, v_user_id, 'admin');

  insert into company_config (company_id, app_name)
    values (v_company_id, empresa_nombre);

  insert into pipelines (company_id, name, description)
    values (v_company_id, 'Pipeline por defecto', 'Pipeline principal de ventas')
    returning id into v_pipeline_id;

  insert into stages (pipeline_id, name, position, probability, color) values
    (v_pipeline_id, 'Nuevo',           0, 10,  '#6366f1'),
    (v_pipeline_id, 'Contactado',      1, 25,  '#3b82f6'),
    (v_pipeline_id, 'Propuesta',       2, 50,  '#f59e0b'),
    (v_pipeline_id, 'Negociación',     3, 75,  '#f97316'),
    (v_pipeline_id, 'Cerrado ganado',  4, 100, '#22c55e'),
    (v_pipeline_id, 'Cerrado perdido', 5, 0,   '#ef4444');

  -- Auto-crear webhook token
  insert into webhook_tokens (company_id, token)
  values (v_company_id, gen_random_uuid());

  return v_company_id;
end;
$$;
