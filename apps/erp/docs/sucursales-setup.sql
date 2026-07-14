-- Sucursales: múltiples establecimientos para una misma empresa
-- Ejecutar después de crm-setup.sql

-- 1. Eliminar índice único de rif (la validación pasa al código)
drop index if exists companies_rif_idx;

-- 2. RPC para crear sucursal (solo admins de la empresa original)
create or replace function crear_sucursal(
  p_user_id uuid,
  p_company_name text,
  p_rif text,
  p_pais text default 'PY'
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_original_id uuid;
  v_new_id uuid;
begin
  -- Buscar empresa original con ese RIF
  select id into v_original_id from companies where rif = p_rif limit 1;
  if not found then
    raise exception 'No existe una empresa principal con ese RIF';
  end if;

  -- Verificar que el usuario sea admin de la empresa original
  if not exists (
    select 1 from company_members
    where company_id = v_original_id and user_id = p_user_id and role = 'admin'
  ) then
    raise exception 'Solo un administrador de la empresa principal puede crear sucursales';
  end if;

  -- Crear la sucursal
  insert into companies (name, rif, pais, plan, status, parent_company_id)
  values (p_company_name, p_rif, p_pais, (select plan from companies where id = v_original_id), 'active', v_original_id)
  returning id into v_new_id;

  -- Copiar configuración básica
  insert into company_config (company_id, app_name)
  values (v_new_id, p_company_name);

  -- Pipeline por defecto
  insert into pipelines (company_id, name, description)
  values (v_new_id, 'Pipeline por defecto', 'Pipeline principal de ventas');

  -- Asignar al usuario como admin
  insert into company_members (company_id, user_id, role)
  values (v_new_id, p_user_id, 'admin');

  return v_new_id;
end;
$$;
