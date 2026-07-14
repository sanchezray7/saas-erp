-- Organigrama / Jerarquía departamental
-- Ejecutar después de rrhh-setup.sql

alter table departamentos add column if not exists parent_depto_id uuid references departamentos(id) on delete set null;
alter table departamentos add column if not exists puesto_responsable_id uuid references puestos(id) on delete set null;

-- Vincular auth user con empleado
alter table empleados add column if not exists user_id uuid references auth.users(id) on delete set null;
create unique index if not exists idx_empleados_user_id on empleados(user_id) where user_id is not null;

-- Asociar puesto a un departamento
alter table puestos add column if not exists departamento_id uuid references departamentos(id) on delete set null;

-- RPC para listar miembros del equipo (bypass RLS)
create or replace function public.listar_miembros_equipo(p_company uuid)
returns table (user_id uuid, email text)
language sql
security definer
set search_path = public
as $$
  select cm.user_id, u.email
  from company_members cm
  left join auth.users u on u.id = cm.user_id
  where cm.company_id = p_company
  order by u.email;
$$;
