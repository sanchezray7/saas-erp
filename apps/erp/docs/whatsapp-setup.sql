-- WhatsApp integration for CRM
-- Ejecutar después de crm-setup.sql

-- 1. Agregar 'whatsapp' como tipo válido de actividad
alter table activities drop constraint if exists activities_type_check;
alter table activities add constraint activities_type_check
  check (type in ('call', 'email', 'meeting', 'note', 'task', 'whatsapp'));

-- 2. Tabla de auditoría de mensajes WhatsApp
create table if not exists notificaciones_whatsapp (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  telefono text not null,
  mensaje text not null,
  twilio_sid text,
  estado text not null default 'enviado',
  error text,
  created_at timestamptz not null default now()
);

alter table notificaciones_whatsapp enable row level security;

drop policy if exists "notificaciones_whatsapp_select" on notificaciones_whatsapp;
create policy "notificaciones_whatsapp_select"
  on notificaciones_whatsapp for select
  using (public.is_member_of(company_id));

drop policy if exists "notificaciones_whatsapp_insert" on notificaciones_whatsapp;
create policy "notificaciones_whatsapp_insert"
  on notificaciones_whatsapp for insert
  with check (public.is_member_of(company_id));

create index if not exists idx_notificaciones_whatsapp_company
  on notificaciones_whatsapp (company_id, created_at desc);

-- 3. Columna proveedor_id para mensajes vinculados a proveedores
alter table notificaciones_whatsapp add column if not exists proveedor_id uuid references proveedores(id) on delete set null;
create index if not exists idx_notificaciones_whatsapp_proveedor on notificaciones_whatsapp(proveedor_id);

-- 4. Función auxiliar para webhook: busca contacto o proveedor por teléfono
create or replace function buscar_por_telefono(p_telefono text)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'contacto', (select jsonb_build_object('id', id, 'company_id', company_id) from contacts where phone = p_telefono or phone ilike '%' || right(p_telefono, 10) limit 1),
    'proveedor', (select jsonb_build_object('id', id, 'company_id', company_id) from proveedores where telefono = p_telefono limit 1)
  );
$$;
