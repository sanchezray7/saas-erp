-- Campos fiscales para contactos (facturación electrónica)
-- Ejecutar después de crm-setup.sql

alter table contacts add column if not exists ruc text;
alter table contacts add column if not exists dv text;
alter table contacts add column if not exists tipo_documento int;
alter table contacts add column if not exists num_documento text;
alter table contacts add column if not exists pais text default 'PRY';
alter table contacts add column if not exists direccion text;
alter table contacts add column if not exists codigo_cliente text;
