import { produccionFetch } from './api'

export async function listarOrdenes(companyId) {
  return produccionFetch('listarOrdenes', { company_id: companyId })
}

export async function getOrden(id) {
  return produccionFetch('getOrden', { id })
}

export async function guardarOrden(companyId, userId, orden) {
  return produccionFetch('guardarOrden', { company_id: companyId, user_id: userId, orden })
}

export async function iniciarOrden(id) {
  return produccionFetch('iniciarOrden', { id })
}

export async function cancelarOrden(id) {
  return produccionFetch('cancelarOrden', { id })
}

export async function getConsumos(ordenId) {
  return produccionFetch('getConsumos', { orden_id: ordenId })
}

export async function getObtenciones(ordenId) {
  return produccionFetch('getObtenciones', { orden_id: ordenId })
}

export async function completarOrden(companyId, userId, ordenId, almacenId, cantidadProducida, lote, consumosReales = {}) {
  return produccionFetch('completarOrden', {
    company_id: companyId, user_id: userId, orden_id: ordenId,
    almacen_id: almacenId, cantidad_producida: cantidadProducida, lote,
    consumos_reales: consumosReales,
  })
}
