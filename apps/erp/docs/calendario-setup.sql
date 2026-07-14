-- Calendario CRM — tabla eventos + RLS
-- Ejecutar después de crm-setup.sql

create table if not exists eventos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  title text not null,
  description text,
  start_date timestamptz not null,
  end_date timestamptz,
  all_day boolean not null default false,
  type text not null default 'reunion' check (type in ('reunion','llamada','tarea','recordatorio','personalizado')),
  color text default '#3b82f6',
  contact_id uuid references contacts(id) on delete set null,
  deal_id uuid references deals(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table eventos enable row level security;

-- RLS: miembros de la empresa pueden SELECT
drop policy if exists "eventos_select" on eventos;
create policy "eventos_select" on eventos
  for select using (public.is_member_of(company_id));

drop policy if exists "eventos_insert" on eventos;
create policy "eventos_insert" on eventos
  for insert with check (public.is_member_of(company_id));

drop policy if exists "eventos_update" on eventos;
create policy "eventos_update" on eventos
  for update using (public.is_member_of(company_id));

drop policy if exists "eventos_delete" on eventos;
create policy "eventos_delete" on eventos
  for delete using (public.is_member_of(company_id));

-- Trigger updated_at
-- Seed: permisos de calendario en role_permissions (para la Edge Function get-user-permissions)
insert into role_permissions (role, permission) values
  ('admin', 'evento:ver'), ('admin', 'evento:crear'), ('admin', 'evento:editar'), ('admin', 'evento:eliminar'),
  ('vendedor', 'evento:ver'), ('vendedor', 'evento:crear'),
  ('supervisor', 'evento:ver'), ('supervisor', 'evento:crear'), ('supervisor', 'evento:editar'), ('supervisor', 'evento:eliminar'),
  ('viewer', 'evento:ver')
on conflict (role, permission) do nothing;

create or replace function public.eventos_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_eventos_updated_at on eventos;
create trigger trg_eventos_updated_at
  before update on eventos
  for each row execute function public.eventos_updated_at();
