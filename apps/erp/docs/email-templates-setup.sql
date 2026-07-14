-- ============================================================
-- Plantillas de correo dinámicas
-- Ejecutar después de crm-setup.sql
-- ============================================================

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  subject text not null,
  body text not null,
  context text not null default 'contact'
    check (context in ('contact', 'deal', 'lead')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.email_templates enable row level security;

drop policy if exists "et_select" on public.email_templates;
create policy "et_select" on public.email_templates for select
  using (public.is_member_of(company_id));

drop policy if exists "et_insert" on public.email_templates;
create policy "et_insert" on public.email_templates for insert
  with check (public.is_member_of(company_id));

drop policy if exists "et_update" on public.email_templates;
create policy "et_update" on public.email_templates for update
  using (public.is_member_of(company_id));

drop policy if exists "et_delete" on public.email_templates;
create policy "et_delete" on public.email_templates for delete
  using (public.is_member_of(company_id));

create index if not exists idx_email_templates_company on public.email_templates(company_id);
