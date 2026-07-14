import { getSupabase } from '@saas/core'

export async function listarFacturasProveedor(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('proveedor_facturas')
    .select('*, proveedor:proveedor_id(nombre), orden:orden_id(numero)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function obtenerFacturaProveedor(id) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('proveedor_facturas')
    .select('*, proveedor:proveedor_id(nombre, ruc, telefono, email), items:proveedor_factura_items(*, producto:producto_id(nombre), orden_item:orden_item_id(id))')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function guardarFacturaProveedor(companyId, factura, items) {
  const supabase = getSupabase()

  const subtotal = items.reduce((s, i) => s + Number(i.cantidad) * Number(i.precio_unitario), 0)
  const total = factura.total != null ? Number(factura.total) : subtotal + Number(factura.impuesto || 0)

  const payload = {
    company_id: companyId,
    proveedor_id: factura.proveedor_id,
    orden_id: factura.orden_id || null,
    numero_factura: factura.numero_factura,
    timbrado: factura.timbrado || null,
    fecha_emision: factura.fecha_emision || new Date().toISOString().slice(0, 10),
    fecha_vencimiento: factura.fecha_vencimiento || null,
    subtotal,
    impuesto: Number(factura.impuesto || 0),
    total,
    moneda: factura.moneda || 'PYG',
    estado: factura.estado || 'pendiente',
    notas: factura.notas || null,
  }

  if (factura.id) {
    const { error } = await supabase.from('proveedor_facturas').update(payload).eq('id', factura.id)
    if (error) throw error
    await supabase.from('proveedor_factura_items').delete().eq('factura_id', factura.id)
  } else {
    const { data, error } = await supabase.from('proveedor_facturas').insert(payload).select('id').single()
    if (error) throw error
    factura.id = data.id
  }

  if (items.length > 0) {
    const { error } = await supabase.from('proveedor_factura_items').insert(
      items.map((i) => ({
        factura_id: factura.id,
        producto_id: i.producto_id || null,
        orden_item_id: i.orden_item_id || null,
        descripcion: i.descripcion || null,
        cantidad: Number(i.cantidad),
        precio_unitario: Number(i.precio_unitario),
        subtotal: Number(i.cantidad) * Number(i.precio_unitario),
        iva_id: i.iva_id || null,
        account_compra_id: i.account_compra_id || null,
      }))
    )
    if (error) throw error
  }

  return factura.id
}

export async function actualizarEstadoFactura(id, estado) {
  const supabase = getSupabase()
  const { error } = await supabase.from('proveedor_facturas').update({ estado }).eq('id', id)
  if (error) throw error
}

export async function eliminarFacturaProveedor(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('proveedor_facturas').delete().eq('id', id)
  if (error) throw error
}

export async function cotejarFactura(id) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('cotejar_factura', { p_factura_id: id })
  if (error) throw error
  return data
}
