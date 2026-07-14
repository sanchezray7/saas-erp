import { PERMISSIONS } from '@saas/core'

export const NAV_SECTION_CRM = {
  sectionKey: 'CRM',
  labelKey: 'nav.sectionVentas',
  icon: '👥',
  items: [
    { to: '/organizations', labelKey: 'nav.organizations', icon: '🏢', permission: PERMISSIONS.ORGANIZATION_VER },
    { to: '/contacts', labelKey: 'nav.contacts', icon: '👤', permission: PERMISSIONS.CONTACT_VER },
    { to: '/leads', labelKey: 'nav.leads', icon: '📩', permission: PERMISSIONS.CONTACT_VER },
    { to: '/deals', labelKey: 'nav.deals', icon: '💼', permission: PERMISSIONS.DEAL_VER },
    { to: '/calendar', labelKey: 'nav.calendar', icon: '📅', permission: PERMISSIONS.EVENTO_VER },
    { to: '/activities', labelKey: 'nav.activities', icon: '📋', permission: PERMISSIONS.ACTIVITY_VER },
    { to: '/reports', labelKey: 'nav.reports', icon: '📊', permission: PERMISSIONS.REPORTE_VER },
    { to: '/cotizaciones', labelKey: 'nav.cotizaciones', icon: '📄', permission: PERMISSIONS.DEAL_VER },
  ],
}
