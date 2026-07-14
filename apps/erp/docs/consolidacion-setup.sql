-- Consolidación de sucursales
-- Ejecutar después de accounting-setup.sql y sucursales-setup.sql

-- 1. Columna para agrupar empresas
alter table companies add column if not exists parent_company_id uuid references companies(id);
create index if not exists idx_companies_parent on companies(parent_company_id);

-- 2. Seed: vincular empresas con mismo RIF (para empresas existentes)
update companies c
set parent_company_id = (select id from companies where rif = c.rif and id != c.id order by created_at limit 1)
where c.parent_company_id is null
  and exists (select 1 from companies where rif = c.rif and id != c.id);

-- 3. RPC: obtener IDs de todas las empresas del grupo
create or replace function empresas_del_grupo(p_company_id uuid)
returns uuid[]
language sql
stable
as $$
  select array(
    select id from companies
    where id = p_company_id
       or parent_company_id = p_company_id
       or (parent_company_id is not null and parent_company_id = (select parent_company_id from companies where id = p_company_id))
  )
$$;

-- 4. RPC: Balance General Consolidado
create or replace function consolidar_balance(p_company_id uuid)
returns jsonb
language sql
stable
as $$
  with grupo as (
    select unnest(empresas_del_grupo(p_company_id)) as cid
  ),
  saldos as (
    select a.id, a.code, a.name, a.type,
      sum(jel.debit - jel.credit) as saldo
    from accounts a
    join journal_entry_lines jel on jel.account_id = a.id
    join journal_entries je on je.id = jel.journal_entry_id
    join grupo on grupo.cid = a.company_id
    where a.type in ('activo', 'pasivo', 'patrimonio') and je.estado = 'contabilizado'
    group by a.id, a.code, a.name, a.type
  )
  select jsonb_build_object(
    'activo', coalesce((select jsonb_agg(jsonb_build_object('code', s.code, 'name', s.name, 'saldo', s.saldo) order by s.code) from saldos s where s.type = 'activo'), '[]'::jsonb),
    'pasivo', coalesce((select jsonb_agg(jsonb_build_object('code', s.code, 'name', s.name, 'saldo', s.saldo) order by s.code) from saldos s where s.type = 'pasivo'), '[]'::jsonb),
    'patrimonio', coalesce((select jsonb_agg(jsonb_build_object('code', s.code, 'name', s.name, 'saldo', s.saldo) order by s.code) from saldos s where s.type = 'patrimonio'), '[]'::jsonb)
  )
$$;

-- 5. RPC: Estado de Resultados Consolidado
create or replace function consolidar_resultados(p_company_id uuid)
returns jsonb
language sql
stable
as $$
  with grupo as (
    select unnest(empresas_del_grupo(p_company_id)) as cid
  ),
  saldos as (
    select a.id, a.code, a.name, a.type,
      case when a.type = 'ingreso' then sum(jel.credit - jel.debit)
           else sum(jel.debit - jel.credit)
      end as saldo
    from accounts a
    join journal_entry_lines jel on jel.account_id = a.id
    join journal_entries je on je.id = jel.journal_entry_id
    join grupo on grupo.cid = a.company_id
    where a.type in ('ingreso', 'costo', 'gasto') and je.estado = 'contabilizado'
    group by a.id, a.code, a.name, a.type
  )
  select jsonb_build_object(
    'ingresos', coalesce((select jsonb_agg(jsonb_build_object('code', s.code, 'name', s.name, 'saldo', s.saldo) order by s.code) from saldos s where s.type = 'ingreso'), '[]'::jsonb),
    'costos', coalesce((select jsonb_agg(jsonb_build_object('code', s.code, 'name', s.name, 'saldo', s.saldo) order by s.code) from saldos s where s.type = 'costo'), '[]'::jsonb),
    'gastos', coalesce((select jsonb_agg(jsonb_build_object('code', s.code, 'name', s.name, 'saldo', s.saldo) order by s.code) from saldos s where s.type = 'gasto'), '[]'::jsonb)
  )
$$;

-- 6. RPC: Antigüedad AP/AR Consolidada
create or replace function consolidar_aging_ap(p_company_id uuid)
returns jsonb
language sql
stable
as $$
  with grupo as (
    select unnest(empresas_del_grupo(p_company_id)) as cid
  )
  select jsonb_build_object(
    'total', coalesce(sum(coalesce(f.saldo_pendiente, f.total)), 0),
    'vencido', coalesce(sum(case when f.fecha_vencimiento < now()::date then coalesce(f.saldo_pendiente, f.total) else 0 end), 0),
    'por_vencer', coalesce(sum(case when f.fecha_vencimiento >= now()::date then coalesce(f.saldo_pendiente, f.total) else 0 end), 0),
    'facturas', count(*)
  )
  from proveedor_facturas f
  join grupo on grupo.cid = f.company_id
  where f.estado not in ('pagada', 'anulada')
$$;

create or replace function consolidar_aging_ar(p_company_id uuid)
returns jsonb
language sql
stable
as $$
  with grupo as (
    select unnest(empresas_del_grupo(p_company_id)) as cid
  )
  select jsonb_build_object(
    'total', coalesce(sum(coalesce(f.saldo_pendiente, f.total)), 0),
    'vencido', coalesce(sum(case when f.fecha_vencimiento < now()::date then coalesce(f.saldo_pendiente, f.total) else 0 end), 0),
    'por_vencer', coalesce(sum(case when f.fecha_vencimiento >= now()::date then coalesce(f.saldo_pendiente, f.total) else 0 end), 0),
    'facturas', count(*)
  )
  from facturas f
  join grupo on grupo.cid = f.company_id
  where f.estado = 'aprobada'
$$;

-- 7. RPC: resumen por sucursal
create or replace function resumen_por_sucursal(p_company_id uuid)
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
      ), 0)
    ) order by c.name
  ), '[]'::jsonb)
  from companies c
  where c.id = p_company_id
     or c.parent_company_id = p_company_id
     or (c.parent_company_id is not null and c.parent_company_id = (select parent_company_id from companies where id = p_company_id))
$$;
