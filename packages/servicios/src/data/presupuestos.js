import { serviciosFetch } from './api'

export async function listarPresupuestos(companyId) {
  return serviciosFetch('listarPresupuestos', { company_id: companyId })
}

export async function getPresupuesto(id) {
  return serviciosFetch('getPresupuesto', { id })
}

export async function guardarPresupuesto(companyId, userId, presupuesto) {
  return serviciosFetch('guardarPresupuesto', { company_id: companyId, user_id: userId, presupuesto })
}

export async function eliminarPresupuesto(id) {
  return serviciosFetch('eliminarPresupuesto', { id })
}

export async function getPresupuestoItems(presupuestoId) {
  return serviciosFetch('getPresupuestoItems', { presupuesto_id: presupuestoId })
}

export async function guardarPresupuestoItems(presupuestoId, items) {
  return serviciosFetch('guardarPresupuestoItems', { presupuesto_id: presupuestoId, items })
}
