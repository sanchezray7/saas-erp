-- Alertas de vencimiento de documentos de proveedores
-- Ejecutar después de srm-setup.sql

create table if not exists proveedor_documentos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  proveedor_id uuid not null references proveedores(id) on delete cascade,
  nombre text not null,
  tipo_documento text not null default 'otro' check (tipo_documento in ('ruc','constancia_fiscal','seguro','habilitacion','contrato','otro')),
  fecha_emision date,
  fecha_vencimiento date,
  alerta_dias_antes integer not null default 30,
  ultima_alerta_enviada timestamptz,
  archivo_url text,
  estado text not null default 'vigente' check (estado in ('vigente','por_vencer','vencido','anulado')),
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_proveedor_documentos_company on proveedor_documentos(company_id);
create index if not exists idx_proveedor_documentos_proveedor on proveedor_documentos(proveedor_id);

-- RLS
alter table proveedor_documentos enable row level security;
drop policy if exists "proveedor_documentos_select" on proveedor_documentos;
create policy "proveedor_documentos_select" on proveedor_documentos for select using (public.is_member_of(company_id));
drop policy if exists "proveedor_documentos_insert" on proveedor_documentos;
create policy "proveedor_documentos_insert" on proveedor_documentos for insert with check (public.is_member_of(company_id));
drop policy if exists "proveedor_documentos_update" on proveedor_documentos;
create policy "proveedor_documentos_update" on proveedor_documentos for update using (public.is_member_of(company_id));
drop policy if exists "proveedor_documentos_delete" on proveedor_documentos;
create policy "proveedor_documentos_delete" on proveedor_documentos for delete using (public.is_member_of(company_id));

-- RPC: listar documentos de un proveedor
create or replace function listar_documentos_proveedor(p_proveedor_id uuid)
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', d.id,
      'nombre', d.nombre,
      'tipo_documento', d.tipo_documento,
      'fecha_emision', d.fecha_emision,
      'fecha_vencimiento', d.fecha_vencimiento,
      'alerta_dias_antes', d.alerta_dias_antes,
      'ultima_alerta_enviada', d.ultima_alerta_enviada,
      'archivo_url', d.archivo_url,
      'estado', d.estado,
      'notas', d.notas,
      'dias_restantes', case when d.fecha_vencimiento is not null then (d.fecha_vencimiento - now()::date)::int else null end,
      'created_at', d.created_at
    ) order by d.fecha_vencimiento nulls last
  ), '[]'::jsonb)
  from proveedor_documentos d
  where d.proveedor_id = p_proveedor_id;
$$;

-- RPC: alertas de vencimiento (todos los proveedores)
create or replace function alertas_vencimiento(p_company_id uuid)
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', d.id,
      'proveedor_id', d.proveedor_id,
      'proveedor_nombre', p.nombre,
      'proveedor_telefono', p.telefono,
      'nombre', d.nombre,
      'tipo_documento', d.tipo_documento,
      'fecha_vencimiento', d.fecha_vencimiento,
      'alerta_dias_antes', d.alerta_dias_antes,
      'ultima_alerta_enviada', d.ultima_alerta_enviada,
      'estado', d.estado,
      'dias_restantes', case when d.fecha_vencimiento is not null then (d.fecha_vencimiento - now()::date)::int else null end
    ) order by d.fecha_vencimiento nulls last
  ), '[]'::jsonb)
  from proveedor_documentos d
  join proveedores p on p.id = d.proveedor_id
  where d.company_id = p_company_id
    and d.estado in ('vigente', 'por_vencer')
    and d.fecha_vencimiento is not null
    and d.fecha_vencimiento <= now()::date + (d.alerta_dias_antes || ' days')::interval;
$$;
