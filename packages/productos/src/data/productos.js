import { getSupabase } from '@saas/core'

export async function listarProductos(companyId, soloActivos = true) {
  const supabase = getSupabase()
  let query = supabase
    .from('catalogo_productos')
    .select('*')
    .eq('company_id', companyId)
    .order('nombre')

  if (soloActivos) query = query.eq('activo', true)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function guardarProducto(companyId, producto) {
  const supabase = getSupabase()
  const payload = { company_id: companyId, ...producto }
  if (!payload.id) delete payload.id
  if (!payload.codigo) delete payload.codigo

  const { data, error } = await supabase
    .from('catalogo_productos')
    .upsert(payload)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function eliminarProducto(id) {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('catalogo_productos')
    .update({ activo: false })
    .eq('id', id)
  if (error) throw error
}

export async function importarProductos(companyId, rows) {
  const supabase = getSupabase()
  const payload = rows.map((r) => ({
    company_id: companyId,
    nombre: r.nombre || r.name,
    codigo: r.codigo || r.code || null,
    tipo: (r.tipo || r.type) === 'servicio' || (r.tipo || r.type) === 'service' ? 'servicio' : 'producto',
    descripcion: r.descripcion || r.description || null,
    precio_unitario: Number(r.precio_unitario || r.price || 0),
    moneda: r.moneda || r.currency || 'PYG',
    unidad_medida: r.unidad_medida || r.unit || 'UNI',
  }))
  const { error } = await supabase.from('catalogo_productos').insert(payload)
  if (error) throw error
}
