-- Daily Agenda: columna assigned_to para activities
alter table activities add column if not exists assigned_to uuid references auth.users(id) on delete set null;

create index if not exists idx_activities_assigned_to on activities(company_id, assigned_to, due_date);
