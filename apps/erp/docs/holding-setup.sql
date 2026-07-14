-- Grupos holding / consolidación de empresas independientes
-- Ejecutar después de consolidacion-setup.sql

-- 1. Grupos económicos (holdings)
create table if not exists grupos_holding (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  nombre text not null,
  created_at timestamptz not null default now()
);

alter table grupos_holding enable row level security;
drop policy if exists "grupos_select" on grupos_holding;
create policy "grupos_select" on grupos_holding for select using (public.is_member_of(company_id));
drop policy if exists "grupos_insert" on grupos_holding;
create policy "grupos_insert" on grupos_holding for insert with check (public.is_member_of(company_id));
drop policy if exists "grupos_update" on grupos_holding;
create policy "grupos_update" on grupos_holding for update using (public.is_member_of(company_id));
drop policy if exists "grupos_delete" on grupos_holding;
create policy "grupos_delete" on grupos_holding for delete using (public.is_member_of(company_id));

-- 2. Miembros del holding
create table if not exists holding_miembros (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references grupos_holding(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  participacion numeric(5,2) not null default 100,
  created_at timestamptz not null default now(),
  unique(grupo_id, company_id)
);

alter table holding_miembros enable row level security;
drop policy if exists "miembros_select" on holding_miembros;
create policy "miembros_select" on holding_miembros for select
  using (exists (select 1 from grupos_holding g where g.id = grupo_id and public.is_member_of(g.company_id)));
drop policy if exists "miembros_insert" on holding_miembros;
create policy "miembros_insert" on holding_miembros for insert
  with check (exists (select 1 from grupos_holding g where g.id = grupo_id and public.is_member_of(g.company_id)));
drop policy if exists "miembros_delete" on holding_miembros;
create policy "miembros_delete" on holding_miembros for delete
  using (exists (select 1 from grupos_holding g where g.id = grupo_id and public.is_member_of(g.company_id)));

-- 3. RPC: empresas del holding (reemplaza empresas_del_grupo para holding)
create or replace function empresas_del_holding(p_grupo_id uuid)
returns uuid[]
language sql
stable
as $$
  select array(select company_id from holding_miembros where grupo_id = p_grupo_id)
$$;

-- 4. RPC: balance consolidado por holding
create or replace function consolidar_balance_holding(p_grupo_id uuid, p_eliminar_ic boolean default false)
returns jsonb
language sql
stable
as $$
  with grupo as (
    select unnest(empresas_del_holding(p_grupo_id)) as cid
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

-- 5. RPC: resultados consolidado por holding
create or replace function consolidar_resultados_holding(p_grupo_id uuid, p_eliminar_ic boolean default false)
returns jsonb
language sql
stable
as $$
  with grupo as (
    select unnest(empresas_del_holding(p_grupo_id)) as cid
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

-- 6. RPC: resumen por empresa del holding
create or replace function resumen_por_holding(p_grupo_id uuid)
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'company_id', c.id,
      'company_name', c.name,
      'total_activo', coalesce((
        select sum(jel.debit - jel.credit) from journal_entry_lines jel
        join journal_entries je on je.id = jel.journal_entry_id
        join accounts a on a.id = jel.account_id
        where a.company_id = c.id and a.type = 'activo' and je.estado = 'contabilizado'
      ), 0),
      'total_pasivo', coalesce((
        select sum(jel.credit - jel.debit) from journal_entry_lines jel
        join journal_entries je on je.id = jel.journal_entry_id
        join accounts a on a.id = jel.account_id
        where a.company_id = c.id and a.type = 'pasivo' and je.estado = 'contabilizado'
      ), 0),
      'resultado', coalesce((
        select sum(case when a.type in ('ingreso') then jel.credit - jel.debit
                        when a.type in ('costo', 'gasto') then jel.debit - jel.credit
                        else 0 end)
        from journal_entry_lines jel
        join journal_entries je on je.id = jel.journal_entry_id
        join accounts a on a.id = jel.account_id
        where a.company_id = c.id and a.type in ('ingreso', 'costo', 'gasto') and je.estado = 'contabilizado'
      ), 0),
      'participacion', coalesce((select participacion from holding_miembros where grupo_id = p_grupo_id and company_id = c.id), 100)
    ) order by c.name
  ), '[]'::jsonb)
  from companies c
  where c.id = any(empresas_del_holding(p_grupo_id));
$$;
