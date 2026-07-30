// ai-provider.js — Abstraction layer for AI completions
//
// Supported providers (set via AI_PROVIDER env var):
//   openai, together, groq, anthropic, ollama
//
// Each provider needs its own API key env var:
//   OPENAI_API_KEY, TOGETHER_API_KEY, GROQ_API_KEY,
//   ANTHROPIC_API_KEY, OLLAMA_API_KEY (or OLLAMA_BASE_URL)
//
// Fallback: AI_API_KEY is used if provider-specific key is not set.

const PROVIDERS = {
  openai: {
    defaultModel: 'gpt-4o-mini',
    url: 'https://api.openai.com/v1/chat/completions',
    headers(apiKey) {
      return {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      }
    },
    buildBody(messages, model, opts) {
      return { model, messages, temperature: opts.temperature ?? 0.7, max_tokens: opts.max_tokens ?? 1024 }
    },
    parseResponse(data) {
      return {
        content: data.choices?.[0]?.message?.content ?? '',
        model: data.model,
        usage: data.usage || {},
      }
    },
  },

  together: {
    defaultModel: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
    url: 'https://api.together.xyz/v1/chat/completions',
    headers(apiKey) {
      return {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      }
    },
    buildBody(messages, model, opts) {
      return { model, messages, temperature: opts.temperature ?? 0.7, max_tokens: opts.max_tokens ?? 1024 }
    },
    parseResponse(data) {
      return {
        content: data.choices?.[0]?.message?.content ?? '',
        model: data.model,
        usage: data.usage || {},
      }
    },
  },

  groq: {
    defaultModel: 'llama-3.3-70b-versatile',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    headers(apiKey) {
      return {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      }
    },
    buildBody(messages, model, opts) {
      return { model, messages, temperature: opts.temperature ?? 0.7, max_tokens: opts.max_tokens ?? 1024 }
    },
    parseResponse(data) {
      return {
        content: data.choices?.[0]?.message?.content ?? '',
        model: data.model,
        usage: data.usage || {},
      }
    },
  },

  anthropic: {
    defaultModel: 'claude-3-haiku-20240307',
    url: 'https://api.anthropic.com/v1/messages',
    headers(apiKey) {
      return {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      }
    },
    buildBody(messages, model, opts) {
      // Anthropic uses a different format: system + messages[]
      const systemMsg = messages.find((m) => m.role === 'system')
      const msgs = messages.filter((m) => m.role !== 'system')
      const body = {
        model,
        messages: msgs.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: opts.max_tokens ?? 1024,
      }
      if (systemMsg) body.system = systemMsg.content
      if (opts.temperature != null) body.temperature = opts.temperature
      return body
    },
    parseResponse(data) {
      return {
        content: data.content?.[0]?.text ?? '',
        model: data.model,
        usage: data.usage || {},
      }
    },
  },

  ollama: {
    defaultModel: 'llama3',
    url: null, // computed from OLLAMA_BASE_URL or defaults to localhost
    headers() {
      return { 'Content-Type': 'application/json' }
    },
    buildBody(messages, model, opts) {
      return { model, messages, stream: false, options: { temperature: opts.temperature ?? 0.7, num_predict: opts.max_tokens ?? 1024 } }
    },
    parseResponse(data) {
      return {
        content: data.message?.content ?? data.response ?? '',
        model: data.model,
        usage: { total_tokens: data.eval_count || 0 },
      }
    },
    getUrl() {
      const base = Deno.env.get('OLLAMA_BASE_URL') || 'http://localhost:11434'
      return `${base}/api/chat`
    },
  },
}

/**
 * callAI — Send a completion request to the configured AI provider.
 *
 * @param {Array<{role:string,content:string}>} messages  OpenAI-format messages
 * @param {Object} [options]
 * @param {string}  [options.model]          Override default model
 * @param {number}  [options.temperature=0.7]
 * @param {number}  [options.max_tokens=1024]
 * @returns {Promise<{content:string, model:string, usage:Object}>}
 */
export async function callAI(messages, options = {}) {
  const providerName = (Deno.env.get('AI_PROVIDER') || 'openai').toLowerCase()
  const config = PROVIDERS[providerName]

  if (!config) {
    throw new Error(`AI provider "${providerName}" not supported. Available: ${Object.keys(PROVIDERS).join(', ')}`)
  }

  // API key lookup: <PROVIDER>_API_KEY -> AI_API_KEY
  const envKey = `${providerName.toUpperCase()}_API_KEY`
  const fallbackKey = 'AI_API_KEY'
  const apiKey = Deno.env.get(envKey) || Deno.env.get(fallbackKey)

  if (!apiKey && providerName !== 'ollama') {
    throw new Error(`Missing API key for "${providerName}". Set ${envKey} (or ${fallbackKey}) in Supabase secrets.`)
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
    throw new Error(`AI provider "${providerName}" error (${res.status}): ${errText}`)
  }

  const data = await res.json()
  return config.parseResponse(data)
}
