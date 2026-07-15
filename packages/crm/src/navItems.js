import { PERMISSIONS } from '@saas/core'

export const NAV_SECTION_CRM = {
  sectionKey: 'CRM',
  labelKey: 'nav.sectionVentas',
  icon: '👥',
  items: [
    { to: '/organizations', labelKey: 'nav.organizations', icon: '🏢', permission: PERMISSIONS.ORGANIZATION_VER, feature: 'crm' },
    { to: '/contacts', labelKey: 'nav.contacts', icon: '👤', permission: PERMISSIONS.CONTACT_VER, feature: 'crm' },
    { to: '/leads', labelKey: 'nav.leads', icon: '📩', permission: PERMISSIONS.CONTACT_VER, feature: 'crm' },
    { to: '/deals', labelKey: 'nav.deals', icon: '💼', permission: PERMISSIONS.DEAL_VER, feature: 'crm' },
    { to: '/calendar', labelKey: 'nav.calendar', icon: '📅', permission: PERMISSIONS.EVENTO_VER, feature: 'crm' },
    { to: '/activities', labelKey: 'nav.activities', icon: '📋', permission: PERMISSIONS.ACTIVITY_VER, feature: 'crm' },
    { to: '/reports', labelKey: 'nav.reports', icon: '📊', permission: PERMISSIONS.REPORTE_VER, feature: 'reportes' },
    { to: '/cotizaciones', labelKey: 'nav.cotizaciones', icon: '📄', permission: PERMISSIONS.DEAL_VER, feature: 'crm' },
  ],
}
