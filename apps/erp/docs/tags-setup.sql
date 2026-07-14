-- Tags para contactos y oportunidades
-- Ejecutar después de crm-setup.sql

create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  nombre text not null,
  color text not null default '#6366f1',
  created_at timestamptz not null default now(),
  unique(company_id, nombre)
);

alter table tags enable row level security;

drop policy if exists "tags_select" on tags;
create policy "tags_select" on tags for select
  using (public.is_member_of(company_id));

drop policy if exists "tags_insert" on tags;
create policy "tags_insert" on tags for insert
  with check (public.is_member_of(company_id));

drop policy if exists "tags_delete" on tags;
create policy "tags_delete" on tags for delete
  using (public.is_member_of(company_id));

create table if not exists contact_tags (
  contact_id uuid not null references contacts(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (contact_id, tag_id)
);

alter table contact_tags enable row level security;

drop policy if exists "contact_tags_select" on contact_tags;
create policy "contact_tags_select" on contact_tags for select
  using (exists (select 1 from contacts c where c.id = contact_id and public.is_member_of(c.company_id)));

drop policy if exists "contact_tags_insert" on contact_tags;
create policy "contact_tags_insert" on contact_tags for insert
  with check (exists (select 1 from contacts c where c.id = contact_id and public.is_member_of(c.company_id)));

drop policy if exists "contact_tags_delete" on contact_tags;
create policy "contact_tags_delete" on contact_tags for delete
  using (exists (select 1 from contacts c where c.id = contact_id and public.is_member_of(c.company_id)));

-- Extensión a deals (opcional, misma estructura)
create table if not exists deal_tags (
  deal_id uuid not null references deals(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (deal_id, tag_id)
);

alter table deal_tags enable row level security;

drop policy if exists "deal_tags_select" on deal_tags;
create policy "deal_tags_select" on deal_tags for select
  using (exists (select 1 from deals d where d.id = deal_id and public.is_member_of(d.company_id)));

drop policy if exists "deal_tags_insert" on deal_tags;
create policy "deal_tags_insert" on deal_tags for insert
  with check (exists (select 1 from deals d where d.id = deal_id and public.is_member_of(d.company_id)));

drop policy if exists "deal_tags_delete" on deal_tags;
create policy "deal_tags_delete" on deal_tags for delete
  using (exists (select 1 from deals d where d.id = deal_id and public.is_member_of(d.company_id)));
