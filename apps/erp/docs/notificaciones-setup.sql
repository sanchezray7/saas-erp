-- Notificaciones in-app — tabla + RLS + RPCs + triggers
-- Ejecutar después de crm-setup.sql

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'info',
  title text not null,
  message text,
  link text,
  read boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table notifications enable row level security;

-- RLS: cada usuario solo ve sus propias notificaciones
drop policy if exists "notificaciones_select" on notifications;
create policy "notificaciones_select" on notifications
  for select using (user_id = auth.uid());

drop policy if exists "notificaciones_insert" on notifications;
create policy "notificaciones_insert" on notifications
  for insert with check (public.is_member_of(company_id));

drop policy if exists "notificaciones_update" on notifications;
create policy "notificaciones_update" on notifications
  for update using (user_id = auth.uid());

drop policy if exists "notificaciones_delete" on notifications;
create policy "notificaciones_delete" on notifications
  for delete using (user_id = auth.uid());

-- RPC: listar notificaciones del usuario
create or replace function listar_notificaciones(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'id', n.id,
      'company_id', n.company_id,
      'user_id', n.user_id,
      'type', n.type,
      'title', n.title,
      'message', n.message,
      'link', n.link,
      'read', n.read,
      'created_by', n.created_by,
      'created_at', n.created_at
    ) order by n.created_at desc),
    '[]'::jsonb
  )
  into result
  from notifications n
  where n.company_id = p_company_id and n.user_id = auth.uid();

  return result;
end;
$$;

-- RPC: contar no leídas
create or replace function contar_no_leidas(p_company_id uuid)
returns bigint
language sql
security definer
set search_path = public
as $$
  select count(*)::bigint
  from notifications
  where company_id = p_company_id and user_id = auth.uid() and not read;
$$;

-- RPC: marcar como leída
create or replace function marcar_leida(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update notifications set read = true where id = p_id and user_id = auth.uid();
$$;

-- RPC: marcar todas como leídas
create or replace function marcar_todas_leidas(p_company_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update notifications set read = true
  where company_id = p_company_id and user_id = auth.uid() and not read;
$$;

-- RPC: crear notificación manual (solo admin)
create or replace function crear_notificacion(p_company_id uuid, p_user_id uuid, p_type text, p_title text, p_message text, p_link text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin_of(p_company_id) then
    raise exception 'Solo administradores pueden crear notificaciones';
  end if;

  insert into notifications (company_id, user_id, type, title, message, link, created_by)
  values (p_company_id, p_user_id, p_type, p_title, p_message, p_link, auth.uid())
  returning row_to_json(notifications)::jsonb into result;

  return result;
end;
$$;

-- RPC: crear notificación para todos los miembros (solo admin)
create or replace function crear_notificacion_todos(p_company_id uuid, p_type text, p_title text, p_message text, p_link text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_of(p_company_id) then
    raise exception 'Solo administradores pueden crear notificaciones';
  end if;

  insert into notifications (company_id, user_id, type, title, message, link, created_by)
  select p_company_id, cm.user_id, p_type, p_title, p_message, p_link, auth.uid()
  from public.company_members cm
  where cm.company_id = p_company_id;
end;
$$;

-- Trigger: notificar al asignado de un contacto (round robin / asignación manual)
create or replace function public.notify_contact_assigned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assigned_to is not null and (old is null or old.assigned_to is distinct from new.assigned_to) then
    insert into notifications (company_id, user_id, type, title, message, link, created_by)
    values (
      new.company_id,
      new.assigned_to,
      'contacto_asignado',
      'Nuevo contacto asignado',
      'Se te ha asignado el contacto: ' || new.name,
      '/contacts/' || new.id,
      new.created_by
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_contact_assigned on contacts;
create trigger trg_notify_contact_assigned
  after insert or update of assigned_to on contacts
  for each row execute function public.notify_contact_assigned();

-- Trigger: notificar cambio de etapa en deal
create or replace function public.notify_deal_stage_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  stage_name text;
  assignees uuid[];
begin
  if old.stage_id is distinct from new.stage_id then
    select name into stage_name from stages where id = new.stage_id;

    -- Notificar al creador/asignado del deal
    assignees := array[new.created_by, new.assigned_to];

    insert into notifications (company_id, user_id, type, title, message, link, created_by)
    select
      new.company_id,
      unnest(assignees),
      'deal_stage_change',
      'Cambio de etapa',
      'La oportunidad "' || new.title || '" pasó a: ' || coalesce(stage_name, 'sin etapa'),
      '/deals/' || new.id,
      new.updated_by
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_deal_stage_change on deals;
create trigger trg_notify_deal_stage_change
  after update of stage_id on deals
  for each row execute function public.notify_deal_stage_change();
