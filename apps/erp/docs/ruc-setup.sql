-- RUC y dirección para organizations (búsqueda por API pública)
alter table organizations add column if not exists ruc text;
alter table organizations add column if not exists direccion text;

create index if not exists idx_organizations_ruc on organizations(company_id, ruc);
