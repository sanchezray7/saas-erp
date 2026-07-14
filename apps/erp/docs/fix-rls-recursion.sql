-- Fix: infinita recursión en policies de company_members
-- Ejecutar en Supabase SQL Editor

-- 1. Eliminar policies recursivas viejas
drop policy if exists "Admins insertan miembros" on company_members;
drop policy if exists "Admins actualizan miembros" on company_members;
drop policy if exists "Admins eliminan miembros" on company_members;

-- 2. Crear función helper con security definer (bypasea RLS)
create or replace function public.is_admin_of(company_id uuid)
returns boolean
language plpgsql
security definer
stable
as $$
begin
  return exists (
    select 1 from public.company_members
    where company_id = $1 and user_id = auth.uid() and role = 'admin'
  );
end;
$$;

-- 3. Crear policies NO recursivas usando la función
create policy "Admins insertan miembros" on company_members
  for insert with check (is_admin_of(company_id));

create policy "Admins actualizan miembros" on company_members
  for update using (is_admin_of(company_id));

create policy "Admins eliminan miembros" on company_members
  for delete using (is_admin_of(company_id));
