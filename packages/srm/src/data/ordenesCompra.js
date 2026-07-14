import { getSupabase } from '@saas/core'

export async function listarOrdenes(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('ordenes_compra')
    .select('*, proveedor:proveedor_id(nombre)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function obtenerOrden(id) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('ordenes_compra')
    .select('*, proveedor:proveedor_id(nombre, ruc, telefono, email), items:orden_compra_items(*, producto:producto_id(nombre))')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function guardarOrden(companyId, orden, items) {
  const supabase = getSupabase()
  const subtotal = items.reduce((s, i) => s + Number(i.cantidad) * Number(i.precio_unitario), 0)
  const total = subtotal

  const payload = {
    company_id: companyId,
    proveedor_id: orden.proveedor_id,
    numero: orden.numero,
    estado: orden.estado || 'borrador',
    fecha_entrega_estimada: orden.fecha_entrega_estimada || null,
    subtotal, total,
    moneda: orden.moneda || 'PYG',
    notas: orden.notas || null,
  }

  if (orden.id) {
    const { error } = await supabase.from('ordenes_compra').update(payload).eq('id', orden.id)
    if (error) throw error
    await supabase.from('orden_compra_items').delete().eq('orden_id', orden.id)
  } else {
    const { data, error } = await supabase.from('ordenes_compra').insert(payload).select('id').single()
    if (error) throw error
    orden.id = data.id
  }

  if (items.length > 0) {
    const { error } = await supabase.from('orden_compra_items').insert(
      items.map((i) => ({
        orden_id: orden.id,
        producto_id: i.producto_id,
        descripcion: i.descripcion || null,
        cantidad: Number(i.cantidad),
        precio_unitario: Number(i.precio_unitario),
        subtotal: Number(i.cantidad) * Number(i.precio_unitario),
      }))
    )
    if (error) throw error
  }
  return orden.id
}

export async function actualizarEstadoOrden(id, estado) {
  const supabase = getSupabase()
  const { error } = await supabase.from('ordenes_compra').update({ estado }).eq('id', id)
  if (error) throw error
}

export async function registrarRecepcion(companyId, ordenId, items) {
  const supabase = getSupabase()

  // 1. Obtener proveedor_id de la OC
  const { data: oc } = await supabase.from('ordenes_compra').select('proveedor_id').eq('id', ordenId).single()
  if (!oc) throw new Error('OC no encontrada')

  // 2. Crear recepción header
  const { data: recepcion, error: err1 } = await supabase
    .from('recepciones').insert({
      company_id: companyId, orden_id: ordenId, proveedor_id: oc.proveedor_id,
      observaciones: 'Recepción parcial desde la orden',
    }).select('id').single()
  if (err1) throw err1

  // 2. Insertar recepcion_items y actualizar cantidad_recibida en OC items
  for (const item of items) {
    const cantidad = Number(item.cantidad_recibida)
    if (cantidad <= 0) continue

    await supabase.from('recepcion_items').insert({
      recepcion_id: recepcion.id,
      producto_id: item.producto_id,
      cantidad_recibida: cantidad,
    })

    // Sumar a cantidad_recibida existente
    const { data: current } = await supabase
      .from('orden_compra_items').select('cantidad_recibida, cantidad').eq('id', item.orden_item_id).single()
    const nueva = Number(current.cantidad_recibida) + cantidad
    await supabase.from('orden_compra_items').update({ cantidad_recibida: nueva }).eq('id', item.orden_item_id)
  }

  // 3. Verificar si todo está recibido → cambiar estado
  const { data: oci } = await supabase
    .from('orden_compra_items').select('cantidad, cantidad_recibida').eq('orden_id', ordenId)
  const completo = (oci || []).every((i) => Number(i.cantidad_recibida) >= Number(i.cantidad))

  if (completo) {
    const { error: err2 } = await supabase.from('ordenes_compra').update({ estado: 'recibida' }).eq('id', ordenId)
    if (err2) throw err2
  }

  return { completo }
}
