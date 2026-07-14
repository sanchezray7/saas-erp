-- Round Robin: asignación automática de leads a vendedores
-- Ejecutar en Supabase SQL Editor

-- 1. Columna assigned_to en contacts
alter table contacts add column if not exists assigned_to uuid references auth.users(id);

-- 2. Cursor del round-robin en company_config
alter table company_config add column if not exists last_assigned_user_id uuid references auth.users(id);

-- 3. Tabla de configuración de routing
create table if not exists lead_routing (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  orden integer not null default 0,
  activo boolean not null default true,
  unique(company_id, user_id)
);
alter table lead_routing enable row level security;

drop policy if exists "lr_select" on lead_routing;
create policy "lr_select" on lead_routing for select
  using (public.is_member_of(company_id));

drop policy if exists "lr_insert" on lead_routing;
create policy "lr_insert" on lead_routing for insert
  with check (public.is_admin_of(company_id));

drop policy if exists "lr_update" on lead_routing;
create policy "lr_update" on lead_routing for update
  using (public.is_admin_of(company_id));

drop policy if exists "lr_delete" on lead_routing;
create policy "lr_delete" on lead_routing for delete
  using (public.is_admin_of(company_id));

-- 4. Función de asignación round-robin
create or replace function asignar_siguiente_vendedor(p_company_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_last_id uuid;
begin
  select last_assigned_user_id into v_last_id
  from company_config where company_id = p_company_id;

  select lr.user_id into v_user_id
  from lead_routing lr
  where lr.company_id = p_company_id and lr.activo = true
  order by lr.orden
  offset (
    select coalesce(
      (select lr2.orden from lead_routing lr2
       where lr2.company_id = p_company_id and lr2.user_id = v_last_id),
      -1
    ) + 1
  )
  limit 1;

  if v_user_id is null then
    select lr.user_id into v_user_id
    from lead_routing lr
    where lr.company_id = p_company_id and lr.activo = true
    order by lr.orden
    limit 1;
  end if;

  update company_config set last_assigned_user_id = v_user_id
  where company_id = p_company_id;

  return v_user_id;
end;
$$;

-- 5. RPC: listar miembros de la empresa (solo admins)
create or replace function listar_miembros_empresa(p_company_id uuid)
returns table (user_id uuid, email text, nombre text, telefono text, role text)
language plpgsql
security definer
as $$
begin
  if not public.is_admin_of(p_company_id) then
    raise exception 'No eres admin de esta empresa';
  end if;
  return query
    select cm.user_id, u.email, u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'phone', cm.role
    from company_members cm
    join auth.users u on u.id = cm.user_id
    where cm.company_id = p_company_id
    order by cm.created_at;
end;
$$;

-- 6. Trigger: asignar al crear contacto sin assigned_to
create or replace function trg_assign_lead()
returns trigger as $$
begin
  if NEW.assigned_to is null then
    NEW.assigned_to := asignar_siguiente_vendedor(NEW.company_id);
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_contacts_assign on contacts;
create trigger trg_contacts_assign
  before insert on contacts
  for each row
  execute function trg_assign_lead();

-- 7. RPC para listar routing con email del usuario (bypass schema cross)
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

-- 8. Vista contactos con email del asignado (RLS heredada via security_invoker)
create or replace view contactos_view with (security_invoker = true) as
select c.*, u.email as assigned_email
from contacts c
left join auth.users u on u.id = c.assigned_to;

-- 9. RPC: agregar miembro a la empresa (admin busca por email)
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

-- 10. RPC: eliminar miembro de la empresa
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

-- 11. RPC para obtener un contacto con asignado + organización (JSONB, security definer)
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
