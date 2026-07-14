-- Motor de impuestos LATAM (@saas/accounting)
-- Extraído de accounting-setup.sql para resolver orden de dependencias

-- Grupos de impuestos (IVA, Retención, etc.)
create table if not exists tax_groups (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  type text not null check (type in ('debito_fiscal', 'credito_fiscal', 'retencion_compra', 'retencion_venta')),
  created_at timestamptz not null default now()
);

create index if not exists idx_tax_groups_company on tax_groups(company_id);

-- Impuestos específicos (IVA 10%, Ret. Renta 1%, etc.)
create table if not exists taxes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  tax_group_id uuid not null references tax_groups(id) on delete cascade,
  name text not null,
  percentage numeric(5,2) not null,
  is_withholding boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_taxes_company on taxes(company_id);

-- Líneas de impuestos aplicadas a facturas (polimórfico)
create table if not exists invoice_tax_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  invoice_type text not null check (invoice_type in ('proveedor', 'cliente')),
  invoice_id uuid not null,
  tax_id uuid not null references taxes(id),
  base_amount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_invoice_tax_lines_invoice on invoice_tax_lines(invoice_type, invoice_id);

-- Columna para vincular impuestos a items específicos de la factura
alter table invoice_tax_lines add column if not exists item_id uuid;
create index if not exists idx_invoice_tax_lines_item on invoice_tax_lines(item_id);

-- RLS
alter table tax_groups enable row level security;
alter table taxes enable row level security;
alter table invoice_tax_lines enable row level security;

drop policy if exists "tax_groups_select" on tax_groups;
create policy "tax_groups_select" on tax_groups for select using (public.is_member_of(company_id));
drop policy if exists "tax_groups_insert" on tax_groups;
create policy "tax_groups_insert" on tax_groups for insert with check (public.is_member_of(company_id));
drop policy if exists "tax_groups_update" on tax_groups;
create policy "tax_groups_update" on tax_groups for update using (public.is_member_of(company_id));
drop policy if exists "tax_groups_delete" on tax_groups;
create policy "tax_groups_delete" on tax_groups for delete using (public.is_member_of(company_id));

drop policy if exists "taxes_select" on taxes;
create policy "taxes_select" on taxes for select using (public.is_member_of(company_id));
drop policy if exists "taxes_insert" on taxes;
create policy "taxes_insert" on taxes for insert with check (public.is_member_of(company_id));
drop policy if exists "taxes_update" on taxes;
create policy "taxes_update" on taxes for update using (public.is_member_of(company_id));
drop policy if exists "taxes_delete" on taxes;
create policy "taxes_delete" on taxes for delete using (public.is_member_of(company_id));

drop policy if exists "invoice_tax_lines_select" on invoice_tax_lines;
create policy "invoice_tax_lines_select" on invoice_tax_lines for select using (public.is_member_of(company_id));
drop policy if exists "invoice_tax_lines_insert" on invoice_tax_lines;
create policy "invoice_tax_lines_insert" on invoice_tax_lines for insert with check (public.is_member_of(company_id));
drop policy if exists "invoice_tax_lines_delete" on invoice_tax_lines;
create policy "invoice_tax_lines_delete" on invoice_tax_lines for delete using (public.is_member_of(company_id));
