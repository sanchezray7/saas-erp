import { getSupabase } from '@saas/core'

export async function enviarWhatsApp({ companyId, contactId, proveedorId, to, body }) {
  const supabase = getSupabase()

  // 1. Enviar vía Twilio
  const { data, error } = await supabase.functions.invoke('send-whatsapp', {
    body: { to, body },
  })

  if (error) {
    let detail = error.message
    try {
      const ctx = error?.context
      if (ctx instanceof Response) {
        const text = await ctx.clone().text()
        try { detail = JSON.parse(text).error || text } catch { detail = text }
      }
    } catch {}
    throw new Error(detail)
  }

  if (data?.error) throw new Error(data.error)

  // 2. Crear actividad en el timeline (si hay contacto)
  if (contactId) {
    try {
      await supabase.from('activities').insert({
        company_id: companyId,
        contact_id: contactId,
        type: 'note',
        subject: `💬 WhatsApp → ${to}`,
        description: body,
      })
    } catch {}
  }

  // 3. Log en tabla de auditoría
  try {
    await supabase.from('notificaciones_whatsapp').insert({
      company_id: companyId,
      contact_id: contactId || null,
      proveedor_id: proveedorId || null,
      telefono: to,
      mensaje: body,
      twilio_sid: data.sid,
      estado: 'enviado',
    })
  } catch {}

  return data
}

export async function obtenerHistorialWhatsappProveedor(proveedorId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('notificaciones_whatsapp')
    .select('*')
    .eq('proveedor_id', proveedorId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data || []
}
