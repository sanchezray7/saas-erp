-- Fix: cross-schema FK auth.users → PostgREST schema cache
-- Ejecutar en SQL Editor de Supabase

-- Vista contactos con email del asignado
create or replace view contactos_view with (security_invoker = true) as
select c.*, u.email as assigned_email
from contacts c
left join auth.users u on u.id = c.assigned_to;

-- RPC listar routing con email del usuario
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

-- RPC obtener contacto con asignado + organización
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

-- RPC agregar miembro por email (admin)
create or replace function agregar_miembro_por_email(
  p_company_id uuid,
  p_email text,
  p_role text default 'vendedor'
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_existing record;
begin
  if not public.is_admin_of(p_company_id) then
    raise exception 'No eres admin de esta empresa';
  end if;

  select id into v_user_id from auth.users where email = p_email;
  if v_user_id is null then
    raise exception 'No existe un usuario con el correo %', p_email;
  end if;

  select * into v_existing from company_members
    where company_id = p_company_id and user_id = v_user_id;
  if found then
    raise exception 'El usuario ya es miembro de esta empresa';
  end if;

  insert into company_members (company_id, user_id, role)
    values (p_company_id, v_user_id, p_role);

  return jsonb_build_object('user_id', v_user_id, 'email', p_email, 'role', p_role);
end;
$$;

-- RPC eliminar miembro de la empresa
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
