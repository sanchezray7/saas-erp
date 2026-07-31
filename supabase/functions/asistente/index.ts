import { callAI } from '../_shared/ai-provider.js'
import { HELP } from '../_shared/help-data.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

// Palabras clave por sección (para matchear preguntas con módulos)
const SECTION_KEYWORDS: Record<string, string[]> = {
  ventas: ['venta', 'contacto', 'cliente', 'oportunidad', 'deals', 'cotizacion', 'factura', 'cobrar', 'lead', 'pipeline'],
  compras: ['compra', 'proveedor', 'oc', 'orden', 'mercaderia', 'recepcion', 'factura proveedor', 'pago proveedor', 'scorecard', 'sugerencia'],
  finanzas: ['contabilidad', 'cuenta', 'asiento', 'impuesto', 'iva', 'balance', 'reporte', 'aging', 'conciliacion', 'nota credito', 'nota debito'],
  inventario: ['stock', 'inventario', 'almacen', 'centro', 'movimiento', 'transferencia', 'kardex', 'conteo', 'ubicacion', 'transportista', 'picking', 'remito', 'valuacion'],
  catalogo: ['producto', 'catalogo', 'categoria', 'precio', 'codigo barras', 'sticker', 'servicio'],
  pos: ['pos', 'punto de venta', 'caja', 'cobro', 'ticket', 'cierre', 'qr'],
  rrhh: ['empleado', 'rrhh', 'asistencia', 'ausencia', 'vacaciones', 'turno', 'control horario', 'organigrama'],
  nomina: ['nomina', 'sueldo', 'recibo', 'salario', 'liquidacion', 'libro sueldos', 'aguinaldo', 'ips'],
  produccion: ['produccion', 'receta', 'orden produccion', 'merma', 'lote', 'wip'],
  servicios: ['servicio', 'presupuesto', 'orden trabajo', 'ot'],
}

// Palabras clave por módulo dentro de cada sección (más específico)
function buildModuleKeywords(): { section: string, title: string, keywords: string[] }[] {
  const list: { section: string, title: string, keywords: string[] }[] = []
  for (const [sectionKey, section] of Object.entries(HELP)) {
    const seccion = section as any
    if (!seccion.modulos) continue
    for (const mod of seccion.modulos) {
      const titleWords = (mod.titulo || '')
        .replace(/^\d+\.\s*/, '')
        .toLowerCase()
        .split(/\s+/)
        .filter((w: string) => w.length > 3)
      list.push({ section: sectionKey, title: mod.titulo || '', keywords: titleWords })
    }
  }
  return list
}

const MODULE_INDEX = buildModuleKeywords()

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// Buscar módulos relevantes por coincidencia de keywords en la pregunta
function findRelevantModules(message: string, maxResults = 3): { section: string, title: string, content: string }[] {
  const msg = normalize(message)
  const results: { score: number, section: string, title: string, content: string }[] = []
  const section = (HELP as any)

  for (const [sectionKey, sectionObj] of Object.entries(HELP)) {
    const seccion = sectionObj as any
    if (!seccion.modulos) continue

    // Keywords de la sección
    const sectionKeys = SECTION_KEYWORDS[sectionKey] || []
    let sectionScore = 0
    for (const kw of sectionKeys) {
      if (msg.includes(normalize(kw))) sectionScore += 2
    }

    for (const mod of seccion.modulos) {
      let score = sectionScore
      const titleNorm = normalize(mod.titulo || '')
      // Matchear palabras del título en el mensaje
      for (const word of titleNorm.replace(/^\d+\.\s*/, '').split(/\s+/)) {
        if (word.length > 3 && msg.includes(word)) score += 3
      }
      // Matchear descripción
      const descNorm = normalize(mod.descripcion || '')
      const descWords = descNorm.split(/\s+/).filter((w: string) => w.length > 5)
      for (const word of descWords) {
        if (msg.includes(word)) score += 1
      }

      if (score > 0) {
        results.push({ score, section: sectionKey, title: mod.titulo || '', content: buildModuleText(mod) })
      }
    }
  }

  results.sort((a, b) => b.score - a.score)
  return results.slice(0, maxResults).map(({ section, title, content }) => ({ section, title, content }))
}

function buildModuleText(mod: any): string {
  const parts: string[] = []
  if (mod.descripcion) parts.push(`Descripción: ${mod.descripcion}`)
  if (Array.isArray(mod.pasos)) {
    parts.push('Pasos:')
    mod.pasos.forEach((p: string) => parts.push(`- ${p.replace(/\*\*/g, '"')}`))
  }
  if (Array.isArray(mod.tips)) {
    parts.push('Consejos:')
    mod.tips.forEach((t: string) => parts.push(`- ${t.replace(/\*\*/g, '"')}`))
  }
  return parts.join('\n')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  try {
    const { message, locale = 'es' } = await req.json()
    if (!message || typeof message !== 'string') return json({ error: 'Falta mensaje' }, 400)

    const relevant = findRelevantModules(message)
    const hasHelp = relevant.length > 0

    let systemPrompt: string
    let userPrompt: string

    if (hasHelp) {
      const helpBlock = relevant.map((r, i) =>
        `--- Módulo ${i + 1}: ${r.title} (sección ${r.section}) ---\n${r.content}`
      ).join('\n\n')

      systemPrompt = `Sos el asistente virtual del ERP "Saas Empresarial".
Tenés acceso a guías oficiales del sistema. Respondé SIEMPRE basándote en la guía provista, en lenguaje claro y amigable.
Si la pregunta no coincide exactamente con la guía, usala como referencia y respondé lo mejor posible.
Formateá la respuesta con pasos numerados cuando corresponda. Respondé en ${locale === 'en' ? 'inglés' : locale === 'pt-BR' ? 'portugués' : 'español'}.`

      userPrompt = `Pregunta del usuario: "${message}"

Guías relevantes encontradas en el sistema:
${helpBlock}

Respondé ayudando al usuario paso a paso.`
    } else {
      systemPrompt = `Sos el asistente virtual del ERP "Saas Empresarial".
Ayudás a los usuarios a usar el sistema: CRM, facturación, inventario, compras, contabilidad, RRHH, nómina, POS, producción y servicios.
Respondé de forma clara y amigable. Si no sabés algo específico, orientá al usuario a la sección Ayuda del sistema.
Respondé en ${locale === 'en' ? 'inglés' : locale === 'pt-BR' ? 'portugués' : 'español'}.`

      userPrompt = `Pregunta del usuario: "${message}"`
    }

    const result = await callAI(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.3, max_tokens: 800 },
    )

    return json({
      respuesta: result.content,
      encontro_guia: hasHelp,
      modulos: relevant.map((r) => r.title),
      model: result.model,
    })
  } catch (err) {
    console.error('asistente error:', err.message)
    return json({ error: err.message }, 500)
  }
})
