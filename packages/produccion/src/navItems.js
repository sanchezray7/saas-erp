import { PERMISSIONS } from '@saas/core'

export const NAV_SECTION_PRODUCCION = {
  sectionKey: 'produccion',
  labelKey: 'nav.sectionProduccion',
  icon: '🏭',
  items: [
    { to: '/produccion', labelKey: 'nav.dashboardProduccion', icon: '📊', permission: PERMISSIONS.DEAL_VER, feature: 'produccion' },
    { to: '/recetas', labelKey: 'nav.recetas', icon: '📋', permission: PERMISSIONS.CONFIG_VER, feature: 'produccion' },
    { to: '/ordenes-produccion', labelKey: 'nav.ordenesProduccion', icon: '⚙️', permission: PERMISSIONS.DEAL_VER, feature: 'produccion' },
  ],
}
