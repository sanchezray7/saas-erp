-- =============================================================================
-- Fix: infinita recursión RLS en TODAS las tablas CRM
-- Inspirado en saas-school: helpers security definer + policies separadas
-- =============================================================================

-- 1. HELPER FUNCTIONS (security definer — bypasean RLS, igual que school)

create or replace function public.is_member_of(target_company uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.company_members
    where user_id = auth.uid() and company_id = target_company
  );
$$;

drop function if exists public.is_admin_of(uuid) cascade;
create function public.is_admin_of(company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.company_members
    where company_id = $1 and user_id = auth.uid() and role = 'admin'
  );
$$;

-- 2. COMPANIES

drop policy if exists "Usuarios ven sus empresas" on companies;
create policy "companies_select" on companies for select
  using (public.is_member_of(id));

drop policy if exists "Cualquiera inserta empresas" on companies;
create policy "companies_insert" on companies for insert
  with check (true);

-- 3. COMPANY_MEMBERS

drop policy if exists "Usuarios ven sus propios miembros" on company_members;
create policy "cm_select" on company_members for select
  using (user_id = auth.uid());

drop policy if exists "Admins insertan miembros" on company_members;
create policy "cm_insert" on company_members for insert
  with check (public.is_admin_of(company_id));

drop policy if exists "Admins actualizan miembros" on company_members;
create policy "cm_update" on company_members for update
  using (public.is_admin_of(company_id));

drop policy if exists "Admins eliminan miembros" on company_members;
create policy "cm_delete" on company_members for delete
  using (public.is_admin_of(company_id));

-- 4. ORGANIZATIONS

drop policy if exists "Organizaciones por empresa" on organizations;
create policy "org_select" on organizations for select
  using (public.is_member_of(company_id));
create policy "org_insert" on organizations for insert
  with check (public.is_member_of(company_id));
create policy "org_update" on organizations for update
  using (public.is_member_of(company_id));
create policy "org_delete" on organizations for delete
  using (public.is_member_of(company_id));

-- 5. CONTACTS

drop policy if exists "Contactos por empresa" on contacts;
create policy "contacts_select" on contacts for select
  using (public.is_member_of(company_id));
create policy "contacts_insert" on contacts for insert
  with check (public.is_member_of(company_id));
create policy "contacts_update" on contacts for update
  using (public.is_member_of(company_id));
create policy "contacts_delete" on contacts for delete
  using (public.is_member_of(company_id));

-- 6. PIPELINES

drop policy if exists "Pipelines por empresa" on pipelines;
create policy "pipelines_select" on pipelines for select
  using (public.is_member_of(company_id));
create policy "pipelines_insert" on pipelines for insert
  with check (public.is_member_of(company_id));
create policy "pipelines_update" on pipelines for update
  using (public.is_member_of(company_id));
create policy "pipelines_delete" on pipelines for delete
  using (public.is_member_of(company_id));

-- 7. STAGES

drop policy if exists "Etapas por pipeline" on stages;
create policy "stages_select" on stages for select
  using (
    exists (
      select 1 from public.pipelines p
      where p.id = pipeline_id and public.is_member_of(p.company_id)
    )
  );
create policy "stages_insert" on stages for insert
  with check (
    exists (
      select 1 from public.pipelines p
      where p.id = pipeline_id and public.is_member_of(p.company_id)
    )
  );
create policy "stages_update" on stages for update
  using (
    exists (
      select 1 from public.pipelines p
      where p.id = pipeline_id and public.is_member_of(p.company_id)
    )
  );
create policy "stages_delete" on stages for delete
  using (
    exists (
      select 1 from public.pipelines p
      where p.id = pipeline_id and public.is_member_of(p.company_id)
    )
  );

-- 8. DEALS

drop policy if exists "Deals por empresa" on deals;
create policy "deals_select" on deals for select
  using (public.is_member_of(company_id));
create policy "deals_insert" on deals for insert
  with check (public.is_member_of(company_id));
create policy "deals_update" on deals for update
  using (public.is_member_of(company_id));
create policy "deals_delete" on deals for delete
  using (public.is_member_of(company_id));

-- 9. ACTIVITIES

drop policy if exists "Actividades por empresa" on activities;
create policy "activities_select" on activities for select
  using (public.is_member_of(company_id));
create policy "activities_insert" on activities for insert
  with check (public.is_member_of(company_id));
create policy "activities_update" on activities for update
  using (public.is_member_of(company_id));
create policy "activities_delete" on activities for delete
  using (public.is_member_of(company_id));

-- 10. COMPANY_CONFIG (policies existentes con nombres literales)

drop policy if exists "Config visible para miembros" on company_config;
create policy "cc_select" on company_config for select
  using (public.is_member_of(company_id));

drop policy if exists "Admins insertan config" on company_config;
create policy "cc_insert" on company_config for insert
  with check (public.is_admin_of(company_id));

drop policy if exists "Admins actualizan config" on company_config;
create policy "cc_update" on company_config for update
  using (public.is_admin_of(company_id));
