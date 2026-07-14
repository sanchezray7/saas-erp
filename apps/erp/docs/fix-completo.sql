-- =============================================================================
-- Fix completo: recursión RLS + helpers security definer + cross-schema
-- Ejecutar UNA SOLA vez en Supabase SQL Editor (pegar todo y ejecutar)
-- =============================================================================

-- 1. HELPER FUNCTIONS (security definer — bypasean RLS)

create or replace function public.is_member_of(target_company uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.company_members
    where user_id = auth.uid() and company_id = target_company
  );
$$;

create or replace function public.is_admin_of(company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.company_members
    where company_id = $1 and user_id = auth.uid() and role = 'admin'
  );
$$;

-- 2. FIX COMPANY_MEMBERS RLS (eliminar recursión)

drop policy if exists "Usuarios ven sus propios miembros" on company_members;
drop policy if exists "cm_select" on company_members;
create policy "cm_select" on company_members for select
  using (user_id = auth.uid());

drop policy if exists "cm_insert" on company_members;
drop policy if exists "Admins insertan miembros" on company_members;
create policy "cm_insert" on company_members for insert
  with check (public.is_admin_of(company_id));

drop policy if exists "cm_update" on company_members;
drop policy if exists "Admins actualizan miembros" on company_members;
create policy "cm_update" on company_members for update
  using (public.is_admin_of(company_id));

drop policy if exists "cm_delete" on company_members;
drop policy if exists "Admins eliminan miembros" on company_members;
create policy "cm_delete" on company_members for delete
  using (public.is_admin_of(company_id));

-- 3. RPC: listar miembros (security definer — bypass cm_select policy)
drop function if exists listar_miembros_empresa(uuid) cascade;
create or replace function listar_miembros_empresa(p_company_id uuid)
returns table (user_id uuid, email text, role text, created_at timestamptz)
language plpgsql
security definer
as $$
begin
  if not public.is_admin_of(p_company_id) then
    raise exception 'No eres admin de esta empresa';
  end if;
  return query
    select cm.user_id, u.email::text, cm.role, cm.created_at
    from company_members cm
    left join auth.users u on u.id = cm.user_id
    where cm.company_id = p_company_id
    order by cm.created_at;
end;
$$;

-- 4. RPC: eliminar miembro (security definer)
drop function if exists eliminar_miembro(uuid, uuid) cascade;
create or replace function eliminar_miembro(p_company_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if not public.is_admin_of(p_company_id) then
    raise exception 'No eres admin de esta empresa';
  end if;
  delete from company_members
    where company_id = p_company_id and user_id = p_user_id;
end;
$$;

-- 5. RPC: listar routing con email
drop function if exists listar_routing(uuid) cascade;
create or replace function listar_routing(p_company_id uuid)
returns table (id uuid, company_id uuid, user_id uuid, email text, orden integer, activo boolean)
language plpgsql
security definer
as $$
begin
  return query
    select lr.id, lr.company_id, lr.user_id, u.email::text, lr.orden, lr.activo
    from lead_routing lr
    left join auth.users u on u.id = lr.user_id
    where lr.company_id = p_company_id
    order by lr.orden;
end;
$$;

-- 6. Vista contactos con email del asignado
create or replace view contactos_view with (security_invoker = true) as
select c.*, u.email as assigned_email
from contacts c
left join auth.users u on u.id = c.assigned_to;

-- 7. RPC obtener contacto con asignado + organización
drop function if exists obtener_contacto_con_asignado(uuid) cascade;
create or replace function obtener_contacto_con_asignado(p_contact_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'id', c.id, 'company_id', c.company_id, 'organization_id', c.organization_id,
    'name', c.name, 'email', c.email, 'phone', c.phone, 'position', c.position,
    'source', c.source, 'notes', c.notes,
    'assigned_to', case when c.assigned_to is not null then jsonb_build_object('id', c.assigned_to, 'email', u.email) else null end,
    'created_at', c.created_at, 'updated_at', c.updated_at, 'last_activity_at', c.last_activity_at,
    'organization', case when org.id is not null then jsonb_build_object('name', org.name) else null end
  ) into v_result
  from contacts c
  left join auth.users u on u.id = c.assigned_to
  left join organizations org on org.id = c.organization_id
  where c.id = p_contact_id;

  return v_result;
end;
$$;
