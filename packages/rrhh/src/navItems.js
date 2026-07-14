import { PERMISSIONS } from '@saas/core'

export const NAV_SECTION_RRHH = {
  sectionKey: 'rrhh',
  labelKey: 'nav.sectionRRHH',
  icon: '👥',
  items: [
    { to: '/empleados', labelKey: 'nav.empleados', icon: '👤', permission: PERMISSIONS.CONTACT_VER },
    { to: '/organigrama', labelKey: 'nav.organigrama', icon: '🏢', permission: PERMISSIONS.CONTACT_VER },
    { to: '/asistencia', labelKey: 'nav.asistencia', icon: '📅', permission: PERMISSIONS.CONTACT_VER },
    { to: '/asistencia/importar', labelKey: 'nav.importarAsistencia', icon: '📥', permission: PERMISSIONS.CONTACT_VER },
    { to: '/reporte-asistencia', labelKey: 'nav.reporteAsistencia', icon: '📊', permission: PERMISSIONS.CONTACT_VER },
    { to: '/turnos', labelKey: 'nav.turnos', icon: '⚙️', permission: PERMISSIONS.CONFIG_VER },
    { to: '/patrones', labelKey: 'nav.patrones', icon: '🔄', permission: PERMISSIONS.CONFIG_VER },
    { to: '/planificar-turnos', labelKey: 'nav.planificarTurnos', icon: '📅', permission: PERMISSIONS.CONTACT_VER },
    { to: '/control-horario', labelKey: 'nav.controlHorario', icon: '📊', permission: PERMISSIONS.CONTACT_VER },
    { to: '/ausencias', labelKey: 'nav.ausencias', icon: '🏖', permission: PERMISSIONS.CONTACT_VER },
    { to: '/vacaciones', labelKey: 'nav.vacaciones', icon: '🏖', permission: PERMISSIONS.CONTACT_VER },
  ],
}
