import { PERMISSIONS } from '@saas/core'

export const NAV_SECTION_SRM = {
  sectionKey: 'SRM',
  labelKey: 'nav.sectionCompras',
  icon: '📦',
  items: [
    { to: '/proveedores', labelKey: 'nav.proveedores', icon: '🏭', permission: PERMISSIONS.CONTACT_VER, feature: 'srm' },
    { to: '/ordenes-compra', labelKey: 'nav.ordenesCompra', icon: '📋', permission: PERMISSIONS.DEAL_VER, feature: 'srm' },
    { to: '/facturas-proveedor', labelKey: 'nav.facturasProveedor', icon: '🧾', permission: PERMISSIONS.DEAL_VER, feature: 'srm' },
    { to: '/scorecards', labelKey: 'nav.scorecards', icon: '📊', permission: PERMISSIONS.DEAL_VER, feature: 'srm' },
    { to: '/alertas-vencimiento', labelKey: 'nav.alertasVencimiento', icon: '🚨', permission: PERMISSIONS.DEAL_VER, feature: 'srm' },
    { to: '/historial-precios', labelKey: 'nav.historialPrecios', icon: '📈', permission: PERMISSIONS.DEAL_VER, feature: 'srm' },
    { to: '/sugerencias-oc', labelKey: 'nav.sugerenciasOC', icon: '🤖', permission: PERMISSIONS.DEAL_VER, feature: 'srm' },
    { to: '/ordenes-compra/inteligente', labelKey: 'nav.compraInteligente', icon: '🧠', permission: PERMISSIONS.DEAL_VER, feature: 'srm' },
    { to: '/calendario-pagos', labelKey: 'nav.calendarioPagos', icon: '📅', permission: PERMISSIONS.DEAL_VER, feature: 'srm' },
    { to: '/cuentas-pagar', labelKey: 'nav.cuentasPagar', icon: '💰', permission: PERMISSIONS.DEAL_VER, feature: 'srm' },
  ],
}
