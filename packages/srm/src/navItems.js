import { PERMISSIONS } from '@saas/core'

export const NAV_SECTION_SRM = {
  sectionKey: 'SRM',
  labelKey: 'nav.sectionCompras',
  icon: '📦',
  items: [
    { to: '/proveedores', labelKey: 'nav.proveedores', icon: '🏭', permission: PERMISSIONS.CONTACT_VER },
    { to: '/ordenes-compra', labelKey: 'nav.ordenesCompra', icon: '📋', permission: PERMISSIONS.DEAL_VER },
    { to: '/facturas-proveedor', labelKey: 'nav.facturasProveedor', icon: '🧾', permission: PERMISSIONS.DEAL_VER },
    { to: '/scorecards', labelKey: 'nav.scorecards', icon: '📊', permission: PERMISSIONS.DEAL_VER },
    { to: '/alertas-vencimiento', labelKey: 'nav.alertasVencimiento', icon: '🚨', permission: PERMISSIONS.DEAL_VER },
    { to: '/historial-precios', labelKey: 'nav.historialPrecios', icon: '📈', permission: PERMISSIONS.DEAL_VER },
    { to: '/sugerencias-oc', labelKey: 'nav.sugerenciasOC', icon: '🤖', permission: PERMISSIONS.DEAL_VER },
  ],
}
