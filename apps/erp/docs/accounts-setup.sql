-- Plan de Cuentas y Asientos Contables (core)
-- Extraído de accounting-setup.sql para resolver orden de dependencias
-- Ejecutar ANTES de cotizaciones-setup.sql (que referencia accounts)

-- ============================================================
-- Plan de Cuentas (@saas/accounting — Fase 2)
-- ============================================================

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  parent_id uuid references accounts(id) on delete set null,
  code text not null,
  name text not null,
  type text not null check (type in ('activo', 'pasivo', 'patrimonio', 'ingreso', 'costo', 'gasto')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, code)
);

create index if not exists idx_accounts_company on accounts(company_id);
create index if not exists idx_accounts_parent on accounts(parent_id);

alter table accounts enable row level security;
drop policy if exists "accounts_select" on accounts;
create policy "accounts_select" on accounts for select using (public.is_member_of(company_id));
drop policy if exists "accounts_insert" on accounts;
create policy "accounts_insert" on accounts for insert with check (public.is_member_of(company_id));
drop policy if exists "accounts_update" on accounts;
create policy "accounts_update" on accounts for update using (public.is_member_of(company_id));
drop policy if exists "accounts_delete" on accounts;
create policy "accounts_delete" on accounts for delete using (public.is_member_of(company_id));

-- Vincular impuestos a cuentas contables
alter table taxes add column if not exists account_id uuid references accounts(id) on delete set null;

-- Cuentas contables para productos (compra/venta)
alter table catalogo_productos add column if not exists account_compra_id uuid references accounts(id) on delete set null;
alter table catalogo_productos add column if not exists account_venta_id uuid references accounts(id) on delete set null;

-- ============================================================
-- Asientos Contables (@saas/accounting — Fase 3)
-- ============================================================

create table if not exists journal_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  entry_number text not null,
  entry_date date not null default now(),
  description text,
  source_type text not null check (source_type in ('factura_proveedor', 'factura_cliente', 'pago_proveedor', 'pago_cliente', 'manual')),
  source_id uuid,
  total_debit numeric(12,2) not null default 0,
  total_credit numeric(12,2) not null default 0,
  estado text not null default 'borrador' check (estado in ('borrador', 'contabilizado', 'anulado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_journal_entries_company on journal_entries(company_id);

create table if not exists journal_entry_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references journal_entries(id) on delete cascade,
  account_id uuid not null references accounts(id),
  description text,
  debit numeric(12,2) not null default 0,
  credit numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_journal_entry_lines_entry on journal_entry_lines(journal_entry_id);

-- RLS
alter table journal_entries enable row level security;
alter table journal_entry_lines enable row level security;

drop policy if exists "journal_entries_select" on journal_entries;
create policy "journal_entries_select" on journal_entries for select using (public.is_member_of(company_id));
drop policy if exists "journal_entries_insert" on journal_entries;
create policy "journal_entries_insert" on journal_entries for insert with check (public.is_member_of(company_id));
drop policy if exists "journal_entries_update" on journal_entries;
create policy "journal_entries_update" on journal_entries for update using (public.is_member_of(company_id));
drop policy if exists "journal_entries_delete" on journal_entries;
create policy "journal_entries_delete" on journal_entries for delete using (public.is_member_of(company_id));

drop policy if exists "journal_entry_lines_select" on journal_entry_lines;
create policy "journal_entry_lines_select" on journal_entry_lines for select using (exists (select 1 from journal_entries je where je.id = journal_entry_id and public.is_member_of(je.company_id)));
drop policy if exists "journal_entry_lines_insert" on journal_entry_lines;
create policy "journal_entry_lines_insert" on journal_entry_lines for insert with check (exists (select 1 from journal_entries je where je.id = journal_entry_id and public.is_member_of(je.company_id)));
drop policy if exists "journal_entry_lines_delete" on journal_entry_lines;
create policy "journal_entry_lines_delete" on journal_entry_lines for delete using (exists (select 1 from journal_entries je where je.id = journal_entry_id and public.is_member_of(je.company_id)));
