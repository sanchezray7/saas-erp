import { PERMISSIONS } from '../auth/permissions'

export const NAV_TOPS = [
  { to: '/dashboard', labelKey: 'nav.dashboard', icon: '🏠', permission: null, end: true },
]

export const NAV_SECTIONS_BASE = [
  {
    sectionKey: 'inventario',
    labelKey: 'nav.sectionInventario',
    icon: '📦',
    items: [
      { to: '/catalogo', labelKey: 'nav.catalogo', icon: '📦', permission: PERMISSIONS.DEAL_VER, feature: 'catalogo' },
      { to: '/inventario', labelKey: 'nav.inventario', icon: '📦', permission: PERMISSIONS.DEAL_VER, feature: 'inventario' },
      { to: '/transferencias', labelKey: 'nav.transferencias', icon: '🔄', permission: PERMISSIONS.DEAL_VER, feature: 'inventario' },
      { to: '/kardex', labelKey: 'nav.kardex', icon: '📋', permission: PERMISSIONS.DEAL_VER, feature: 'inventario' },
      { to: '/conteos', labelKey: 'nav.conteos', icon: '📋', permission: PERMISSIONS.DEAL_VER, feature: 'inventario' },
      { to: '/ubicaciones', labelKey: 'nav.ubicaciones', icon: '📍', permission: PERMISSIONS.CONFIG_VER, feature: 'inventario' },
      { to: '/picking', labelKey: 'nav.picking', icon: '📋', permission: PERMISSIONS.DEAL_VER, feature: 'inventario' },
      { to: '/remitos', labelKey: 'nav.remitos', icon: '📄', permission: PERMISSIONS.DEAL_VER, feature: 'inventario' },
      { to: '/transportistas', labelKey: 'nav.transportistas', icon: '🚚', permission: PERMISSIONS.CONFIG_VER, feature: 'inventario' },
      { to: '/movimientos-stock', labelKey: 'nav.movimientosStock', icon: '📋', permission: PERMISSIONS.DEAL_VER, feature: 'inventario' },
      { to: '/centros', labelKey: 'nav.centros', icon: '🏢', permission: PERMISSIONS.CONFIG_VER, feature: 'inventario' },
      { to: '/valuacion', labelKey: 'nav.valuacion', icon: '💰', permission: PERMISSIONS.DEAL_VER, feature: 'inventario' },
    ],
  },
  {
    sectionKey: 'admin',
    icon: '⚙️',
    items: [
      { to: '/settings', labelKey: 'nav.settings', icon: '⚙️', permission: PERMISSIONS.CONFIG_VER },
    ],
  },
]
