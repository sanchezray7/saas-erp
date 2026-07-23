-- ============================================================
-- Módulo de Producción (Manufactura)
-- Soporta producción por procesos (recetas/ingredientes)
-- ============================================================

-- Extender catalogo_productos.tipo para incluir tipos de producción
-- Primero dropear la constraint existente y recrearla con los nuevos valores
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'catalogo_productos' AND column_name = 'tipo'
  ) THEN
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
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  nombre text NOT NULL,
  producto_final_id uuid NOT NULL REFERENCES catalogo_productos(id),
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
  producto_id uuid NOT NULL REFERENCES catalogo_productos(id),
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
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Consumos reales de una orden de producción
-- ============================================================
CREATE TABLE IF NOT EXISTS orden_consumos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id uuid NOT NULL REFERENCES ordenes_produccion(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES catalogo_productos(id),
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
  producto_id uuid NOT NULL REFERENCES catalogo_productos(id),
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

-- RLS
ALTER TABLE recetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE receta_ingredientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenes_produccion ENABLE ROW LEVEL SECURITY;
ALTER TABLE orden_consumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE orden_obtenciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados pueden ver recetas de su empresa"
  ON recetas FOR ALL USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Usuarios autenticados pueden ver ingredientes de su empresa"
  ON receta_ingredientes FOR ALL USING (
    receta_id IN (SELECT id FROM recetas WHERE company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()))
  );

CREATE POLICY "Usuarios autenticados pueden ver órdenes de su empresa"
  ON ordenes_produccion FOR ALL USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Usuarios autenticados pueden ver consumos de su empresa"
  ON orden_consumos FOR ALL USING (
    orden_id IN (SELECT id FROM ordenes_produccion WHERE company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()))
  );

CREATE POLICY "Usuarios autenticados pueden ver obtenciones de su empresa"
  ON orden_obtenciones FOR ALL USING (
    orden_id IN (SELECT id FROM ordenes_produccion WHERE company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()))
  );
