import { PERMISSIONS } from '@saas/core'

export const NAV_SECTION_RRHH = {
  sectionKey: 'rrhh',
  labelKey: 'nav.sectionRRHH',
  icon: '👥',
  items: [
    { to: '/empleados', labelKey: 'nav.empleados', icon: '👤', permission: PERMISSIONS.CONTACT_VER, feature: 'rrhh' },
    { to: '/organigrama', labelKey: 'nav.organigrama', icon: '🏢', permission: PERMISSIONS.CONTACT_VER, feature: 'rrhh' },
    { to: '/asistencia', labelKey: 'nav.asistencia', icon: '📅', permission: PERMISSIONS.CONTACT_VER, feature: 'rrhh' },
    { to: '/asistencia/importar', labelKey: 'nav.importarAsistencia', icon: '📥', permission: PERMISSIONS.CONTACT_VER, feature: 'rrhh' },
    { to: '/reporte-asistencia', labelKey: 'nav.reporteAsistencia', icon: '📊', permission: PERMISSIONS.CONTACT_VER, feature: 'rrhh' },
    { to: '/turnos', labelKey: 'nav.turnos', icon: '⚙️', permission: PERMISSIONS.CONFIG_VER, feature: 'rrhh' },
    { to: '/patrones', labelKey: 'nav.patrones', icon: '🔄', permission: PERMISSIONS.CONFIG_VER, feature: 'rrhh' },
    { to: '/planificar-turnos', labelKey: 'nav.planificarTurnos', icon: '📅', permission: PERMISSIONS.CONTACT_VER, feature: 'rrhh' },
    { to: '/control-horario', labelKey: 'nav.controlHorario', icon: '📊', permission: PERMISSIONS.CONTACT_VER, feature: 'rrhh' },
    { to: '/ausencias', labelKey: 'nav.ausencias', icon: '🏖', permission: PERMISSIONS.CONTACT_VER, feature: 'rrhh' },
    { to: '/vacaciones', labelKey: 'nav.vacaciones', icon: '🏖', permission: PERMISSIONS.CONTACT_VER, feature: 'rrhh' },
  ],
}
