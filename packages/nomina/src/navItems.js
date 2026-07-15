import { PERMISSIONS } from '@saas/core'

export const NAV_SECTION_NOMINA = {
  sectionKey: 'nomina',
  labelKey: 'nav.sectionNomina',
  icon: '💰',
  items: [
    { to: '/nomina', labelKey: 'nav.nominaDashboard', icon: '📊', permission: PERMISSIONS.NOMINA_VER, end: true, feature: 'nomina' },
    { to: '/nomina/periodos', labelKey: 'nav.nominaPeriodos', icon: '📋', permission: PERMISSIONS.NOMINA_VER, feature: 'nomina' },
    { to: '/nomina/libro-sueldos', labelKey: 'nav.libroSueldos', icon: '📖', permission: PERMISSIONS.NOMINA_VER, feature: 'nomina' },
    { to: '/nomina/configuracion', labelKey: 'nav.nominaConfig', icon: '⚙️', permission: PERMISSIONS.NOMINA_CONFIG, feature: 'nomina' },
  ],
}
