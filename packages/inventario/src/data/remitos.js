import { getSupabase } from '@saas/core'

export async function listarRemitos(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('remitos')
    .select('*, transportista:transportista_id(nombre)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function obtenerRemito(id) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('remitos')
    .select('*, transportista:transportista_id(nombre), picking:picking_id(numero, items:picking_items(*, producto:producto_id(nombre, codigo)))')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function generarRemito(companyId, pickingId, facturaId, datosEnvio) {
  const supabase = getSupabase()

  // Número
  const { data: numData } = await supabase.rpc('generar_numero_remito', { p_company_id: companyId })
  const numero = numData || 'RE-' + Date.now().toString(36).toUpperCase()

  const { data, error } = await supabase.from('remitos').insert({
    company_id: companyId, picking_id: pickingId, factura_id: facturaId,
    numero, transportista_id: datosEnvio.transportista_id || null,
    chofer: datosEnvio.chofer || null, patente: datosEnvio.patente || null,
    destino: datosEnvio.destino || null,
  }).select('id, numero').single()
  if (error) throw error

  return data
}
