import { getSupabase } from '@saas/core'

export async function listarDocumentosProveedor(proveedorId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('listar_documentos_proveedor', {
    p_proveedor_id: proveedorId,
  })
  if (error) throw error
  return data || []
}

export async function guardarDocumentoProveedor(companyId, doc) {
  const supabase = getSupabase()
  const payload = {
    company_id: companyId,
    proveedor_id: doc.proveedor_id,
    nombre: doc.nombre,
    tipo_documento: doc.tipo_documento || 'otro',
    fecha_emision: doc.fecha_emision || null,
    fecha_vencimiento: doc.fecha_vencimiento || null,
    alerta_dias_antes: Number(doc.alerta_dias_antes) || 30,
    archivo_url: doc.archivo_url || null,
    estado: doc.estado || 'vigente',
    notas: doc.notas || null,
  }

  if (doc.id) {
    const { error } = await supabase.from('proveedor_documentos').update(payload).eq('id', doc.id)
    if (error) throw error
    return doc.id
  } else {
    const { data, error } = await supabase.from('proveedor_documentos').insert(payload).select('id').single()
    if (error) throw error
    return data.id
  }
}

export async function eliminarDocumentoProveedor(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('proveedor_documentos').delete().eq('id', id)
  if (error) throw error
}

export async function alertasVencimiento(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('alertas_vencimiento', { p_company_id: companyId })
  if (error) throw error
  return data || []
}

export async function actualizarEstadoDocumento(id, estado) {
  const supabase = getSupabase()
  const { error } = await supabase.from('proveedor_documentos').update({ estado }).eq('id', id)
  if (error) throw error
}

export async function marcarAlertaEnviada(id) {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('proveedor_documentos')
    .update({ ultima_alerta_enviada: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
