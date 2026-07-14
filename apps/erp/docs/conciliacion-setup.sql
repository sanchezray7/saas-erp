-- Conciliación bancaria
-- Ejecutar después de accounting-setup.sql y cuentas-pagar-cobrar-setup.sql

-- 1. Datos bancarios en cuentas contables
alter table accounts add column if not exists banco_nombre text;
alter table accounts add column if not exists numero_cuenta text;
alter table accounts add column if not exists tipo_cuenta text check (tipo_cuenta in ('corriente', 'ahorro')) not null default 'corriente';

-- 2. Extractos bancarios (líneas cargadas del banco)
create table if not exists extractos_bancarios (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  fecha date not null,
  concepto text not null,
  monto numeric(12,2) not null,
  referencia text,
  conciliado boolean not null default false,
  created_at timestamptz not null default now()
);

alter table extractos_bancarios enable row level security;
drop policy if exists "extractos_select" on extractos_bancarios;
create policy "extractos_select" on extractos_bancarios for select using (public.is_member_of(company_id));
drop policy if exists "extractos_insert" on extractos_bancarios;
create policy "extractos_insert" on extractos_bancarios for insert with check (public.is_member_of(company_id));
drop policy if exists "extractos_update" on extractos_bancarios;
create policy "extractos_update" on extractos_bancarios for update using (public.is_member_of(company_id));
drop policy if exists "extractos_delete" on extractos_bancarios;
create policy "extractos_delete" on extractos_bancarios for delete using (public.is_member_of(company_id));

create index if not exists idx_extractos_cuenta on extractos_bancarios(account_id, fecha);

-- 3. Conciliaciones
create table if not exists conciliaciones (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  periodo_inicio date not null,
  periodo_fin date not null,
  saldo_inicial_extracto numeric(12,2) not null default 0,
  saldo_final_extracto numeric(12,2) not null default 0,
  saldo_inicial_libro numeric(12,2) not null default 0,
  saldo_final_libro numeric(12,2) not null default 0,
  estado text not null default 'abierta' check (estado in ('abierta', 'conciliada', 'cerrada')),
  created_at timestamptz not null default now()
);

alter table conciliaciones enable row level security;
drop policy if exists "conciliaciones_select" on conciliaciones;
create policy "conciliaciones_select" on conciliaciones for select using (public.is_member_of(company_id));
drop policy if exists "conciliaciones_insert" on conciliaciones;
create policy "conciliaciones_insert" on conciliaciones for insert with check (public.is_member_of(company_id));
drop policy if exists "conciliaciones_update" on conciliaciones;
create policy "conciliaciones_update" on conciliaciones for update using (public.is_member_of(company_id));
drop policy if exists "conciliaciones_delete" on conciliaciones;
create policy "conciliaciones_delete" on conciliaciones for delete using (public.is_member_of(company_id));

-- 4. Relación extracto → conciliación
alter table extractos_bancarios add column if not exists conciliacion_id uuid references conciliaciones(id) on delete set null;

-- 5. RPC: obtener transacciones del libro para conciliar
create or replace function obtener_transacciones_libro(p_account_id uuid, p_desde date, p_hasta date)
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'fuente', 'pago_proveedor',
      'id', pp.id,
      'fecha', pp.fecha_pago,
      'concepto', concat('Pago a ', pr.nombre),
      'monto', -pp.monto,
      'referencia', pp.referencia
    )
  ) filter (where pr.nombre is not null), '[]'::jsonb)
  from pagos_proveedor pp
  left join proveedor_facturas pf on pf.id = pp.factura_id
  left join proveedores pr on pr.id = pf.proveedor_id
  where pp.cuenta_banco_id = p_account_id
    and pp.fecha_pago >= p_desde and pp.fecha_pago <= p_hasta
$$;

-- 6. RPC: calcular saldo contable al cierre
create or replace function calcular_saldo_libro(p_account_id uuid, p_hasta date)
returns numeric
language sql
stable
as $$
  select coalesce((
    select sum(jel.debit) - sum(jel.credit)
    from journal_entry_lines jel
    join journal_entries je on je.id = jel.journal_entry_id
    where jel.account_id = p_account_id
      and je.estado = 'contabilizado'
      and je.entry_date <= p_hasta
  ), 0)
$$;
