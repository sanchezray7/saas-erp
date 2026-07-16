// ============================================================
// Configuración de planes (copia espejo de packages/core/src/data/planConfig.js)
// ============================================================

export const FEATURES = {
  catalogo: { free: true, starter: true, business: true },
  crm: { free: true, starter: true, business: true },
  facturacion: { free: true, starter: true, business: true },
  notas_cd: { free: false, starter: true, business: true },
  srm: { free: false, starter: true, business: true },
  inventario: { free: false, starter: true, business: true },
  contabilidad: { free: false, starter: true, business: false },
  contabilidad_avanzada: { free: false, starter: false, business: true },
  asientos_automaticos_facturas: { free: false, starter: true, business: true },
  asientos_automaticos_nomina: { free: false, starter: false, business: true },
  rrhh: { free: false, starter: false, business: true },
  nomina: { free: false, starter: false, business: true },
  whatsapp: { free: false, starter: false, business: true },
  reportes: { free: false, starter: true, business: false },
  reportes_avanzados: { free: false, starter: false, business: true },
}

export const QUOTAS = {
  free: { usuarios: 2, productos: 50, contactos: 100, oportunidades: 50, facturas_mes: 50 },
  starter: { usuarios: 10, productos: -1, contactos: -1, oportunidades: -1, facturas_mes: -1 },
  business: { usuarios: -1, productos: -1, contactos: -1, oportunidades: -1, facturas_mes: -1 },
}

export const PLAN_LABELS = {
  free: { name: 'Free', price: 'Gratis', period: '' },
  starter: { name: 'Starter', price: '$29', period: '/mes' },
  business: { name: 'Business', price: '$79', period: '/mes' },
}

// Features con nombre amigable para la tabla comparativa
export const FEATURE_LABELS = {
  catalogo: 'Catálogo de productos',
  crm: 'CRM (contactos, oportunidades)',
  facturacion: 'Facturación electrónica',
  notas_cd: 'Notas de crédito/débito',
  srm: 'Proveedores y compras',
  inventario: 'Inventario y almacenes',
  contabilidad: 'Contabilidad básica',
  contabilidad_avanzada: 'Contabilidad avanzada',
  asientos_automaticos_facturas: 'Asientos automáticos facturas',
  asientos_automaticos_nomina: 'Asientos automáticos nómina',
  rrhh: 'RRHH completo',
  nomina: 'Nómina y libro sueldos',
  whatsapp: 'WhatsApp integrado',
  reportes: 'Reportes de ventas',
  reportes_avanzados: 'Reportes avanzados',
}

// Quotas con nombre amigable
export const QUOTA_LABELS = {
  usuarios: 'Usuarios',
  productos: 'Productos',
  contactos: 'Contactos',
  oportunidades: 'Oportunidades',
  facturas_mes: 'Facturas/mes',
}

export function qty(value, label) {
  if (value === -1) return 'Ilimitado'
  return `${value} ${label}`
}
