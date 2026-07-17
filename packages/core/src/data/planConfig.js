// ============================================================
// Configuración de planes y límites
// Editá este archivo para cambiar features, cuotas y precios
// ============================================================

// Características por plan
// `enabled: true` → disponible · `enabled: false` → bloqueado
// `plan: null` → disponible en el plan actual · `plan: 'starter'` → requiere upgrade
export const FEATURES = {
  catalogo: { free: true, starter: true, business: true },
  crm: { free: true, starter: true, business: true },
  facturacion: { free: true, starter: true, business: true },
  notas_cd: { free: false, starter: true, business: true },
  srm: { free: false, starter: true, business: true },
  inventario: { free: false, starter: true, business: true },
  contabilidad: { free: false, starter: true, business: true },
  contabilidad_avanzada: { free: false, starter: false, business: true },
  asientos_automaticos_facturas: { free: false, starter: true, business: true },
  asientos_automaticos_nomina: { free: false, starter: false, business: true },
  rrhh: { free: false, starter: false, business: true },
  nomina: { free: false, starter: false, business: true },
  whatsapp: { free: false, starter: false, business: true },
  reportes: { free: false, starter: true, business: false },
  reportes_avanzados: { free: false, starter: false, business: true },
}

// Cuotas máximas por plan
// -1 = ilimitado
export const QUOTAS = {
  free: { usuarios: 2, productos: 25, contactos: 50, oportunidades: 20, facturas_mes: 20 },
  starter: { usuarios: 10, productos: -1, contactos: -1, oportunidades: -1, facturas_mes: -1 },
  business: { usuarios: -1, productos: -1, contactos: -1, oportunidades: -1, facturas_mes: -1 },
}

// Nombres para mostrar de cada cuota (en mensajes de error)
export const QUOTA_LABELS = {
  usuarios: 'usuarios',
  productos: 'productos',
  contactos: 'contactos',
  oportunidades: 'oportunidades',
  facturas_mes: 'facturas este mes',
}

// Nombres y precios de los planes
export const PLAN_LABELS = {
  free: { name: 'Free', price: 'Gratis' },
  starter: { name: 'Starter', price: '$39/mes' },
  business: { name: 'Business', price: '$89/mes' },
}
