// Edge Function: whatsapp-webhook
// Recibe mensajes entrantes de WhatsApp desde Twilio y los registra
// como actividades en el timeline del contacto correspondiente.
//
// Configurar en Twilio Console:
//   WhatsApp -> Sandbox -> "When a message comes in"
//   URL: https://<ref>.supabase.co/functions/v1/whatsapp-webhook
//   Method: HTTP POST
//
// Despliegue:
//   supabase functions deploy whatsapp-webhook

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TWILIO_WHATSAPP_FROM = Deno.env.get('TWILIO_WHATSAPP_FROM')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Twilio puede enviar form-urlencoded o JSON
    let from, bodyText, messageSid
    const contentType = req.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      const payload = await req.json()
      from = payload.From || payload.from
      bodyText = payload.Body || payload.body
      messageSid = payload.SmsMessageSid || payload.MessageSid
    } else {
      const form = await req.formData()
      from = form.get('From')?.toString() || ''
      bodyText = form.get('Body')?.toString() || ''
      messageSid = form.get('SmsMessageSid')?.toString() || ''
    }

    // Validar que sea un mensaje de WhatsApp
    if (!from || !from.startsWith('whatsapp:')) {
      return json({ error: 'Solo se aceptan mensajes de WhatsApp' }, 400)
    }

    const numero = from.replace('whatsapp:', '').replace(/\s/g, '')

    if (!bodyText) {
      return json({ error: 'Mensaje vacio' }, 400)
    }

    // Inicializar admin client para operaciones con servicio
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Buscar contacto por teléfono
    // Buscar coincidencia exacta o parcial (últimos 10 dígitos)
    const ultimos10 = numero.slice(-10)
    const { data: contactos, error: searchError } = await admin
      .from('contacts')
      .select('id, company_id, name')
      .or(`phone.eq.${numero},phone.ilike.%${ultimos10}`)
      .limit(1)

    if (searchError) {
      console.error('[whatsapp-webhook] Error buscando contacto:', searchError)
      return json({ error: 'Error al buscar contacto' }, 500)
    }

    // También buscar en proveedores
    const { data: proveedores } = await admin
      .from('proveedores')
      .select('id, company_id, nombre')
      .or(`telefono.eq.${numero},telefono.ilike.%${ultimos10}`)
      .limit(1)

    const contacto = contactos?.[0]
    const proveedor = proveedores?.[0]

    if (!contacto && !proveedor) {
      console.warn(`[whatsapp-webhook] Contacto/Proveedor no encontrado para número: ${numero}`)
      // Guardar log aunque no haya match
      try {
        await admin.from('notificaciones_whatsapp').insert({
          company_id: null,
          telefono: numero,
          mensaje: bodyText,
          twilio_sid: messageSid || null,
          estado: 'recibido_sin_contacto',
        })
      } catch {}
      return json({ ok: true, contact_found: false })
    }

    const companyId = contacto?.company_id || proveedor?.company_id

    // Crear actividad en el timeline (solo si hay contacto)
    let activity
    if (contacto) {
      const subject = `💬 WhatsApp: ${numero}`
      const { data: act, error: actError } = await admin
        .from('activities')
        .insert({
          company_id: companyId,
          contact_id: contacto.id,
          type: 'note',
          subject: subject.slice(0, 255),
          description: bodyText,
          created_by: null,
        })
        .select('id')
        .single()

      if (actError) {
        console.error('[whatsapp-webhook] Error creando actividad:', actError)
      } else {
        activity = act
      }
    }

    // Log en tabla de auditoría
    try {
      await admin.from('notificaciones_whatsapp').insert({
        company_id: companyId,
        contact_id: contacto?.id || null,
        proveedor_id: proveedor?.id || null,
        telefono: numero,
        mensaje: bodyText,
        twilio_sid: messageSid || null,
        estado: 'recibido',
      })
    } catch {}

    const nombre = contacto?.name || proveedor?.nombre || numero
    console.log(`[whatsapp-webhook] Mensaje de ${nombre} (${numero}) registrado`)

    return json({
      ok: true,
      contact_found: !!contacto,
      supplier_found: !!proveedor,
      contact_id: contacto?.id || null,
      supplier_id: proveedor?.id || null,
      contact_name: nombre,
      activity_id: activity?.id,
    })
  } catch (err) {
    console.error('[whatsapp-webhook] Error:', err)
    return json({ error: err.message }, 500)
  }
})
