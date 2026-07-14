-- Notificaciones Push (PWA)
-- Ejecutar después de crm-setup.sql

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription jsonb not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique(user_id)
);

alter table push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_select" on push_subscriptions;
create policy "push_subscriptions_select" on push_subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "push_subscriptions_insert" on push_subscriptions;
create policy "push_subscriptions_insert" on push_subscriptions for insert
  with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions_delete" on push_subscriptions;
create policy "push_subscriptions_delete" on push_subscriptions for delete
  using (auth.uid() = user_id);
