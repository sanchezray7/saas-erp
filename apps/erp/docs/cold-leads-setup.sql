-- Cold Lead Alerts: columna last_activity_at + trigger
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar columna a contacts y deals
alter table contacts add column if not exists last_activity_at timestamptz;
alter table deals add column if not exists last_activity_at timestamptz;

-- 2. Función trigger: actualiza last_activity_at en contact y deal vinculados
create or replace function update_last_activity_at()
returns trigger
language plpgsql
security definer
as $$
begin
  if NEW.contact_id is not null then
    update contacts set last_activity_at = NEW.created_at
    where id = NEW.contact_id and (last_activity_at is null or last_activity_at < NEW.created_at);
  end if;
  if NEW.deal_id is not null then
    update deals set last_activity_at = NEW.created_at
    where id = NEW.deal_id and (last_activity_at is null or last_activity_at < NEW.created_at);
  end if;
  return NEW;
end;
$$;

-- 3. Trigger sobre activities
drop trigger if exists trg_activities_last_activity on activities;
create trigger trg_activities_last_activity
  after insert on activities
  for each row
  execute function update_last_activity_at();

-- 4. Backfill: poblar last_activity_at con datos existentes
update contacts c
set last_activity_at = (
  select max(a.created_at) from activities a
  where a.contact_id = c.id and a.company_id = c.company_id
)
where exists (select 1 from activities a where a.contact_id = c.id);

update deals d
set last_activity_at = (
  select max(a.created_at) from activities a
  where a.deal_id = d.id and a.company_id = d.company_id
)
where exists (select 1 from activities a where a.deal_id = d.id);
