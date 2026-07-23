import { serviciosFetch } from './api'

export async function listarOrdenesTrabajo(companyId) {
  return serviciosFetch('listarOrdenesTrabajo', { company_id: companyId })
}

export async function getOrdenTrabajo(id) {
  return serviciosFetch('getOrdenTrabajo', { id })
}

export async function guardarOrdenTrabajo(companyId, userId, ot) {
  return serviciosFetch('guardarOrdenTrabajo', { company_id: companyId, user_id: userId, ot })
}

export async function iniciarOT(id) {
  return serviciosFetch('iniciarOT', { id })
}

export async function completarOT(id) {
  return serviciosFetch('completarOT', { id })
}

export async function cancelarOT(id) {
  return serviciosFetch('cancelarOT', { id })
}

export async function getOTMateriales(ordenId) {
  return serviciosFetch('getOTMateriales', { orden_id: ordenId })
}

export async function getOTTiempos(ordenId) {
  return serviciosFetch('getOTTiempos', { orden_id: ordenId })
}

export async function agregarMaterial(companyId, ordenId, material) {
  return serviciosFetch('agregarMaterial', { company_id: companyId, orden_id: ordenId, material })
}

export async function agregarTiempo(ordenId, userId, tiempo) {
  return serviciosFetch('agregarTiempo', { orden_id: ordenId, user_id: userId, tiempo })
}

export async function convertirPresupuestoAOT(companyId, userId, presupuestoId) {
  return serviciosFetch('convertirPresupuestoAOT', { company_id: companyId, user_id: userId, presupuesto_id: presupuestoId })
}
