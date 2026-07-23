import { produccionFetch } from './api'

export async function listarRecetas(companyId) {
  return produccionFetch('listarRecetas', { company_id: companyId })
}

export async function getReceta(id) {
  return produccionFetch('getReceta', { id })
}

export async function guardarReceta(companyId, receta) {
  return produccionFetch('guardarReceta', { company_id: companyId, receta })
}

export async function eliminarReceta(id) {
  return produccionFetch('eliminarReceta', { id })
}

export async function listarIngredientes(recetaId) {
  return produccionFetch('listarIngredientes', { receta_id: recetaId })
}

export async function guardarIngredientes(recetaId, ingredientes) {
  return produccionFetch('guardarIngredientes', { receta_id: recetaId, ingredientes })
}
