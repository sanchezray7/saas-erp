import { PERMISSIONS } from '@saas/core'

export const NAV_SECTION_PRODUCCION = {
  sectionKey: 'produccion',
  labelKey: 'nav.sectionProduccion',
  icon: '🏭',
  items: [
    { to: '/recetas', labelKey: 'nav.recetas', icon: '📋', permission: PERMISSIONS.CONFIG_VER },
    { to: '/ordenes-produccion', labelKey: 'nav.ordenesProduccion', icon: '⚙️', permission: PERMISSIONS.DEAL_VER },
  ],
}
