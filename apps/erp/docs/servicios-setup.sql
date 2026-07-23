-- ============================================================
-- Módulo de Servicios (Presupuestos + Órdenes de Trabajo)
-- ============================================================

CREATE TABLE IF NOT EXISTS presupuestos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  numero serial,
  cliente_id uuid,
  contacto text,
  direccion text,
  fecha_emision date NOT NULL DEFAULT CURRENT_DATE,
  fecha_validez date,
  estado text NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador', 'enviado', 'aprobado', 'rechazado')),
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  impuestos numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  notas text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS presupuesto_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presupuesto_id uuid NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
  producto_id uuid,
  descripcion text NOT NULL,
  cantidad numeric(12,2) NOT NULL DEFAULT 1,
  precio_unitario numeric(12,2) NOT NULL DEFAULT 0,
  tipo text NOT NULL DEFAULT 'servicio' CHECK (tipo IN ('servicio', 'repuesto', 'producto')),
  orden integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ordenes_trabajo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  numero serial,
  presupuesto_id uuid REFERENCES presupuestos(id),
  cliente_id uuid,
  contacto text,
  direccion text,
  tecnico_id uuid,
  titulo text NOT NULL,
  descripcion text,
  estado text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'en_progreso', 'completada', 'cancelada')),
  prioridad text NOT NULL DEFAULT 'normal'
    CHECK (prioridad IN ('baja', 'normal', 'alta', 'urgente')),
  fecha_estimada date,
  fecha_inicio timestamptz,
  fecha_fin timestamptz,
  horas_estimadas numeric(6,2),
  costo_estimado numeric(12,2) DEFAULT 0,
  costo_real numeric(12,2) DEFAULT 0,
  notas_internas text,
  notas_cliente text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ot_materiales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id uuid NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  producto_id uuid,
  descripcion text NOT NULL,
  cantidad numeric(12,2) NOT NULL DEFAULT 1,
  precio_unitario numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ot_tiempos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id uuid NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  user_id uuid,
  horas numeric(6,2) NOT NULL,
  descripcion text,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_presupuestos_company ON presupuestos(company_id);
CREATE INDEX IF NOT EXISTS idx_presupuesto_items_presupuesto ON presupuesto_items(presupuesto_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_company ON ordenes_trabajo(company_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_estado ON ordenes_trabajo(estado);
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_tecnico ON ordenes_trabajo(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_ot_materiales_orden ON ot_materiales(orden_id);
CREATE INDEX IF NOT EXISTS idx_ot_tiempos_orden ON ot_tiempos(orden_id);
