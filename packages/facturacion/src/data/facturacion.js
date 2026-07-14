import { getSupabase } from '@saas/core'

export async function listarFacturas(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('facturas')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function obtenerFactura(id) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('facturas')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function guardarFactura(companyId, { cotizacion_id, cdc, numero, timbrado, xml_generado, total, moneda, estado = 'emitida', errores, fecha_vencimiento, subtotal, impuesto }) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('facturas')
    .insert({
      company_id: companyId,
      cotizacion_id,
      cdc,
      numero,
      timbrado,
      xml_generado,
      total,
      subtotal: subtotal || 0,
      impuesto: impuesto || 0,
      moneda,
      estado,
      fecha_vencimiento,
      errores: errores ? JSON.stringify(errores) : null,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function obtenerProximoNumeroFactura(companyId, establecimiento = '001', puntoExp = '001') {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('incrementar_contador_factura', {
    p_company_id: companyId,
    p_establecimiento: establecimiento,
    p_punto_exp: puntoExp,
  })
  if (error) throw error
  return { numeroDoc: data.numero_doc, numeroFormateado: data.numero_formateado }
}

export async function anularFactura(facturaId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('anular_factura_cliente', { p_factura_id: facturaId })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data
}
