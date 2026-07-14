import { callAI } from '../_shared/ai-provider.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { context, subject, body, instructions } = await req.json()

    if (!context) {
      return new Response(JSON.stringify({ error: 'context es requerido (contact, deal o lead)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const contextDescriptions = {
      contact: 'Email para un contacto comercial. Saludar por nombre, mencionar empresa, ofrecer valor.',
      deal: 'Email relacionado a una oportunidad de venta. Mencionar el deal, la etapa, y avanzar la negociación.',
      lead: 'Email de seguimiento para un lead que llegó por webhook. Agradecer el interés y proponer próximo paso.',
    }

    const ctxDesc = contextDescriptions[context] || 'Email profesional.'

    const systemPrompt = `Eres un redactor de correos comerciales experto. Tu tarea es generar el asunto y cuerpo de un email profesional.

Contexto: ${ctxDesc}

Reglas:
- Asunto: conciso, atractivo, máximo 60 caracteres, sin etiquetas HTML
- Cuerpo: tono profesional, estructura clara (saludo → introducción → cuerpo → llamado a la acción → despedida)
- Usa variables {{...}} del contexto donde sea natural: {{contacto.nombre}}, {{contacto.empresa}}, {{deal.titulo}}, {{usuario.nombre}}, {{empresa.nombre}}, etc.
- No inventes datos concretos que no estén en las variables — usa las variables como placeholder
- Responde ÚNICAMENTE con un JSON en este formato exacto, sin texto adicional:
{"subject": "asunto generado", "body": "cuerpo del email generado"}`

    const userPrompt = `Contexto: ${context}
Asunto actual: "${subject || '(vacío)'}"
Cuerpo actual: "${body || '(vacío)'}"
${instructions ? `Instrucciones adicionales: ${instructions}` : 'Instrucciones: genera un email profesional y persuasivo'}`

    const result = await callAI(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.7, max_tokens: 1024 },
    )

    let parsed
    try {
      parsed = JSON.parse(result.content)
    } catch {
      const match = result.content.match(/\{[\s\S]+\}/)
      if (match) parsed = JSON.parse(match[0])
      else throw new Error('No se pudo parsear la respuesta del modelo')
    }

    return new Response(JSON.stringify({
      subject: parsed.subject || '',
      body: parsed.body || '',
      model: result.model,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('draft-email error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
