import { getSupabase } from '@saas/core'

export async function listarProveedores(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('proveedores')
    .select('*, contact:contact_id(name, email, phone)')
    .eq('company_id', companyId)
    .order('nombre')
  if (error) throw error
  return data || []
}

export async function obtenerProveedor(id) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('proveedores')
    .select('*, contact:contact_id(name, email, phone)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function guardarProveedor(companyId, proveedor) {
  const supabase = getSupabase()
  const payload = { ...proveedor, company_id: companyId }
  if (!payload.id) delete payload.id
  if (!payload.contact_id) payload.contact_id = null
  if (!payload.account_proveedor_id) payload.account_proveedor_id = null
  const { data, error } = await supabase.from('proveedores').upsert(payload).select().single()
  if (error) throw error
  return data
}

export async function eliminarProveedor(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('proveedores').delete().eq('id', id)
  if (error) throw error
}

// === PROVEEDOR_PRODUCTOS ===
export async function listarProductosDeProveedor(proveedorId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('proveedor_productos')
    .select('*, producto:catalogo_productos!producto_id(id, nombre, codigo, unidad_medida)')
    .eq('proveedor_id', proveedorId)
    .order('producto(nombre)')
  if (error) throw error
  return data || []
}

export async function agregarProductoAProveedor(proveedorId, productoId, precio, moneda) {
  const supabase = getSupabase()
  const { error } = await supabase.from('proveedor_productos').upsert({
    proveedor_id: proveedorId,
    producto_id: productoId,
    precio_proveedor: precio || 0,
    moneda: moneda || 'PYG',
  })
  if (error) throw error
}

export async function eliminarProductoDeProveedor(proveedorId, productoId) {
  const supabase = getSupabase()
  const { error } = await supabase.from('proveedor_productos').delete()
    .match({ proveedor_id: proveedorId, producto_id: productoId })
  if (error) throw error
}
