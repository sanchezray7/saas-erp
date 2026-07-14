-- Consolidación avanzada: eliminaciones IC + asientos de consolidación
-- Ejecutar después de consolidacion-setup.sql

-- ============================================================
-- 1. Columna is_intercompany en accounts
-- ============================================================
alter table accounts add column if not exists is_intercompany boolean not null default false;

-- 2. Seed: agregar cuentas intercompañía al seed de Paraguay
-- Se crean con código específico para que puedan ser identificadas

-- ============================================================
-- 3. Asientos de consolidación (ajustes manuales)
-- ============================================================
create table if not exists consolidacion_asientos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  entry_number text not null,
  description text not null,
  entry_date date not null default now()::date,
  total_debit numeric(12,2) not null default 0,
  total_credit numeric(12,2) not null default 0,
  estado text not null default 'borrador' check (estado in ('borrador', 'contabilizado', 'anulado')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table consolidacion_asientos enable row level security;
drop policy if exists "cons_asientos_select" on consolidacion_asientos;
create policy "cons_asientos_select" on consolidacion_asientos for select using (public.is_member_of(company_id));
drop policy if exists "cons_asientos_insert" on consolidacion_asientos;
create policy "cons_asientos_insert" on consolidacion_asientos for insert with check (public.is_member_of(company_id));
drop policy if exists "cons_asientos_update" on consolidacion_asientos;
create policy "cons_asientos_update" on consolidacion_asientos for update using (public.is_member_of(company_id));
drop policy if exists "cons_asientos_delete" on consolidacion_asientos;
create policy "cons_asientos_delete" on consolidacion_asientos for delete using (public.is_member_of(company_id));

create table if not exists consolidacion_asiento_lines (
  id uuid primary key default gen_random_uuid(),
  asiento_id uuid not null references consolidacion_asientos(id) on delete cascade,
  account_id uuid not null references accounts(id),
  description text,
  debit numeric(12,2) not null default 0,
  credit numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

alter table consolidacion_asiento_lines enable row level security;
drop policy if exists "cons_asiento_lines_select" on consolidacion_asiento_lines;
create policy "cons_asiento_lines_select" on consolidacion_asiento_lines for select
  using (exists (select 1 from consolidacion_asientos ca where ca.id = asiento_id and public.is_member_of(ca.company_id)));
drop policy if exists "cons_asiento_lines_insert" on consolidacion_asiento_lines;
create policy "cons_asiento_lines_insert" on consolidacion_asiento_lines for insert
  with check (exists (select 1 from consolidacion_asientos ca where ca.id = asiento_id and public.is_member_of(ca.company_id)));
drop policy if exists "cons_asiento_lines_delete" on consolidacion_asiento_lines;
create policy "cons_asiento_lines_delete" on consolidacion_asiento_lines for delete
  using (exists (select 1 from consolidacion_asientos ca where ca.id = asiento_id and public.is_member_of(ca.company_id)));

-- ============================================================
-- 4. RPC: Balance consolidado con opción de eliminar IC
-- ============================================================
create or replace function consolidar_balance_con_ajustes(p_company_id uuid, p_eliminar_ic boolean default false)
returns jsonb
language sql
stable
as $$
  with grupo as (
    select unnest(empresas_del_grupo(p_company_id)) as cid
  ),
  saldos_base as (
    select a.id, a.code, a.name, a.type, a.parent_id, a.is_intercompany,
      sum(jel.debit - jel.credit) as saldo
    from accounts a
    join journal_entry_lines jel on jel.account_id = a.id
    join journal_entries je on je.id = jel.journal_entry_id
    join grupo on grupo.cid = je.company_id
    where a.type in ('activo', 'pasivo', 'patrimonio') and je.estado = 'contabilizado'
    group by a.id, a.code, a.name, a.type, a.parent_id, a.is_intercompany
  ),
  ajustes as (
    select cal.account_id, sum(cal.debit - cal.credit) as saldo
    from consolidacion_asiento_lines cal
    join consolidacion_asientos ca on ca.id = cal.asiento_id
    join grupo on grupo.cid = ca.company_id
    where ca.estado = 'contabilizado'
    group by cal.account_id
  ),
  saldos as (
    select s.id, s.code, s.name, s.type, s.parent_id,
      coalesce(s.saldo, 0) + coalesce(a.saldo, 0) as saldo
    from saldos_base s
    left join ajustes a on a.account_id = s.id
    where not (p_eliminar_ic and s.is_intercompany)
  )
  select jsonb_build_object(
    'total_activo', coalesce((select sum(saldo) from saldos where type = 'activo'), 0),
    'total_pasivo', coalesce((select sum(saldo) from saldos where type = 'pasivo'), 0),
    'total_patrimonio', coalesce((select sum(saldo) from saldos where type = 'patrimonio'), 0),
    'cuentas', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'code', s.code, 'name', s.name, 'type', s.type, 'parent_id', s.parent_id, 'saldo', round(s.saldo, 2)) order by s.code) from saldos s), '[]'::jsonb)
  )
$$;

-- 5. RPC: Resultados consolidado con opción de eliminar IC
create or replace function consolidar_resultados_con_ajustes(p_company_id uuid, p_eliminar_ic boolean default false)
returns jsonb
language sql
stable
as $$
  with grupo as (
    select unnest(empresas_del_grupo(p_company_id)) as cid
  ),
  saldos_base as (
    select a.id, a.code, a.name, a.type, a.parent_id, a.is_intercompany,
      case when a.type = 'ingreso' then sum(jel.credit - jel.debit)
           else sum(jel.debit - jel.credit)
      end as saldo
    from accounts a
    join journal_entry_lines jel on jel.account_id = a.id
    join journal_entries je on je.id = jel.journal_entry_id
    join grupo on grupo.cid = je.company_id
    where a.type in ('ingreso', 'costo', 'gasto') and je.estado = 'contabilizado'
    group by a.id, a.code, a.name, a.type, a.parent_id, a.is_intercompany
  ),
  ajustes as (
    select cal.account_id, sum(cal.debit - cal.credit) as saldo
    from consolidacion_asiento_lines cal
    join consolidacion_asientos ca on ca.id = cal.asiento_id
    join grupo on grupo.cid = ca.company_id
    where ca.estado = 'contabilizado'
    group by cal.account_id
  ),
  saldos as (
    select s.id, s.code, s.name, s.type, s.parent_id,
      coalesce(s.saldo, 0) + coalesce(a.saldo, 0) as saldo
    from saldos_base s
    left join ajustes a on a.account_id = s.id
    where not (p_eliminar_ic and s.is_intercompany)
  )
  select jsonb_build_object(
    'total_ingresos', coalesce((select sum(saldo) from saldos where type = 'ingreso'), 0),
    'total_costos', coalesce((select sum(saldo) from saldos where type = 'costo'), 0),
    'total_gastos', coalesce((select sum(saldo) from saldos where type = 'gasto'), 0),
    'cuentas', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'code', s.code, 'name', s.name, 'type', s.type, 'parent_id', s.parent_id, 'saldo', round(s.saldo, 2)) order by s.code) from saldos s where s.type in ('ingreso', 'costo', 'gasto')), '[]'::jsonb)
  )
$$;
