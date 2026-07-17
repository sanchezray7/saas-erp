import { PERMISSIONS } from '../auth/permissions'

export const NAV_SECTION_FINANZAS = {
  sectionKey: 'finanzas',
  labelKey: 'nav.sectionFinanzas',
  icon: '💰',
  items: [
    // AR
    { to: '/cuentas-cobrar', labelKey: 'nav.cuentasCobrar', icon: '💰', permission: PERMISSIONS.DEAL_VER, feature: 'facturacion' },
    { to: '/alertas-ar', labelKey: 'nav.alertasAR', icon: '🚨', permission: PERMISSIONS.DEAL_VER, feature: 'facturacion' },
    { to: '/notas-cd', labelKey: 'nav.notasCD', icon: '📝', permission: PERMISSIONS.DEAL_VER, feature: 'notas_cd' },
    // Accounting
    { to: '/impuestos', labelKey: 'nav.impuestos', icon: '🧾', permission: PERMISSIONS.CONFIG_VER, feature: 'contabilidad' },
    { to: '/plan-contable', labelKey: 'nav.planContable', icon: '📒', permission: PERMISSIONS.CONFIG_VER, feature: 'contabilidad' },
    { to: '/asientos', labelKey: 'nav.asientos', icon: '📒', permission: PERMISSIONS.CONFIG_VER, feature: 'contabilidad' },
    { to: '/reportes-contables', labelKey: 'nav.reportesContables', icon: '📊', permission: PERMISSIONS.DEAL_VER, feature: 'contabilidad_avanzada' },
    { to: '/aging', labelKey: 'nav.aging', icon: '📊', permission: PERMISSIONS.DEAL_VER, feature: 'contabilidad_avanzada' },
    { to: '/conciliacion', labelKey: 'nav.conciliacion', icon: '🏦', permission: PERMISSIONS.DEAL_VER, feature: 'contabilidad_avanzada' },
  ],
}
