import { lazy, Suspense, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import {
  ThemeProvider, AuthProvider, ProtectedRoute, RequireCompany,
  RequirePermission, RequireFeature, AppLayout, PERMISSIONS, ErrorBoundary, useAuth,
  PushPrompt, InstallPrompt, getSupabase,
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
    ? [NAV_SECTION_CRM, NAV_SECTION_SRM, NAV_SECTION_RRHH, NAV_SECTION_NOMINA, NAV_SECTION_FINANZAS, NAV_SECTION_CONSOLIDACION]
    : [NAV_SECTION_CRM, NAV_SECTION_SRM, NAV_SECTION_RRHH, NAV_SECTION_NOMINA, NAV_SECTION_FINANZAS]

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
                <Route path="proveedores" element={<RequireFeature featureKey="srm"><RequirePermission perm={PERMISSIONS.CONTACT_VER}><ProveedoresPage /></RequirePermission></RequireFeature>} />
                <Route path="proveedores/nuevo" element={<RequireFeature featureKey="srm"><RequirePermission perm={PERMISSIONS.CONTACT_CREAR}><ProveedorFormPage /></RequirePermission></RequireFeature>} />
                <Route path="proveedores/:id" element={<RequireFeature featureKey="srm"><RequirePermission perm={PERMISSIONS.CONTACT_VER}><ProveedorDetailPage /></RequirePermission></RequireFeature>} />
                <Route path="proveedores/:id/editar" element={<RequireFeature featureKey="srm"><RequirePermission perm={PERMISSIONS.CONTACT_EDITAR}><ProveedorFormPage /></RequirePermission></RequireFeature>} />
                <Route path="ordenes-compra" element={<RequireFeature featureKey="srm"><RequirePermission perm={PERMISSIONS.DEAL_VER}><OrdenesCompraPage /></RequirePermission></RequireFeature>} />
                <Route path="ordenes-compra/nueva" element={<RequireFeature featureKey="srm"><RequirePermission perm={PERMISSIONS.DEAL_CREAR}><OrdenCompraFormPage /></RequirePermission></RequireFeature>} />
                <Route path="ordenes-compra/:id" element={<RequireFeature featureKey="srm"><RequirePermission perm={PERMISSIONS.DEAL_VER}><OrdenCompraDetailPage /></RequirePermission></RequireFeature>} />
                <Route path="ordenes-compra/:id/editar" element={<RequireFeature featureKey="srm"><RequirePermission perm={PERMISSIONS.DEAL_EDITAR}><OrdenCompraFormPage /></RequirePermission></RequireFeature>} />
                <Route path="calendario-pagos" element={<RequireFeature featureKey="srm"><RequirePermission perm={PERMISSIONS.DEAL_VER}><CalendarioPagosPage /></RequirePermission></RequireFeature>} />
                <Route path="facturas-proveedor" element={<RequireFeature featureKey="srm"><RequirePermission perm={PERMISSIONS.DEAL_VER}><FacturasProveedorPage /></RequirePermission></RequireFeature>} />
                <Route path="facturas-proveedor/nueva" element={<RequireFeature featureKey="srm"><RequirePermission perm={PERMISSIONS.DEAL_CREAR}><FacturaProveedorFormPage /></RequirePermission></RequireFeature>} />
                <Route path="facturas-proveedor/:id" element={<RequireFeature featureKey="srm"><RequirePermission perm={PERMISSIONS.DEAL_VER}><FacturaProveedorDetailPage /></RequirePermission></RequireFeature>} />
                <Route path="facturas-proveedor/:id/editar" element={<RequireFeature featureKey="srm"><RequirePermission perm={PERMISSIONS.DEAL_EDITAR}><FacturaProveedorFormPage /></RequirePermission></RequireFeature>} />
                <Route path="scorecards" element={<RequireFeature featureKey="srm"><RequirePermission perm={PERMISSIONS.DEAL_VER}><ScorecardsPage /></RequirePermission></RequireFeature>} />
                <Route path="alertas-vencimiento" element={<RequireFeature featureKey="srm"><RequirePermission perm={PERMISSIONS.DEAL_VER}><AlertasVencimientoPage /></RequirePermission></RequireFeature>} />
                <Route path="historial-precios" element={<RequireFeature featureKey="srm"><RequirePermission perm={PERMISSIONS.DEAL_VER}><HistorialPreciosPage /></RequirePermission></RequireFeature>} />
                <Route path="sugerencias-oc" element={<RequireFeature featureKey="srm"><RequirePermission perm={PERMISSIONS.DEAL_CREAR}><SugerenciasOCPage /></RequirePermission></RequireFeature>} />
                <Route path="cuentas-pagar" element={<RequireFeature featureKey="srm"><RequirePermission perm={PERMISSIONS.DEAL_VER}><CuentasPagarPage /></RequirePermission></RequireFeature>} />
                <Route path="impuestos" element={<RequireFeature featureKey="contabilidad"><RequirePermission perm={PERMISSIONS.CONFIG_VER}><ImpuestosConfigPage /></RequirePermission></RequireFeature>} />
                <Route path="plan-contable" element={<RequireFeature featureKey="contabilidad"><RequirePermission perm={PERMISSIONS.CONFIG_VER}><PlanContablePage /></RequirePermission></RequireFeature>} />
                <Route path="reportes-contables" element={<RequireFeature featureKey="contabilidad_avanzada"><RequirePermission perm={PERMISSIONS.DEAL_VER}><AccountingReportsPage /></RequirePermission></RequireFeature>} />
                <Route path="aging" element={<RequireFeature featureKey="contabilidad_avanzada"><RequirePermission perm={PERMISSIONS.DEAL_VER}><AgingPage /></RequirePermission></RequireFeature>} />
                <Route path="conciliacion" element={<RequireFeature featureKey="contabilidad_avanzada"><RequirePermission perm={PERMISSIONS.DEAL_VER}><ConciliacionPage /></RequirePermission></RequireFeature>} />
                <Route path="conciliacion/nueva" element={<RequireFeature featureKey="contabilidad_avanzada"><RequirePermission perm={PERMISSIONS.DEAL_CREAR}><ConciliacionNuevaPage /></RequirePermission></RequireFeature>} />
                <Route path="conciliacion/:id" element={<RequireFeature featureKey="contabilidad_avanzada"><RequirePermission perm={PERMISSIONS.DEAL_VER}><ConciliacionDetailPage /></RequirePermission></RequireFeature>} />
                <Route path="consolidacion" element={<RequireFeature featureKey="contabilidad_avanzada"><RequirePermission perm={PERMISSIONS.CONFIG_VER}><ConsolidacionPage /></RequirePermission></RequireFeature>} />
                <Route path="inventario" element={<RequireFeature featureKey="inventario"><RequirePermission perm={PERMISSIONS.DEAL_VER}><InventarioPage /></RequirePermission></RequireFeature>} />
                <Route path="movimientos-stock" element={<RequireFeature featureKey="inventario"><RequirePermission perm={PERMISSIONS.DEAL_VER}><MovimientosPage /></RequirePermission></RequireFeature>} />
                <Route path="centros" element={<RequireFeature featureKey="inventario"><RequirePermission perm={PERMISSIONS.CONFIG_VER}><CentrosPage /></RequirePermission></RequireFeature>} />
                <Route path="almacenes" element={<RequireFeature featureKey="inventario"><RequirePermission perm={PERMISSIONS.CONFIG_VER}><AlmacenesPage /></RequirePermission></RequireFeature>} />
                <Route path="transferencias" element={<RequireFeature featureKey="inventario"><RequirePermission perm={PERMISSIONS.DEAL_VER}><TransferenciasPage /></RequirePermission></RequireFeature>} />
                <Route path="kardex" element={<RequireFeature featureKey="inventario"><RequirePermission perm={PERMISSIONS.DEAL_VER}><KardexPage /></RequirePermission></RequireFeature>} />
                <Route path="conteos" element={<RequireFeature featureKey="inventario"><RequirePermission perm={PERMISSIONS.DEAL_VER}><ConteosPage /></RequirePermission></RequireFeature>} />
                <Route path="conteos/:id" element={<RequireFeature featureKey="inventario"><RequirePermission perm={PERMISSIONS.DEAL_VER}><ConteoDetailPage /></RequirePermission></RequireFeature>} />
                <Route path="ubicaciones" element={<RequireFeature featureKey="inventario"><RequirePermission perm={PERMISSIONS.CONFIG_VER}><UbicacionesPage /></RequirePermission></RequireFeature>} />
                <Route path="transportistas" element={<RequireFeature featureKey="inventario"><RequirePermission perm={PERMISSIONS.CONFIG_VER}><TransportistasPage /></RequirePermission></RequireFeature>} />
                <Route path="picking" element={<RequireFeature featureKey="inventario"><RequirePermission perm={PERMISSIONS.DEAL_VER}><PickingPage /></RequirePermission></RequireFeature>} />
                <Route path="picking/:id" element={<RequireFeature featureKey="inventario"><RequirePermission perm={PERMISSIONS.DEAL_VER}><PickingDetailPage /></RequirePermission></RequireFeature>} />
                <Route path="remitos" element={<RequireFeature featureKey="inventario"><RequirePermission perm={PERMISSIONS.DEAL_VER}><RemitosPage /></RequirePermission></RequireFeature>} />
                <Route path="remitos/:id" element={<RequireFeature featureKey="inventario"><RequirePermission perm={PERMISSIONS.DEAL_VER}><RemitoDetailPage /></RequirePermission></RequireFeature>} />
                <Route path="valuacion" element={<RequireFeature featureKey="inventario"><RequirePermission perm={PERMISSIONS.DEAL_VER}><ValuacionPage /></RequirePermission></RequireFeature>} />
                <Route path="asientos" element={<RequireFeature featureKey="contabilidad"><RequirePermission perm={PERMISSIONS.CONFIG_VER}><AsientosPage /></RequirePermission></RequireFeature>} />
                <Route path="asientos/nuevo" element={<RequireFeature featureKey="contabilidad"><RequirePermission perm={PERMISSIONS.CONFIG_CREAR}><NuevoAsientoPage /></RequirePermission></RequireFeature>} />
                <Route path="asientos/:id" element={<RequireFeature featureKey="contabilidad"><RequirePermission perm={PERMISSIONS.CONFIG_VER}><AsientoDetailPage /></RequirePermission></RequireFeature>} />
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
                <Route path="notas-cd" element={<RequireFeature featureKey="notas_cd"><RequirePermission perm={PERMISSIONS.DEAL_VER}><NotasCDPage /></RequirePermission></RequireFeature>} />
                <Route path="notas-cd/nueva" element={<RequireFeature featureKey="notas_cd"><RequirePermission perm={PERMISSIONS.DEAL_CREAR}><NotaCDFormPage /></RequirePermission></RequireFeature>} />
                <Route path="notas-cd/:id" element={<RequireFeature featureKey="notas_cd"><RequirePermission perm={PERMISSIONS.DEAL_VER}><NotaCDDetailPage /></RequirePermission></RequireFeature>} />
                <Route path="alertas-ar" element={<RequirePermission perm={PERMISSIONS.DEAL_VER}><AlertasARPage /></RequirePermission>} />
                <Route path="empleados" element={<RequireFeature featureKey="rrhh"><RequirePermission perm={PERMISSIONS.CONTACT_VER}><EmpleadosPage /></RequirePermission></RequireFeature>} />
                <Route path="empleados/nuevo" element={<RequireFeature featureKey="rrhh"><RequirePermission perm={PERMISSIONS.CONTACT_CREAR}><EmpleadoFormPage /></RequirePermission></RequireFeature>} />
                <Route path="empleados/:id" element={<RequireFeature featureKey="rrhh"><RequirePermission perm={PERMISSIONS.CONTACT_VER}><EmpleadoDetailPage /></RequirePermission></RequireFeature>} />
                <Route path="empleados/:id/editar" element={<RequireFeature featureKey="rrhh"><RequirePermission perm={PERMISSIONS.CONTACT_EDITAR}><EmpleadoFormPage /></RequirePermission></RequireFeature>} />
                <Route path="organigrama" element={<RequireFeature featureKey="rrhh"><RequirePermission perm={PERMISSIONS.CONTACT_VER}><OrganigramaPage /></RequirePermission></RequireFeature>} />
                <Route path="asistencia" element={<RequireFeature featureKey="rrhh"><RequirePermission perm={PERMISSIONS.CONTACT_VER}><AsistenciaPage /></RequirePermission></RequireFeature>} />
                <Route path="asistencia/importar" element={<RequireFeature featureKey="rrhh"><RequirePermission perm={PERMISSIONS.CONTACT_CREAR}><ImportarAsistenciaPage /></RequirePermission></RequireFeature>} />
                <Route path="ausencias" element={<RequireFeature featureKey="rrhh"><RequirePermission perm={PERMISSIONS.CONTACT_VER}><AusenciasPage /></RequirePermission></RequireFeature>} />
                <Route path="vacaciones" element={<RequireFeature featureKey="rrhh"><RequirePermission perm={PERMISSIONS.CONTACT_VER}><VacacionesPage /></RequirePermission></RequireFeature>} />
                <Route path="reporte-asistencia" element={<RequireFeature featureKey="rrhh"><RequirePermission perm={PERMISSIONS.CONTACT_VER}><ReporteAsistenciaPage /></RequirePermission></RequireFeature>} />
                <Route path="turnos" element={<RequireFeature featureKey="rrhh"><RequirePermission perm={PERMISSIONS.CONFIG_VER}><TurnosPage /></RequirePermission></RequireFeature>} />
                <Route path="patrones" element={<RequireFeature featureKey="rrhh"><RequirePermission perm={PERMISSIONS.CONFIG_VER}><RotacionPatronesPage /></RequirePermission></RequireFeature>} />
                <Route path="planificar-turnos" element={<RequireFeature featureKey="rrhh"><RequirePermission perm={PERMISSIONS.CONTACT_VER}><PlanificarTurnosPage /></RequirePermission></RequireFeature>} />
                <Route path="control-horario" element={<RequireFeature featureKey="rrhh"><RequirePermission perm={PERMISSIONS.CONTACT_VER}><ControlHorarioPage /></RequirePermission></RequireFeature>} />
                <Route path="nomina" element={<RequireFeature featureKey="nomina"><RequirePermission perm={PERMISSIONS.NOMINA_VER}><NominaDashboardPage /></RequirePermission></RequireFeature>} />
                <Route path="nomina/periodos" element={<RequireFeature featureKey="nomina"><RequirePermission perm={PERMISSIONS.NOMINA_VER}><PeriodosNominaPage /></RequirePermission></RequireFeature>} />
                <Route path="nomina/periodos/:id" element={<RequireFeature featureKey="nomina"><RequirePermission perm={PERMISSIONS.NOMINA_VER}><PeriodoDetailPage /></RequirePermission></RequireFeature>} />
                <Route path="nomina/novedades/:periodoId" element={<RequireFeature featureKey="nomina"><RequirePermission perm={PERMISSIONS.NOMINA_CREAR}><NovedadesPage /></RequirePermission></RequireFeature>} />
                <Route path="nomina/recibos/:id" element={<RequireFeature featureKey="nomina"><RequirePermission perm={PERMISSIONS.NOMINA_VER}><ReciboPage /></RequirePermission></RequireFeature>} />
                <Route path="nomina/configuracion" element={<RequireFeature featureKey="nomina"><RequirePermission perm={PERMISSIONS.NOMINA_CONFIG}><ConfigNominaPage /></RequirePermission></RequireFeature>} />
                <Route path="nomina/libro-sueldos" element={<RequireFeature featureKey="nomina"><RequirePermission perm={PERMISSIONS.NOMINA_VER}><LibroSueldosPage /></RequirePermission></RequireFeature>} />
                <Route path="activities" element={<RequirePermission perm={PERMISSIONS.ACTIVITY_VER}><ActivitiesPage /></RequirePermission>} />
                <Route path="calendar" element={<RequirePermission perm={PERMISSIONS.EVENTO_VER}><CalendarPage /></RequirePermission>} />
                <Route path="reports" element={<RequireFeature featureKey="reportes"><RequirePermission perm={PERMISSIONS.REPORTE_VER}><ReportsPage /></RequirePermission></RequireFeature>} />
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
