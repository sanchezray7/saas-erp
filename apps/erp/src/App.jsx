import { lazy, Suspense, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import {
  ThemeProvider, AuthProvider, ProtectedRoute, RequireCompany,
  RequirePermission, AppLayout, PERMISSIONS, ErrorBoundary, useAuth,
  PushPrompt, InstallPrompt, getSupabase, HelpPage,
  NAV_SECTION_FINANZAS, NAV_SECTION_CONSOLIDACION,
} from '@saas/core'
import { NAV_SECTION_CRM, LoginPage, RegisterPage,
  CompanySelectPage, CreateCompanyPage, ForbiddenPage,
  DashboardPage,   ContactsPage, ContactFormPage, ContactDetailPage,
  LeadsPage,
  CotizacionesPage, CotizacionFormPage, CotizacionDetailPage,
  OrganizationsPage, OrganizationFormPage,
  DealsPage, DealFormPage, DealDetailPage,
  ActivitiesPage, SettingsPage, ReportsPage, CalendarPage,
  NotificationBell, AgendaButton, AgendaModal,
  CotizacionPublicPage,
  LeadFormPage,
  CuentasCobrarPage,
  AlertasARPage,
} from '@saas/crm'
import { CatalogPage } from '@saas/productos'
import { ImpuestosConfigPage, PlanContablePage, AsientosPage, AsientoDetailPage, NuevoAsientoPage, ReportsPage as AccountingReportsPage, AgingPage, ConciliacionPage, ConciliacionNuevaPage, ConciliacionDetailPage, ConsolidacionPage } from '@saas/accounting'
import { CentrosPage, AlmacenesPage, InventarioPage, ValuacionPage, MovimientosPage, TransferenciasPage, KardexPage, ConteosPage, ConteoDetailPage, UbicacionesPage, TransportistasPage, PickingPage, PickingDetailPage, RemitosPage, RemitoDetailPage } from '@saas/inventario'
import { FacturarModal, NotasCDPage, NotaCDFormPage, NotaCDDetailPage } from '@saas/facturacion'
import { NAV_SECTION_SRM } from '@saas/srm'
import { EmpleadosPage, EmpleadoFormPage, EmpleadoDetailPage, OrganigramaPage, AsistenciaPage, AusenciasPage, VacacionesPage, ImportarAsistenciaPage, ReporteAsistenciaPage, TurnosPage, RotacionPatronesPage, PlanificarTurnosPage, ControlHorarioPage, NAV_SECTION_RRHH } from '@saas/rrhh'
import { ConfigNominaPage, PeriodosNominaPage, PeriodoDetailPage, ReciboPage, NovedadesPage, NominaDashboardPage, LibroSueldosPage, NAV_SECTION_NOMINA } from '@saas/nomina'
import { ProveedoresPage, ProveedorFormPage, ProveedorDetailPage, OrdenesCompraPage, OrdenCompraFormPage, OrdenCompraDetailPage, CalendarioPagosPage, FacturasProveedorPage, FacturaProveedorFormPage, FacturaProveedorDetailPage, ScorecardsPage, AlertasVencimientoPage, HistorialPreciosPage, SugerenciasOCPage, CuentasPagarPage } from '@saas/srm'
import { PosPage, CajasPage, CierresPage, NAV_SECTION_POS } from '@saas/pos'

function LS({ children }) {
  return <Suspense fallback={<div className="card"><p className="meta">Loading...</p></div>}>{children}</Suspense>
}

// Key para sessionStorage — se borra al recargar la página (module scope)
// así cada recarga permite probar el auto-show de nuevo
const AGENDA_SEEN_KEY = 'agenda_seen_v5'
sessionStorage.removeItem(AGENDA_SEEN_KEY)
for (const k of ['agenda_seen', 'agenda_seen_v2', 'agenda_seen_v3', 'agenda_seen_v4']) {
  sessionStorage.removeItem(k)
}

function WithAgenda({ children }) {
  const { roles } = useAuth()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (roles.length === 0) return
    const puede = roles.some((r) => r === 'vendedor')
    if (puede && !sessionStorage.getItem(AGENDA_SEEN_KEY)) {
      sessionStorage.setItem(AGENDA_SEEN_KEY, '1')
      setOpen(true)
    }
  }, [roles])

  return (
    <>
      {children}
      {open && <AgendaModal onClose={() => setOpen(false)} />}
    </>
  )
}

