// Edge Function: send-push
// Envía notificaciones push a un usuario específico.
//
// Body: { user_id, title, body, url?, icon? }
// Requiere JWT + VAPID keys en secrets

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Falta SERVICE_ROLE_KEY' }, 500)
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    const { user_id, title, body, url, icon } = await req.json()

    if (!user_id || !title) {
      return json({ error: 'user_id y title son requeridos' }, 400)
    }

    // Obtener suscripciones del usuario
    const { data: subs, error: subError } = await admin
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', user_id)

    if (subError) throw subError
    if (!subs || subs.length === 0) {
      return json({ ok: true, enviados: 0, motivo: 'sin_suscripcion' })
    }

    const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || ''
    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || ''

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return json({ error: 'Faltan VAPID keys en secrets' }, 500)
    }

    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)

    let enviados = 0

    for (const row of subs) {
      try {
        const sub = row.subscription
        const payload = JSON.stringify({ title, body: body || '', icon: icon || '/icons/icon-192.svg', url: url || '/' })

        // Usar Web Push API directamente vía fetch
        const res = await fetch(sub.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'TTL': '86400',
          },
          body: payload,
        })

        if (res.ok) {
          enviados++
        } else if (res.status === 410) {
          // Suscripción expirada
          await admin.from('push_subscriptions').delete().eq('user_id', user_id)
        }
      } catch {}
    }

    return json({ ok: true, enviados })
  } catch (err) {
    console.error('[send-push] Error:', err)
    return json({ error: err.message }, 500)
  }
})

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}
