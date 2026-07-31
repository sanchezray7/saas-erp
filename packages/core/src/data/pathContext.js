// Mapa de rutas → feature key (para gates de plan y contexto del asistente)
export const PATH_FEATURES = [
  { prefix: '/proveedores', key: 'srm' },
  { prefix: '/ordenes-compra', key: 'srm' },
  { prefix: '/calendario-pagos', key: 'srm' },
  { prefix: '/facturas-proveedor', key: 'srm' },
  { prefix: '/scorecards', key: 'srm' },
  { prefix: '/alertas-vencimiento', key: 'srm' },
  { prefix: '/historial-precios', key: 'srm' },
  { prefix: '/sugerencias-oc', key: 'srm' },
  { prefix: '/cuentas-pagar', key: 'srm' },
  { prefix: '/impuestos', key: 'contabilidad' },
  { prefix: '/plan-contable', key: 'contabilidad' },
  { prefix: '/asientos', key: 'contabilidad' },
  { prefix: '/reportes-contables', key: 'contabilidad_avanzada' },
  { prefix: '/aging', key: 'contabilidad_avanzada' },
  { prefix: '/conciliacion', key: 'contabilidad_avanzada' },
  { prefix: '/consolidacion', key: 'contabilidad_avanzada' },
  { prefix: '/inventario', key: 'inventario' },
  { prefix: '/movimientos-stock', key: 'inventario' },
  { prefix: '/centros', key: 'inventario' },
  { prefix: '/almacenes', key: 'inventario' },
  { prefix: '/transferencias', key: 'inventario' },
  { prefix: '/kardex', key: 'inventario' },
  { prefix: '/conteos', key: 'inventario' },
  { prefix: '/ubicaciones', key: 'inventario' },
  { prefix: '/transportistas', key: 'inventario' },
  { prefix: '/picking', key: 'inventario' },
  { prefix: '/remitos', key: 'inventario' },
  { prefix: '/valuacion', key: 'inventario' },
  { prefix: '/notas-cd', key: 'notas_cd' },
  { prefix: '/empleados', key: 'rrhh' },
  { prefix: '/organigrama', key: 'rrhh' },
  { prefix: '/asistencia', key: 'rrhh' },
  { prefix: '/ausencias', key: 'rrhh' },
  { prefix: '/vacaciones', key: 'rrhh' },
  { prefix: '/reporte-asistencia', key: 'rrhh' },
  { prefix: '/turnos', key: 'rrhh' },
  { prefix: '/patrones', key: 'rrhh' },
  { prefix: '/planificar-turnos', key: 'rrhh' },
  { prefix: '/control-horario', key: 'rrhh' },
  { prefix: '/nomina', key: 'nomina' },
  { prefix: '/reports', key: 'reportes' },
  { prefix: '/pos', key: 'pos' },
  { prefix: '/produccion', key: 'produccion' },
  { prefix: '/recetas', key: 'produccion' },
  { prefix: '/ordenes-produccion', key: 'produccion' },
  { prefix: '/presupuestos', key: 'servicios' },
  { prefix: '/ordenes-trabajo', key: 'servicios' },
]

// Nombre legible del módulo por feature key (para el asistente)
export const FEATURE_MODULE_NAMES = {
  srm: 'Compras',
  inventario: 'Inventario',
  contabilidad: 'Contabilidad',
  contabilidad_avanzada: 'Contabilidad avanzada',
  notas_cd: 'Notas de crédito/débito',
  rrhh: 'RRHH',
  nomina: 'Nómina',
  reportes: 'Reportes',
  pos: 'Punto de venta',
  produccion: 'Producción',
  servicios: 'Servicios',
}

// Nombre legible de rutas sin feature asociada
const PLAIN_ROUTES = [
  { prefix: '/dashboard', nombre: 'Dashboard' },
  { prefix: '/contacts', nombre: 'Contactos' },
  { prefix: '/leads', nombre: 'Leads' },
  { prefix: '/deals', nombre: 'Oportunidades' },
  { prefix: '/cotizaciones', nombre: 'Cotizaciones' },
  { prefix: '/cuentas-cobrar', nombre: 'Cuentas por cobrar' },
  { prefix: '/catalogo', nombre: 'Catálogo' },
  { prefix: '/facturas', nombre: 'Facturación' },
  { prefix: '/activities', nombre: 'Actividades' },
  { prefix: '/calendar', nombre: 'Calendario' },
  { prefix: '/settings', nombre: 'Configuración' },
  { prefix: '/ayuda', nombre: 'Ayuda' },
  { prefix: '/organizations', nombre: 'Empresas' },
]

// Resuelve el contexto (feature key + nombre de módulo) para una ruta dada
export function getPathContext(pathname = '') {
  const match = PATH_FEATURES.find(({ prefix }) =>
    pathname === prefix || pathname.startsWith(prefix + '/')
  )
  if (match) {
    return { featureKey: match.key, modulo: FEATURE_MODULE_NAMES[match.key] || match.key }
  }
  const plain = PLAIN_ROUTES.find(({ prefix }) =>
    pathname === prefix || pathname.startsWith(prefix + '/')
  )
  return { featureKey: null, modulo: plain?.nombre || '' }
}
