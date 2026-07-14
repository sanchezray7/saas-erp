-- Localización por país para CRM LATAM
-- Ejecutar después de crm-setup.sql

-- 1. Agregar columna pais a companies
alter table companies add column if not exists pais text not null default 'PY';

-- 2. Actualizar función crear_empresa_crm para aceptar pais
create or replace function public.crear_empresa_crm(
  empresa_nombre text,
  p_user_id uuid default auth.uid(),
  p_rif text default null,
  p_pais text default 'PY'
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_company_id uuid;
  v_pipeline_id uuid;
  v_user_id uuid;
begin
  v_user_id := coalesce(p_user_id, auth.uid());
  if v_user_id is null then
    raise exception 'No se puede identificar al usuario. Registrate primero.';
  end if;
  insert into companies (name, rif, pais) values (empresa_nombre, p_rif, p_pais)
    returning id into v_company_id;
  insert into company_members (company_id, user_id, role)
    values (v_company_id, v_user_id, 'admin');
  insert into company_config (company_id, app_name)
    values (v_company_id, empresa_nombre);
  insert into pipelines (company_id, name, description)
    values (v_company_id, 'Pipeline por defecto', 'Pipeline principal de ventas')
    returning id into v_pipeline_id;
  insert into stages (pipeline_id, name, position, probability, color) values
    (v_pipeline_id, 'Nuevo',           0, 10,  '#6366f1'),
    (v_pipeline_id, 'Contactado',      1, 25,  '#3b82f6'),
    (v_pipeline_id, 'Propuesta',       2, 50,  '#f59e0b'),
    (v_pipeline_id, 'Negociación',     3, 75,  '#f97316'),
    (v_pipeline_id, 'Cerrado ganado',  4, 100, '#22c55e'),
    (v_pipeline_id, 'Cerrado perdido', 5, 0,   '#ef4444');
  insert into webhook_tokens (company_id, token)
  values (v_company_id, gen_random_uuid());
  return v_company_id;
end;
$$;
