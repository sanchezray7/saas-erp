export const NAV_SECTION_POS = {
  sectionKey: 'pos',
  labelKey: 'nav.sectionPOS',
  icon: '🛒',
  items: [
    { to: '/pos', labelKey: 'nav.posVender', icon: '🛒', permission: null, feature: 'pos' },
    { to: '/pos/cajas', labelKey: 'nav.posCajas', icon: '🏦', permission: null, feature: 'pos' },
    { to: '/pos/cierres', labelKey: 'nav.posCierres', icon: '📊', permission: null, feature: 'pos' },
  ],
}
