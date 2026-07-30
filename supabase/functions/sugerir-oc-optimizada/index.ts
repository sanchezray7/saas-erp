import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callAI } from '../_shared/ai-provider.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  try {
    const { company_id, productos } = await req.json()
    if (!company_id || !productos?.length) return json({ error: 'Faltan datos' }, 400)

    // Obtener scorecards de todos los proveedores involucrados
    const proveedorIds = [...new Set(productos.flatMap((p: any) => p.proveedores?.map((pr: any) => pr.proveedor_id) || []))]
    const { data: scorecards } = await admin.from('proveedor_scorecard')
      .select('*').in('proveedor_id', proveedorIds)

    const scoreMap: Record<string, any> = {}
    for (const sc of (scorecards || [])) {
      scoreMap[sc.proveedor_id] = sc
    }

    // Armar prompt
    const productLines = productos.map((p: any) => {
      const suppliers = (p.proveedores || []).map((pr: any) => {
        const sc = scoreMap[pr.proveedor_id]
        const scoreStr = sc ? `Score: ${sc.puntaje_general}/5 (entrega:${sc.entrega_tiempo}, calidad:${sc.calidad})` : 'Score: sin datos'
        return `  - ${pr.proveedor_nombre}: $${Number(pr.precio).toLocaleString()} ${pr.moneda || 'USD'} | ${scoreStr}`
      }).join('\n')

      const faltante = Math.max(0, Number(p.stock_minimo) - Number(p.stock_total))
      const cantSugerida = Math.max(faltante, Number(p.stock_minimo))

      return `Producto: ${p.producto_nombre} (código: ${p.producto_codigo || 'N/A'})
Stock actual: ${Number(p.stock_total).toLocaleString()} | Mínimo: ${Number(p.stock_minimo).toLocaleString()} | Cant. sugerida base: ${cantSugerida}
Proveedores disponibles:
${suppliers}`
    }).join('\n\n')

    const systemPrompt = `Sos un asistente de compras experto en optimización de órdenes de compra.
Tu tarea es recomendar el MEJOR proveedor para cada producto, balanceando precio y calidad (scorecard).

REGLAS:
- Priorizá la mejor relación calidad-precio, no solo el más barato
- Si un proveedor tiene scorecard bajo (< 3.0), evitarlo aunque sea más barato
- Si hay poca diferencia de precio (< 5%), priorizá el de mejor scorecard
- La cantidad sugerida debe ser suficiente para cubrir el faltante más un buffer

Devolvé SOLO un JSON válido sin explicaciones adicionales, con este formato exacto:
{
  "sugerencias": [
    {
      "producto_id": "uuid-del-producto",
      "producto_nombre": "nombre del producto (para identificación)",
      "proveedor_id": "uuid-del-proveedor-seleccionado",
      "cantidad": numero,
      "justificacion": "Breve explicación de la decisión (máx 100 caracteres)"
    }
  ]
}`

    const userPrompt = `Analizá estos productos con stock bajo y recomendá el mejor proveedor:\n\n${productLines}`

    const result = await callAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { temperature: 0.3, max_tokens: 2000 })

    // Parsear la respuesta JSON
    const text = result.content.trim()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('La IA no devolvió JSON válido')
    const parsed = JSON.parse(jsonMatch[0])

    return json({
      sugerencias: (parsed.sugerencias || []).map((s: any) => ({
        ...s,
        justificacion: s.justificacion || s.justificación || s.razon || s.motivo || 'Optimizado por IA',
      })),
      model: result.model,
      usage: result.usage,
    })
  } catch (err) {
    console.error('sugerir-oc-optimizada error:', err.message)
    return json({ error: err.message }, 500)
  }
})
