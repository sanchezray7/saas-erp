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

const PROVIDERS = {
  openai: {
    defaultModel: 'gpt-4o-mini',
    url: 'https://api.openai.com/v1/chat/completions',
    headers(apiKey) {
      return { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
    },
    buildBody(messages, model, opts) {
      return { model, messages, temperature: opts.temperature ?? 0.7, max_tokens: opts.max_tokens ?? 1024 }
    },
    parse(data) {
      return { content: data.choices?.[0]?.message?.content ?? '', model: data.model, usage: data.usage || {} }
    },
  },
  together: {
    defaultModel: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
    url: 'https://api.together.xyz/v1/chat/completions',
    headers(apiKey) {
      return { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
    },
    buildBody(messages, model, opts) {
      return { model, messages, temperature: opts.temperature ?? 0.7, max_tokens: opts.max_tokens ?? 1024 }
    },
    parse(data) {
      return { content: data.choices?.[0]?.message?.content ?? '', model: data.model, usage: data.usage || {} }
    },
  },
  groq: {
    defaultModel: 'llama-3.3-70b-versatile',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    headers(apiKey) {
      return { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
    },
    buildBody(messages, model, opts) {
      return { model, messages, temperature: opts.temperature ?? 0.7, max_tokens: opts.max_tokens ?? 1024 }
    },
    parse(data) {
      return { content: data.choices?.[0]?.message?.content ?? '', model: data.model, usage: data.usage || {} }
    },
  },
  anthropic: {
    defaultModel: 'claude-3-haiku-20240307',
    url: 'https://api.anthropic.com/v1/messages',
    headers(apiKey) {
      return { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }
    },
    buildBody(messages, model, opts) {
      const systemMsg = messages.find((m) => m.role === 'system')
      const msgs = messages.filter((m) => m.role !== 'system')
      const body = { model, messages: msgs.map((m) => ({ role: m.role, content: m.content })), max_tokens: opts.max_tokens ?? 1024 }
      if (systemMsg) body.system = systemMsg.content
      if (opts.temperature != null) body.temperature = opts.temperature
      return body
    },
    parse(data) {
      return { content: data.content?.[0]?.text ?? '', model: data.model, usage: data.usage || {} }
    },
  },
  ollama: {
    defaultModel: 'llama3',
    headers() {
      return { 'Content-Type': 'application/json' }
    },
    buildBody(messages, model, opts) {
      return { model, messages, stream: false, options: { temperature: opts.temperature ?? 0.7, num_predict: opts.max_tokens ?? 1024 } }
    },
    parse(data) {
      return { content: data.message?.content ?? data.response ?? '', model: data.model, usage: { total_tokens: data.eval_count || 0 } }
    },
    getUrl() {
      const base = Deno.env.get('OLLAMA_BASE_URL') || 'http://localhost:11434'
      return `${base}/api/chat`
    },
  },
}

async function callAI(messages, options = {}) {
  const providerName = (Deno.env.get('AI_PROVIDER') || 'openai').toLowerCase()
  const config = PROVIDERS[providerName]
  if (!config) throw new Error(`AI provider "${providerName}" no soportado. Opciones: ${Object.keys(PROVIDERS).join(', ')}`)
  const envKey = `${providerName.toUpperCase()}_API_KEY`
  const apiKey = Deno.env.get(envKey) || Deno.env.get('AI_API_KEY')
  if (!apiKey && providerName !== 'ollama') {
    throw new Error(`Falta API key para "${providerName}". Configura ${envKey} (o AI_API_KEY) en secrets.`)
  }
  const model = options.model || config.defaultModel
  const body = config.buildBody(messages, model, options)
  const url = config.getUrl ? config.getUrl() : config.url
  const res = await fetch(url, {
    method: 'POST',
    headers: config.headers(apiKey || ''),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let errText = ''
    try { errText = await res.text() } catch { errText = res.statusText }
    throw new Error(`Error del proveedor "${providerName}" (${res.status}): ${errText}`)
  }
  return config.parse(await res.json())
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  try {
    const { contacto, actividades, deals } = await req.json()
    if (!contacto) return json({ error: 'contacto es requerido' }, 400)

    const actStr = (actividades || [])
      .map((a) => `[${a.type}] ${a.subject}${a.description ? ': ' + a.description : ''} (${(a.created_at || '').slice(0, 10)})${a.done ? ' ✓' : ''}`)
      .join('\n')

    const dealStr = (deals || [])
      .map((d) => `Deal: ${d.title} | Valor: ${d.value} | Etapa: ${d.stage_name || '—'}`)
      .join('\n')

    const systemPrompt = `Eres un experto en scoring de leads para CRM. Analizas contactos y asignas un puntaje del 1 al 100 según su probabilidad de conversión.

Reglas:
- 1-33: Frío — poca actividad, sin deals abiertos, fuente desconocida
- 34-66: Tibio — actividad reciente, deals en etapas tempranas
- 67-100: Caliente — alta actividad, deals en negociación/cierre, engagement reciente

Factores a considerar:
- Días desde la última actividad (engagement)
- Cantidad y tipo de actividades (llamadas pesan más)
- Deals abiertos y su valor
- Etapa del pipeline del deal
- Fuente del lead
- Notas internas

Responde ÚNICAMENTE con un JSON en este formato exacto, sin texto adicional:
{"score": NUMERO, "reasoning": "Explicación breve en español (1-2 líneas)"}`

    const userPrompt = `Evalúa este lead y devuelve el JSON con score y reasoning.

Contacto:
- Nombre: ${contacto.name}
- Email: ${contacto.email || '—'}
- Teléfono: ${contacto.phone || '—'}
- Cargo: ${contacto.position || '—'}
- Fuente: ${contacto.source || '—'}
- Notas: ${contacto.notes || '—'}
- Creado: ${(contacto.created_at || '').slice(0, 10) || '—'}

Actividades:
${actStr || '(sin actividades)'}

Deals:
${dealStr || '(sin deals)'}`

    const result = await callAI(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.3, max_tokens: 256 },
    )

    // Parsear JSON de la respuesta
    let parsed
    try {
      parsed = JSON.parse(result.content)
    } catch {
      // Si el modelo no devuelve JSON puro, extraer con regex
      const match = result.content.match(/\{[^}]+\}/)
      if (match) parsed = JSON.parse(match[0])
      else throw new Error('No se pudo parsear el score del lead')
    }

    return json({
      score: Math.max(1, Math.min(100, parsed.score || 50)),
      reasoning: parsed.reasoning || '',
      model: result.model,
    })
  } catch (err) {
    console.error('score-contact error:', err)
    return json({ error: err.message, stack: err.stack }, 500)
  }
})
