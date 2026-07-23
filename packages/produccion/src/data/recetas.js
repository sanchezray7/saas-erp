import { getSupabase } from '@saas/core'

export async function listarRecetas(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('recetas')
    .select('*, producto_final:catalogo_productos!producto_final_id(id, nombre, codigo)')
    .eq('company_id', companyId)
    .order('nombre')
  if (error) {
    const { data: d2, error: e2 } = await supabase.from('recetas').select('*').eq('company_id', companyId).order('nombre')
    if (e2) throw e2
    return d2 || []
  }
  return data || []
}

export async function getReceta(id) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('recetas')
    .select('*, producto_final:catalogo_productos!producto_final_id(id, nombre, codigo)')
    .eq('id', id)
    .single()
  if (error) {
    const { data: d2, error: e2 } = await supabase.from('recetas').select('*').eq('id', id).single()
    if (e2) throw e2
    return d2
  }
  return data
}

export async function guardarReceta(companyId, receta) {
  const supabase = getSupabase()
  const payload = {
    company_id: companyId,
    codigo: receta.codigo,
    nombre: receta.nombre,
    producto_final_id: receta.producto_final_id,
    cantidad_producida: receta.cantidad_producida || 1,
    unidad_medida: receta.unidad_medida || 'UNI',
    instrucciones: receta.instrucciones || null,
    activo: receta.activo !== false,
  }
  if (receta.id) {
    const { error } = await supabase.from('recetas').update(payload).eq('id', receta.id)
    if (error) throw error
    return receta.id
  }
  const { data, error } = await supabase.from('recetas').insert(payload).select('id').single()
  if (error) throw error
  return data.id
}

export async function eliminarReceta(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('recetas').delete().eq('id', id)
  if (error) throw error
}

export async function listarIngredientes(recetaId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('receta_ingredientes')
    .select('*, producto:catalogo_productos(id, nombre, codigo, tipo)')
    .eq('receta_id', recetaId)
    .order('orden')
  if (error) {
    const { data: d2, error: e2 } = await supabase.from('receta_ingredientes').select('*').eq('receta_id', recetaId).order('orden')
    if (e2) throw e2
    return d2 || []
  }
  return data || []
}

export async function guardarIngredientes(recetaId, ingredientes) {
  const supabase = getSupabase()
  await supabase.from('receta_ingredientes').delete().eq('receta_id', recetaId)
  if (!ingredientes || ingredientes.length === 0) return
  const rows = ingredientes.map((ing, i) => ({
    receta_id: recetaId,
    producto_id: ing.producto_id,
    cantidad: ing.cantidad,
    unidad_medida: ing.unidad_medida || 'UNI',
    es_subproducto: ing.es_subproducto || false,
    merma_porcentaje: ing.merma_porcentaje || 0,
    orden: i,
  }))
  const { error } = await supabase.from('receta_ingredientes').insert(rows)
  if (error) throw error
}
