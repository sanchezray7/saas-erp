// Edge Function: consultar-ruc
// Proxy para consultar RUC en rucparaguay.info (evita CORS)
//
// Uso: supabase.functions.invoke('consultar-ruc', { body: { ruc: '80012345-5' } })
//
// Despliegue:
//   supabase functions deploy consultar-ruc
//   (requiere variable de entorno RUC_API_KEY en Supabase)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { ruc } = await req.json()
    if (!ruc || ruc.length < 3) {
      return new Response(JSON.stringify({ error: 'RUC inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = Deno.env.get('RUC_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key no configurada' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const res = await fetch(`https://rucparaguay.info/api/contribuyente/${ruc}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    const data = await res.json()

    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
