-- Fix: GRANTs necesarios para el Custom Access Token Hook
-- El hook corre como `supabase_auth_admin`. Sin permisos falla en silencio.
-- Ejecutar DESPUÉS de fix-rls-all-tables.sql

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
grant select on public.company_members to supabase_auth_admin;
grant select on public.companies to supabase_auth_admin;

drop policy if exists "auth admin lee company_members" on public.company_members;
create policy "auth admin lee company_members"
  on public.company_members for select to supabase_auth_admin
  using (true);

drop policy if exists "auth admin lee companies" on public.companies;
create policy "auth admin lee companies"
  on public.companies for select to supabase_auth_admin
  using (true);
