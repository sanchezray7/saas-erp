-- Dashboard KPI: columna closed_at para deals ganados
alter table deals add column if not exists closed_at timestamptz;

-- Índice opcional para consultas de rango de fechas
create index if not exists idx_deals_closed_at on deals(company_id, closed_at);
create index if not exists idx_deals_expected_close on deals(company_id, expected_close_date);
