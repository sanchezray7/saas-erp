import { getSupabase } from '@saas/core'

export async function listarCotizaciones(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('cotizaciones')
    .select('*, contact:contact_id(name), deal:deal_id(title), facturas(cdc, estado)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function obtenerCotizacion(id) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('cotizaciones')
    .select('*, contact:contact_id(name, phone, email, ruc, dv, tipo_documento, num_documento, pais, direccion, organization:organization_id(name)), deal:deal_id(title)')
    .eq('id', id)
    .single()
  if (error) throw error
  const items = await listarItems(id)
  return { ...data, items }
}

export async function guardarCotizacion(companyId, cotizacion, items) {
  const supabase = getSupabase()

  // Calcular totales
  const subtotal = items.reduce((s, i) => s + Number(i.cantidad) * Number(i.precio_unitario), 0)
  const impuesto = Number(cotizacion.impuesto) || 0
  const total = cotizacion.total != null ? Number(cotizacion.total) : subtotal + impuesto

  const payload = {
    company_id: companyId,
    numero: cotizacion.numero,
    contact_id: cotizacion.contact_id || null,
    deal_id: cotizacion.deal_id || null,
    moneda: cotizacion.moneda || 'PYG',
    subtotal,
    impuesto,
    total,
    notas: cotizacion.notas || null,
    estado: cotizacion.estado || 'borrador',
  }

  if (cotizacion.id) {
    const { error } = await supabase.from('cotizaciones').update(payload).eq('id', cotizacion.id)
    if (error) throw error
    // Reemplazar items
    await supabase.from('cotizacion_items').delete().eq('cotizacion_id', cotizacion.id)
  } else {
    const { data, error } = await supabase.from('cotizaciones').insert(payload).select('id, token').single()
    if (error) throw error
    cotizacion.id = data.id
    cotizacion.token = data.token
  }

  // Insertar items
  if (items.length > 0) {
    const itemsPayload = items.map((i) => ({
      cotizacion_id: cotizacion.id,
      descripcion: i.descripcion,
      cantidad: Number(i.cantidad),
      precio_unitario: Number(i.precio_unitario),
      subtotal: Number(i.cantidad) * Number(i.precio_unitario),
      iva_id: i.iva_id || null,
      account_venta_id: i.account_venta_id || null,
      producto_id: i.producto_id || null,
    }))
    const { error } = await supabase.from('cotizacion_items').insert(itemsPayload)
    if (error) throw error
  }

  return cotizacion.id
}

export async function actualizarEstadoCotizacion(id, estado) {
  const supabase = getSupabase()
  const { error } = await supabase.from('cotizaciones').update({ estado }).eq('id', id)
  if (error) throw error
}

export async function eliminarCotizacion(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('cotizaciones').delete().eq('id', id)
  if (error) throw error
}

export async function generarNumero(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('generar_numero_cotizacion', {
    p_company_id: companyId,
  })
  if (error) throw error
  return data
}

async function listarItems(cotizacionId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('cotizacion_items')
    .select('*')
    .eq('cotizacion_id', cotizacionId)
    .order('id')
  if (error) throw error
  return data || []
}

export async function obtenerCotizacionPublica(token) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('obtener_cotizacion_publica', {
    p_token: token,
  })
  if (error) throw error
  if (!data || Object.keys(data).length === 0) throw new Error('Cotización no encontrada')
  return data
}
