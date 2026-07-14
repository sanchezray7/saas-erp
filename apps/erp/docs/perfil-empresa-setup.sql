-- Perfil de empresa para CRM LATAM
-- Agrega campos de contacto/dirección a la tabla companies
-- Ejecutar después de crm-setup.sql y localizacion-setup.sql

alter table companies add column if not exists direccion text;
alter table companies add column if not exists telefono text;
alter table companies add column if not exists email_empresa text;
alter table companies add column if not exists logo_url text;

-- Facturación electrónica (e-kuatia/SIFEN)
alter table companies add column if not exists ruc_factura text;
alter table companies add column if not exists dv_factura text;
alter table companies add column if not exists timbrado text;
alter table companies add column if not exists establecimiento text;
alter table companies add column if not exists punto_expedicion text;
alter table companies add column if not exists csc text;
alter table companies add column if not exists id_csc text;
alter table companies add column if not exists actividad_economica text;
alter table companies add column if not exists des_actividad_economica text;
