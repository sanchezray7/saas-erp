import { PERMISSIONS } from '../auth/permissions'

export const NAV_SECTION_FINANZAS = {
  sectionKey: 'finanzas',
  labelKey: 'nav.sectionFinanzas',
  icon: '💰',
  items: [
    // AR
    { to: '/cuentas-cobrar', labelKey: 'nav.cuentasCobrar', icon: '💰', permission: PERMISSIONS.DEAL_VER },
    { to: '/alertas-ar', labelKey: 'nav.alertasAR', icon: '🚨', permission: PERMISSIONS.DEAL_VER },
    { to: '/notas-cd', labelKey: 'nav.notasCD', icon: '📝', permission: PERMISSIONS.DEAL_VER },
    // AP
    { to: '/calendario-pagos', labelKey: 'nav.calendarioPagos', icon: '📅', permission: PERMISSIONS.DEAL_VER },
    { to: '/cuentas-pagar', labelKey: 'nav.cuentasPagar', icon: '💰', permission: PERMISSIONS.DEAL_VER },
    // Accounting
    { to: '/impuestos', labelKey: 'nav.impuestos', icon: '🧾', permission: PERMISSIONS.CONFIG_VER },
    { to: '/plan-contable', labelKey: 'nav.planContable', icon: '📒', permission: PERMISSIONS.CONFIG_VER },
    { to: '/asientos', labelKey: 'nav.asientos', icon: '📒', permission: PERMISSIONS.CONFIG_VER },
    { to: '/reportes-contables', labelKey: 'nav.reportesContables', icon: '📊', permission: PERMISSIONS.DEAL_VER },
    { to: '/aging', labelKey: 'nav.aging', icon: '📊', permission: PERMISSIONS.DEAL_VER },
    { to: '/conciliacion', labelKey: 'nav.conciliacion', icon: '🏦', permission: PERMISSIONS.DEAL_VER },
  ],
}