function LayoutWithSections() {
  const { companies, activeCompanyId } = useAuth()
  const [esMatriz, setEsMatriz] = useState(false)

  useEffect(() => {
    if (!activeCompanyId) { setEsMatriz(false); return }
    getSupabase().from('companies').select('parent_company_id').eq('id', activeCompanyId).single()
      .then(({ data }) => setEsMatriz(!data?.parent_company_id))
      .catch(() => setEsMatriz(false))
  }, [activeCompanyId])

  const extras = esMatriz
    ? [NAV_SECTION_POS, NAV_SECTION_CRM, NAV_SECTION_SRM, NAV_SECTION_RRHH, NAV_SECTION_NOMINA, NAV_SECTION_FINANZAS, NAV_SECTION_CONSOLIDACION]
    : [NAV_SECTION_POS, NAV_SECTION_CRM, NAV_SECTION_SRM, NAV_SECTION_RRHH, NAV_SECTION_NOMINA, NAV_SECTION_FINANZAS]

  return (
    <WithAgenda>
      <AppLayout extraSections={extras} headerExtra={<><AgendaButton /><NotificationBell /></>} />
    </WithAgenda>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <PushPrompt />
          <InstallPrompt />
          <LS>
            <Routes>
              <Route path="/login" element={<ErrorBoundary><LoginPage /></ErrorBoundary>} />
              <Route path="/register" element={<ErrorBoundary><RegisterPage /></ErrorBoundary>} />

              <Route path="/seleccionar-empresa" element={
                <ErrorBoundary><ProtectedRoute><RequireCompany requireSelection><CompanySelectPage /></RequireCompany></ProtectedRoute></ErrorBoundary>
              } />

              <Route path="/crear-empresa" element={
                <ErrorBoundary><ProtectedRoute><CreateCompanyPage /></ProtectedRoute></ErrorBoundary>
              } />

              <Route path="/403" element={<ErrorBoundary><ForbiddenPage /></ErrorBoundary>} />
              <Route path="/s/cotizacion/:token" element={<ErrorBoundary><CotizacionPublicPage /></ErrorBoundary>} />
              <Route path="/lead/:token" element={<ErrorBoundary><LeadFormPage /></ErrorBoundary>} />

              <Route path="/" element={
                <ErrorBoundary><ProtectedRoute><RequireCompany>
                  <LayoutWithSections />
                </RequireCompany></ProtectedRoute></ErrorBoundary>
              }>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="contacts" element={<RequirePermission perm={PERMISSIONS.CONTACT_VER}><ContactsPage /></RequirePermission>} />
                <Route path="contacts/new" element={<RequirePermission perm={PERMISSIONS.CONTACT_CREAR}><ContactFormPage /></RequirePermission>} />
                <Route path="contacts/:id" element={<RequirePermission perm={PERMISSIONS.CONTACT_VER}><ContactDetailPage /></RequirePermission>} />
                <Route path="contacts/:id/edit" element={<RequirePermission perm={PERMISSIONS.CONTACT_EDITAR}><ContactFormPage /></RequirePermission>} />
                <Route path="leads" element={<RequirePermission perm={PERMISSIONS.CONTACT_VER}><LeadsPage /></RequirePermission>} />
                <Route path="catalogo" element={<RequirePermission perm={PERMISSIONS.DEAL_VER}><CatalogPage /></RequirePermission>} />
                <Route path="proveedores" element={<RequirePermission perm={PERMISSIONS.CONTACT_VER}><ProveedoresPage /></RequirePermission>} />
                <Route path="proveedores/nuevo" element={<RequirePermission perm={PERMISSIONS.CONTACT_CREAR}><ProveedorFormPage /></RequirePermission>} />
                <Route path="proveedores/:id" element={<RequirePermission perm={PERMISSIONS.CONTACT_VER}><ProveedorDetailPage /></RequirePermission>} />
                <Route path="proveedores/:id/editar" element={<RequirePermission perm={PERMISSIONS.CONTACT_EDITAR}><ProveedorFormPage /></RequirePermission>} />
                <Route path="ordenes-compra" element={<RequirePermission perm={PERMISSIONS.DEAL_VER}><OrdenesCompraPage /></RequirePermission>} />
                <Route path="ordenes-compra/nueva" element={<RequirePermission perm={PERMISSIONS.DEAL_CREAR}><OrdenCompraFormPage /></RequirePermission>} />
                <Route path="ordenes-compra/:id" element={<RequirePermission perm={PERMISSIONS.DEAL_VER}><OrdenCompraDetailPage /></RequirePermission>} />
                <Route path="ordenes-compra/:id/editar" element={<RequirePermission perm={PERMISSIONS.DEAL_EDITAR}><OrdenCompraFormPage /></RequirePermission>} />
                <Route path="calendario-pagos" element={<RequirePermission perm={PERMISSIONS.DEAL_VER}><CalendarioPagosPage /></RequirePermission>} />
                <Route path="facturas-proveedor" element={<RequirePermission perm={PERMISSIONS.DEAL_VER}><FacturasProveedorPage /></RequirePermission>} />
                <Route path="facturas-proveedor/nueva" element={<RequirePermission perm={PERMISSIONS.DEAL_CREAR}><FacturaProveedorFormPage /></RequirePermission>} />
                <Route path="facturas-proveedor/:id" element={<RequirePermission perm={PERMISSIONS.DEAL_VER}><FacturaProveedorDetailPage /></RequirePermission>} />
                <Route path="facturas-proveedor/:id/editar" element={<RequirePermission perm={PERMISSIONS.DEAL_EDITAR}><FacturaProveedorFormPage /></RequirePermission>} />
                <Route path="scorecards" element={<RequirePermission perm={PERMISSIONS.DEAL_VER}><ScorecardsPage /></RequirePermission>} />
                <Route path="alertas-vencimiento" element={<RequirePermission perm={PERMISSIONS.DEAL_VER}><AlertasVencimientoPage /></RequirePermission>} />
                <Route path="historial-precios" element={<RequirePermission perm={PERMISSIONS.DEAL_VER}><HistorialPreciosPage /></RequirePermission>} />
                <Route path="sugerencias-oc" element={<RequirePermission perm={PERMISSIONS.DEAL_CREAR}><SugerenciasOCPage /></RequirePermission>} />
                <Route path="cuentas-pagar" element={<RequirePermission perm={PERMISSIONS.DEAL_VER}><CuentasPagarPage /></RequirePermission>} />
                <Route path="impuestos" element={<RequirePermission perm={PERMISSIONS.CONFIG_VER}><ImpuestosConfigPage /></RequirePermission>} />
                <Route path="plan-contable" element={<RequirePermission perm={PERMISSIONS.CONFIG_VER}><PlanContablePage /></RequirePermission>} />
                <Route path="reportes-contables" element={<RequirePermission perm={PERMISSIONS.DEAL_VER}><AccountingReportsPage /></RequirePermission>} />
                <Route path="aging" element={<RequirePermission perm={PERMISSIONS.DEAL_VER}><AgingPage /></RequirePermission>} />
                <Route path="conciliacion" element={<RequirePermission perm={PERMISSIONS.DEAL_VER}><ConciliacionPage /></RequirePermission>} />
                <Route path="conciliacion/nueva" element={<RequirePermission perm={PERMISSIONS.DEAL_CREAR}><ConciliacionNuevaPage /></RequirePermission>} />
                <Route path="conciliacion/:id" element={<RequirePermission perm={PERMISSIONS.DEAL_VER}><ConciliacionDetailPage /></RequirePermission>} />
                <Route path="consolidacion" element={<RequirePermission perm={PERMISSIONS.CONFIG_VER}><ConsolidacionPage /></RequirePermission>} />
                <Route path="inventario" element={<RequirePermission perm={PERMISSIONS.DEAL_VER}><InventarioPage /></RequirePermission>} />
                <Route path="movimientos-stock" element={<RequirePermission perm={PERMISSIONS.DEAL_VER}><MovimientosPage /></RequirePermission>} />
                <Route path="centros" element={<RequirePermission perm={PERMISSIONS.CONFIG_VER}><CentrosPage /></RequirePermission>} />
                <Route path="almacenes" element={<RequirePermission perm={PERMISSIONS.CONFIG_VER}><AlmacenesPage /></RequirePermission>} />
                <Route path="transferencias" element={<RequirePermission perm={PERMISSIONS.DEAL_VER}><TransferenciasPage /></RequirePermission>} />
                <Route path="kardex" element={<RequirePermission perm={PERMISSIONS.DEAL_VER}><KardexPage /></RequirePermission>} />
                <Route path="conteos" element={<RequirePermission perm={PERMISSIONS.DEAL_VER}><ConteosPage /></RequirePermission>} />
                <Route path="conteos/:id" element={<RequirePermission perm={PERMISSIONS.DEAL_VER}><ConteoDetailPage /></RequirePermission>} />
                <Route path="ubicaciones" element={<RequirePermission perm={PERMISSIONS.CONFIG_VER}><UbicacionesPage /></RequirePermission>} />
                <Route path="transportistas" element={<RequirePermission perm={PERMISSIONS.CONFIG_VER}><TransportistasPage /></RequirePermission>} />
                <Route path="picking" element={<RequirePermission perm={PERMISSIONS.DEAL_VER}><PickingPage /></RequirePermission>} />
                <Route path="picking/:id" element={<RequirePermission perm={PERMISSIONS.DEAL_VER}><PickingDetailPage /></RequirePermission>} />
                <Route path="remitos" element={<RequirePermission perm={PERMISSIONS.DEAL_VER}><RemitosPage /></RequirePermission>} />
                <Route path="remitos/:id" element={<RequirePermission perm={PERMISSIONS.DEAL_VER}><RemitoDetailPage /></RequirePermission>} />
                <Route path="valuacion" element={<RequirePermission perm={PERMISSIONS.DEAL_VER}><ValuacionPage /></RequirePermission>} />
                <Route path="asientos" element={<RequirePermission perm={PERMISSIONS.CONFIG_VER}><AsientosPage /></RequirePermission>} />
                <Route path="asientos/nuevo" element={<RequirePermission perm={PERMISSIONS.CONFIG_CREAR}><NuevoAsientoPage /></RequirePermission>} />
                <Route path="asientos/:id" element={<RequirePermission perm={PERMISSIONS.CONFIG_VER}><AsientoDetailPage /></RequirePermission>} />
                <Route path="notas-cd" element={<RequirePermission perm={PERMISSIONS.DEAL_VER}><NotasCDPage /></RequirePermission>} />
                <Route path="notas-cd/nueva" element={<RequirePermission perm={PERMISSIONS.DEAL_CREAR}><NotaCDFormPage /></RequirePermission>} />
                <Route path="notas-cd/:id" element={<RequirePermission perm={PERMISSIONS.DEAL_VER}><NotaCDDetailPage /></RequirePermission>} />
                <Route path="alertas-ar" element={<RequirePermission perm={PERMISSIONS.DEAL_VER}><AlertasARPage /></RequirePermission>} />
                <Route path="organizations" element={<RequirePermission perm={PERMISSIONS.ORGANIZATION_VER}><OrganizationsPage /></RequirePermission>} />
                <Route path="organizations/new" element={<RequirePermission perm={PERMISSIONS.ORGANIZATION_CREAR}><OrganizationFormPage /></RequirePermission>} />
                <Route path="organizations/:id/edit" element={<RequirePermission perm={PERMISSIONS.ORGANIZATION_EDITAR}><OrganizationFormPage /></RequirePermission>} />
                <Route path="deals" element={<RequirePermission perm={PERMISSIONS.DEAL_VER}><DealsPage /></RequirePermission>} />
                <Route path="deals/new" element={<RequirePermission perm={PERMISSIONS.DEAL_CREAR}><DealFormPage /></RequirePermission>} />
                <Route path="deals/:id" element={<RequirePermission perm={PERMISSIONS.DEAL_VER}><DealDetailPage /></RequirePermission>} />
                <Route path="deals/:id/edit" element={<RequirePermission perm={PERMISSIONS.DEAL_EDITAR}><DealFormPage /></RequirePermission>} />
                <Route path="cotizaciones" element={<RequirePermission perm={PERMISSIONS.DEAL_VER}><CotizacionesPage /></RequirePermission>} />
                <Route path="cotizaciones/new" element={<RequirePermission perm={PERMISSIONS.DEAL_CREAR}><CotizacionFormPage /></RequirePermission>} />
                <Route path="cotizaciones/:id" element={<RequirePermission perm={PERMISSIONS.DEAL_VER}><CotizacionDetailPage /></RequirePermission>} />
                <Route path="cotizaciones/:id/edit" element={<RequirePermission perm={PERMISSIONS.DEAL_EDITAR}><CotizacionFormPage /></RequirePermission>} />
                <Route path="cuentas-cobrar" element={<RequirePermission perm={PERMISSIONS.DEAL_VER}><CuentasCobrarPage /></RequirePermission>} />
                <Route path="activities" element={<RequirePermission perm={PERMISSIONS.ACTIVITY_VER}><ActivitiesPage /></RequirePermission>} />
                <Route path="calendar" element={<RequirePermission perm={PERMISSIONS.EVENTO_VER}><CalendarPage /></RequirePermission>} />
                <Route path="reports" element={<RequirePermission perm={PERMISSIONS.REPORTE_VER}><ReportsPage /></RequirePermission>} />
                <Route path="empleados" element={<RequirePermission perm={PERMISSIONS.CONTACT_VER}><EmpleadosPage /></RequirePermission>} />
                <Route path="empleados/nuevo" element={<RequirePermission perm={PERMISSIONS.CONTACT_CREAR}><EmpleadoFormPage /></RequirePermission>} />
                <Route path="empleados/:id" element={<RequirePermission perm={PERMISSIONS.CONTACT_VER}><EmpleadoDetailPage /></RequirePermission>} />
                <Route path="empleados/:id/editar" element={<RequirePermission perm={PERMISSIONS.CONTACT_EDITAR}><EmpleadoFormPage /></RequirePermission>} />
                <Route path="organigrama" element={<RequirePermission perm={PERMISSIONS.CONTACT_VER}><OrganigramaPage /></RequirePermission>} />
                <Route path="asistencia" element={<RequirePermission perm={PERMISSIONS.CONTACT_VER}><AsistenciaPage /></RequirePermission>} />
                <Route path="asistencia/importar" element={<RequirePermission perm={PERMISSIONS.CONTACT_CREAR}><ImportarAsistenciaPage /></RequirePermission>} />
                <Route path="ausencias" element={<RequirePermission perm={PERMISSIONS.CONTACT_VER}><AusenciasPage /></RequirePermission>} />
                <Route path="vacaciones" element={<RequirePermission perm={PERMISSIONS.CONTACT_VER}><VacacionesPage /></RequirePermission>} />
                <Route path="reporte-asistencia" element={<RequirePermission perm={PERMISSIONS.CONTACT_VER}><ReporteAsistenciaPage /></RequirePermission>} />
                <Route path="turnos" element={<RequirePermission perm={PERMISSIONS.CONFIG_VER}><TurnosPage /></RequirePermission>} />
                <Route path="patrones" element={<RequirePermission perm={PERMISSIONS.CONFIG_VER}><RotacionPatronesPage /></RequirePermission>} />
                <Route path="planificar-turnos" element={<RequirePermission perm={PERMISSIONS.CONTACT_VER}><PlanificarTurnosPage /></RequirePermission>} />
                <Route path="control-horario" element={<RequirePermission perm={PERMISSIONS.CONTACT_VER}><ControlHorarioPage /></RequirePermission>} />
                <Route path="nomina" element={<RequirePermission perm={PERMISSIONS.NOMINA_VER}><NominaDashboardPage /></RequirePermission>} />
                <Route path="nomina/periodos" element={<RequirePermission perm={PERMISSIONS.NOMINA_VER}><PeriodosNominaPage /></RequirePermission>} />
                <Route path="nomina/periodos/:id" element={<RequirePermission perm={PERMISSIONS.NOMINA_VER}><PeriodoDetailPage /></RequirePermission>} />
                <Route path="nomina/novedades/:periodoId" element={<RequirePermission perm={PERMISSIONS.NOMINA_CREAR}><NovedadesPage /></RequirePermission>} />
                <Route path="nomina/recibos/:id" element={<RequirePermission perm={PERMISSIONS.NOMINA_VER}><ReciboPage /></RequirePermission>} />
                <Route path="nomina/configuracion" element={<RequirePermission perm={PERMISSIONS.NOMINA_CONFIG}><ConfigNominaPage /></RequirePermission>} />
                <Route path="nomina/libro-sueldos" element={<RequirePermission perm={PERMISSIONS.NOMINA_VER}><LibroSueldosPage /></RequirePermission>} />
                <Route path="activities" element={<RequirePermission perm={PERMISSIONS.ACTIVITY_VER}><ActivitiesPage /></RequirePermission>} />
                <Route path="calendar" element={<RequirePermission perm={PERMISSIONS.EVENTO_VER}><CalendarPage /></RequirePermission>} />
                <Route path="reports" element={<RequirePermission perm={PERMISSIONS.REPORTE_VER}><ReportsPage /></RequirePermission>} />
                <Route path="ayuda" element={<HelpPage />} />
                <Route path="pos" element={<PosPage />} />
                <Route path="pos/cajas" element={<CajasPage />} />
                <Route path="pos/cierres" element={<CierresPage />} />
                <Route path="settings" element={<RequirePermission perm={PERMISSIONS.CONFIG_VER}><SettingsPage /></RequirePermission>} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Routes>
          </LS>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
