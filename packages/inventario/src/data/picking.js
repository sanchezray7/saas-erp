import { getSupabase } from '@saas/core'

export async function listarPicking(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('picking_ordenes')
    .select('*, factura:factura_id(numero)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function obtenerPicking(id) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('picking_ordenes')
    .select('*, factura:factura_id(numero), items:picking_items(*, producto:producto_id(id, nombre, codigo), ubicacion:ubicacion_id(id, nombre, pasillo, estante, posicion))')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function crearPicking(companyId, userId, facturaId, items, numero) {
  const supabase = getSupabase()

  // Crear orden
  const { data: orden, error } = await supabase.from('picking_ordenes').insert({
    company_id: companyId, factura_id: facturaId, numero,
    estado: 'pendiente', creado_por: userId,
  }).select('id').single()
  if (error) throw error

  // Insertar items
  const pickItems = items.map((i) => ({
    picking_id: orden.id, producto_id: i.producto_id,
    cantidad_solicitada: Number(i.cantidad), ubicacion_id: i.ubicacion_id || null,
  }))
  const { error: err2 } = await supabase.from('picking_items').insert(pickItems)
  if (err2) throw err2

  return orden
}

export async function actualizarItemPicking(itemId, cantidadPreparada) {
  const supabase = getSupabase()
  const estado = Number(cantidadPreparada) > 0 ? 'listo' : 'pendiente'
  const { error } = await supabase.from('picking_items').update({ cantidad_preparada: Number(cantidadPreparada) || 0, estado }).eq('id', itemId)
  if (error) throw error
}

export async function cambiarEstadoPicking(id, estado) {
  const supabase = getSupabase()
  const { error } = await supabase.from('picking_ordenes').update({ estado }).eq('id', id)
  if (error) throw error
}
