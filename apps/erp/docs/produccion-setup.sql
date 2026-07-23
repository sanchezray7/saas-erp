-- ============================================================
-- Módulo de Producción (Manufactura)
-- Soporta producción por procesos (recetas/ingredientes)
-- ============================================================

-- Extender catalogo_productos.tipo si la tabla existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'catalogo_productos') THEN
    ALTER TABLE catalogo_productos
      DROP CONSTRAINT IF EXISTS catalogo_productos_tipo_check;
    ALTER TABLE catalogo_productos
      ADD CONSTRAINT catalogo_productos_tipo_check
        CHECK (tipo IN ('producto', 'servicio', 'materia_prima', 'manufacturado', 'subproducto', 'insumo'));
  END IF;
END $$;

-- ============================================================
-- Recetas (fórmulas de producción)
-- ============================================================
CREATE TABLE IF NOT EXISTS recetas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  codigo text NOT NULL,
  nombre text NOT NULL,
  producto_final_id uuid,
  cantidad_producida numeric(12,2) NOT NULL DEFAULT 1,
  unidad_medida text NOT NULL DEFAULT 'UNI',
  instrucciones text,
  version integer NOT NULL DEFAULT 1,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, codigo)
);

-- ============================================================
-- Ingredientes de recetas (entradas y salidas)
-- es_subproducto: false = ingrediente que se consume, true = producto/salida
-- ============================================================
CREATE TABLE IF NOT EXISTS receta_ingredientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receta_id uuid NOT NULL REFERENCES recetas(id) ON DELETE CASCADE,
  producto_id uuid,
  cantidad numeric(12,2) NOT NULL,
  unidad_medida text NOT NULL DEFAULT 'UNI',
  es_subproducto boolean NOT NULL DEFAULT false,
  merma_porcentaje numeric(5,2) NOT NULL DEFAULT 0,
  orden integer NOT NULL DEFAULT 0
);

-- ============================================================
-- Órdenes de producción
-- ============================================================
CREATE TABLE IF NOT EXISTS ordenes_produccion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  numero serial,
  receta_id uuid NOT NULL REFERENCES recetas(id),
  lote text,
  cantidad_planeada numeric(12,2) NOT NULL,
  cantidad_producida numeric(12,2) DEFAULT 0,
  estado text NOT NULL DEFAULT 'programada'
    CHECK (estado IN ('programada', 'en_proceso', 'completada', 'cancelada')),
  fecha_inicio_planeada date,
  fecha_inicio_real timestamptz,
  fecha_fin timestamptz,
  notas text,
  costo_total numeric(12,2) DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Consumos reales de una orden de producción
-- ============================================================
CREATE TABLE IF NOT EXISTS orden_consumos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id uuid NOT NULL REFERENCES ordenes_produccion(id) ON DELETE CASCADE,
  producto_id uuid,
  cantidad numeric(12,2) NOT NULL,
  lote text,
  costo_unitario numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Productos obtenidos de una orden de producción
-- ============================================================
CREATE TABLE IF NOT EXISTS orden_obtenciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id uuid NOT NULL REFERENCES ordenes_produccion(id) ON DELETE CASCADE,
  producto_id uuid,
  cantidad numeric(12,2) NOT NULL,
  lote text,
  costo_unitario numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_recetas_company ON recetas(company_id);
CREATE INDEX IF NOT EXISTS idx_receta_ingredientes_receta ON receta_ingredientes(receta_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_produccion_company ON ordenes_produccion(company_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_produccion_estado ON ordenes_produccion(estado);
CREATE INDEX IF NOT EXISTS idx_orden_consumos_orden ON orden_consumos(orden_id);
CREATE INDEX IF NOT EXISTS idx_orden_obtenciones_orden ON orden_obtenciones(orden_id);

-- FKs condicionales si las tablas referenciadas existen
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'companies') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'recetas_company_id_fkey') THEN
      ALTER TABLE recetas ADD CONSTRAINT recetas_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ordenes_produccion_company_id_fkey') THEN
      ALTER TABLE ordenes_produccion ADD CONSTRAINT ordenes_produccion_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'catalogo_productos') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'recetas_producto_final_id_fkey') THEN
      ALTER TABLE recetas ADD CONSTRAINT recetas_producto_final_id_fkey FOREIGN KEY (producto_final_id) REFERENCES catalogo_productos(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'receta_ingredientes_producto_id_fkey') THEN
      ALTER TABLE receta_ingredientes ADD CONSTRAINT receta_ingredientes_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES catalogo_productos(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'orden_consumos_producto_id_fkey') THEN
      ALTER TABLE orden_consumos ADD CONSTRAINT orden_consumos_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES catalogo_productos(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'orden_obtenciones_producto_id_fkey') THEN
      ALTER TABLE orden_obtenciones ADD CONSTRAINT orden_obtenciones_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES catalogo_productos(id);
    END IF;
  END IF;
END $$;

-- RLS (solo si company_members existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'company_members') THEN
    ALTER TABLE recetas ENABLE ROW LEVEL SECURITY;
    ALTER TABLE receta_ingredientes ENABLE ROW LEVEL SECURITY;
    ALTER TABLE ordenes_produccion ENABLE ROW LEVEL SECURITY;
    ALTER TABLE orden_consumos ENABLE ROW LEVEL SECURITY;
    ALTER TABLE orden_obtenciones ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "recetas_acceso" ON recetas;
    CREATE POLICY "recetas_acceso" ON recetas FOR ALL USING (
      auth.uid() IN (SELECT user_id FROM company_members WHERE company_id = recetas.company_id)
    );

    DROP POLICY IF EXISTS "receta_ingredientes_acceso" ON receta_ingredientes;
    CREATE POLICY "receta_ingredientes_acceso" ON receta_ingredientes FOR ALL USING (
      auth.uid() IN (SELECT user_id FROM company_members
        WHERE company_id = (SELECT company_id FROM recetas WHERE id = receta_ingredientes.receta_id))
    );

    DROP POLICY IF EXISTS "ordenes_produccion_acceso" ON ordenes_produccion;
    CREATE POLICY "ordenes_produccion_acceso" ON ordenes_produccion FOR ALL USING (
      auth.uid() IN (SELECT user_id FROM company_members WHERE company_id = ordenes_produccion.company_id)
    );

    DROP POLICY IF EXISTS "orden_consumos_acceso" ON orden_consumos;
    CREATE POLICY "orden_consumos_acceso" ON orden_consumos FOR ALL USING (
      auth.uid() IN (SELECT user_id FROM company_members
        WHERE company_id = (SELECT company_id FROM ordenes_produccion WHERE id = orden_consumos.orden_id))
    );

    DROP POLICY IF EXISTS "orden_obtenciones_acceso" ON orden_obtenciones;
    CREATE POLICY "orden_obtenciones_acceso" ON orden_obtenciones FOR ALL USING (
      auth.uid() IN (SELECT user_id FROM company_members
        WHERE company_id = (SELECT company_id FROM ordenes_produccion WHERE id = orden_obtenciones.orden_id))
    );
  END IF;
END $$;
