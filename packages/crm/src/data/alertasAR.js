import { getSupabase } from '@saas/core'

export async function obtenerAlertasAR(companyId) {
  const supabase = getSupabase()
  // Obtener facturas aprobadas con vencimiento, ordenadas por fecha
  const { data, error } = await supabase
    .from('facturas')
    .select(`
      id, numero, total, saldo_pendiente, moneda,
      fecha_vencimiento, ultimo_recordatorio, recordatorios_enviados,
      cotizacion_id,
      cotizacion:cotizacion_id(
        contact:contact_id(id, name, phone)
      )
    `)
    .eq('company_id', companyId)
    .eq('estado', 'aprobada')
    .not('fecha_vencimiento', 'is', null)
    .order('fecha_vencimiento')

  if (error) throw error

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  return (data || []).map((f) => {
    const venc = f.fecha_vencimiento ? new Date(f.fecha_vencimiento) : null
    const diff = venc ? Math.floor((venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)) : null
    return {
      id: f.id,
      numero: f.numero,
      total: f.total,
      saldo: f.saldo_pendiente ?? f.total,
      moneda: f.moneda,
      fecha_vencimiento: f.fecha_vencimiento,
      dias_restantes: diff,
      ultimo_recordatorio: f.ultimo_recordatorio,
      recordatorios_enviados: f.recordatorios_enviados || 0,
      contact_id: f.cotizacion?.contact?.id,
      contact_nombre: f.cotizacion?.contact?.name || '—',
      contact_telefono: f.cotizacion?.contact?.phone || null,
    }
  })
}

export async function marcarRecordatorioEnviado(facturaId) {
  const supabase = getSupabase()
  const { data: factura } = await supabase.from('facturas').select('recordatorios_enviados').eq('id', facturaId).single()
  const count = (factura?.recordatorios_enviados || 0) + 1
  const { error } = await supabase.from('facturas').update({
    ultimo_recordatorio: new Date().toISOString(),
    recordatorios_enviados: count,
  }).eq('id', facturaId)
  if (error) throw error
}
