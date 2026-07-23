import { PERMISSIONS } from '@saas/core'

export const NAV_SECTION_SERVICIOS = {
  sectionKey: 'servicios',
  labelKey: 'nav.sectionServicios',
  icon: '🔧',
  items: [
    { to: '/presupuestos', labelKey: 'nav.presupuestos', icon: '📋', permission: PERMISSIONS.DEAL_VER },
    { to: '/ordenes-trabajo', labelKey: 'nav.ordenesTrabajo', icon: '⚡', permission: PERMISSIONS.DEAL_VER },
  ],
}
