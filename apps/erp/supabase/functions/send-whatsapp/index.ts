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

  const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')
  const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')
  const TWILIO_WHATSAPP_FROM = Deno.env.get('TWILIO_WHATSAPP_FROM')

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
    return json({ error: 'Faltan variables de Twilio en secrets' }, 500)
  }

  try {
    const { to, body } = await req.json()
    if (!to || !body) return json({ error: 'Faltan campos: to, body' }, 400)

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
    if (!res.ok) throw new Error(data.message || 'Error Twilio')

    return json({ success: true, sid: data.sid })
  } catch (err) {
    return json({ error: err.message }, 500)
  }
})
