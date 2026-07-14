import { PERMISSIONS } from '../auth/permissions'

export const NAV_SECTION_CONSOLIDACION = {
  sectionKey: 'consolidacion',
  labelKey: 'nav.sectionConsolidacion',
  icon: '🏢',
  items: [
    { to: '/consolidacion', labelKey: 'nav.consolidacion', icon: '📊', permission: PERMISSIONS.CONFIG_VER },
  ],
}
