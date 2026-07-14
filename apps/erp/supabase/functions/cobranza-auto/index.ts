// Edge Function: cobranza-auto
// Revisa facturas aprobadas y envía WhatsApp automáticos según la config
// de cada empresa.
//
// Llamada programada (cron): todos los días a las 8:00
//   GET /cobranza-auto?key=<SECRET_KEY>
//
// Despliegue:
//   supabase functions deploy cobranza-auto
//   supabase secrets set COBRANZA_SECRET_KEY=<valor>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const COBRANZA_SECRET = Deno.env.get('COBRANZA_SECRET_KEY') || ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function enviarWhatsApp(admin, to, body) {
  const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')
  const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')
  const TWILIO_WHATSAPP_FROM = Deno.env.get('TWILIO_WHATSAPP_FROM')
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) return null

  const basicAuth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: `whatsapp:${TWILIO_WHATSAPP_FROM}`,
        To: `whatsapp:${to}`,
        Body: body,
      }),
    },
  )
  const data = await res.json()
  return res.ok ? { sid: data.sid } : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Validar clave secreta
  const url = new URL(req.url)
  const key = url.searchParams.get('key') || ''
  if (COBRANZA_SECRET && key !== COBRANZA_SECRET) {
    return json({ error: 'Clave inválida' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SERVICE_ROLE_KEY')!

  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Falta SERVICE_ROLE_KEY' }, 500)
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const now = new Date()
  const hoy = now.toISOString().slice(0, 10)
  const resultados = []
  let enviados = 0
  let errores = 0

  try {
    // Obtener todas las configuraciones activas
    const { data: configs, error: cfgError } = await admin
      .from('cobranza_config')
      .select('*')
      .eq('activo', true)

    if (cfgError) throw cfgError

    for (const cfg of configs || []) {
      // Buscar facturas aprobadas con vencimiento
      const { data: facturas, error: facError } = await admin
        .from('facturas')
        .select('*, contact:contact_id(id, name, phone)')
        .eq('company_id', cfg.company_id)
        .eq('estado', 'aprobada')
        .not('fecha_vencimiento', 'is', null)
        .not('contact_id', 'is', null)

      if (facError) continue

      for (const fac of facturas || []) {
        try {
          const venc = new Date(fac.fecha_vencimiento)
          const diffDias = Math.ceil((venc.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          const ultimo = fac.ultimo_recordatorio ? new Date(fac.ultimo_recordatorio) : null
          const diasDesdeUltimo = ultimo ? Math.ceil((now.getTime() - ultimo.getTime()) / (1000 * 60 * 60 * 24)) : 999

          // Determinar si debe enviar recordatorio
          let debeEnviar = false
          let tipoRecordatorio = ''

          // Primer recordatorio: X días antes del vencimiento
          if ((fac.recordatorios_enviados || 0) === 0 && diffDias <= cfg.dias_antes && diffDias >= 0) {
            debeEnviar = true
            tipoRecordatorio = 'PREVENCIMIENTO'
          }
          // Segundo recordatorio: Y días después del vencimiento
          if ((fac.recordatorios_enviados || 0) === 1 && diffDias < 0 && Math.abs(diffDias) >= cfg.dias_despues) {
            debeEnviar = true
            tipoRecordatorio = 'VENCIDA'
          }
          // Recordatorios subsiguientes: cada intervalo_dias
          if ((fac.recordatorios_enviados || 0) >= 2 && diffDias < 0 && diasDesdeUltimo >= cfg.intervalo_dias) {
            debeEnviar = true
            tipoRecordatorio = 'REITERACION'
          }

          if (!debeEnviar) continue

          const telefono = fac.contact?.phone
          if (!telefono) continue

          // Construir mensaje
          const monto = Number(fac.total || 0).toLocaleString('es')
          const moneda = fac.moneda || 'PYG'
          const fechaVenc = venc.toLocaleDateString('es')
          const numeroFactura = fac.numero || fac.cdc?.slice(0, 12) || '—'

          let mensaje = ''
          if (tipoRecordatorio === 'PREVENCIMIENTO') {
            mensaje = `📄 *Recordatorio de pago*\n\nHola ${fac.contact.name},\nTe recordamos que la factura *${numeroFactura}* por *${moneda} ${monto}* vence el *${fechaVenc}*.\n\nPor favor, realizá el pago antes de la fecha de vencimiento.\n\n¡Gracias!`
          } else {
            mensaje = `⚠️ *Factura vencida*\n\nHola ${fac.contact.name},\nLa factura *${numeroFactura}* por *${moneda} ${monto}* venció el *${fechaVenc}* y se encuentra pendiente de pago.\n\nTe solicitamos regularizar a la brevedad.\n\n¡Gracias!`
          }

          // Enviar WhatsApp
          const twilioRes = await enviarWhatsApp(admin, telefono, mensaje)
          if (!twilioRes) {
            errores++
            continue
          }

          // Crear actividad
          await admin.from('activities').insert({
            company_id: fac.company_id,
            contact_id: fac.contact_id,
            type: 'note',
            subject: `💬 Cobranza: ${numeroFactura} (${tipoRecordatorio})`,
            description: mensaje,
          }).maybeSingle()

          // Actualizar factura
          await admin.from('facturas').update({
            ultimo_recordatorio: now.toISOString(),
            recordatorios_enviados: (fac.recordatorios_enviados || 0) + 1,
          }).eq('id', fac.id)

          // Log
          await admin.from('notificaciones_whatsapp').insert({
            company_id: fac.company_id,
            contact_id: fac.contact_id,
            telefono,
            mensaje,
            twilio_sid: twilioRes.sid,
            estado: 'cobranza_automatica',
          }).maybeSingle()

          enviados++
          resultados.push({ factura: fac.numero || fac.id, contacto: fac.contact.name, tipoRecordatorio })
        } catch {
          errores++
        }
      }
    }
  } catch (err) {
    console.error('[cobranza-auto] Error:', err)
    return json({ error: err.message }, 500)
  }

  return json({
    ok: true,
    fecha: hoy,
    enviados,
    errores,
    detalle: resultados,
  })
})
