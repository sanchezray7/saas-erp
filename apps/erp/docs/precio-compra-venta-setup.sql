-- Migración: precio de compra y venta en catálogo
-- Ejecutar después de catalogo-setup.sql

-- 1. Renombrar precio_unitario a precio_venta
alter table catalogo_productos rename column precio_unitario to precio_venta;

-- 2. Agregar precio_compra
alter table catalogo_productos add column if not exists precio_compra numeric(12,2) not null default 0;

-- 3. Inicializar precio_compra con el mismo valor que precio_venta (para no romper datos existentes)
update catalogo_productos set precio_compra = precio_venta where precio_compra = 0;
