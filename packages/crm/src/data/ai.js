import { getSupabase } from '@saas/core'

async function fetchContactData(contactId) {
  const supabase = getSupabase()
  const [contacto, actividades, deals, stages] = await Promise.all([
    supabase.from('contacts').select('name, email, phone, position, notes, source, created_at').eq('id', contactId).single().then(r => r.data),
    supabase.from('activities').select('type, subject, description, created_at, done').eq('contact_id', contactId).order('created_at', { ascending: false }).limit(20).then(r => r.data || []),
    supabase.from('deals').select('title, value, stage_id, notes, created_at').eq('contact_id', contactId).order('created_at', { ascending: false }).limit(10).then(r => r.data || []),
    supabase.from('stages').select('id, name').then(r => r.data || []),
  ])
  const stageMap = Object.fromEntries(stages.map((s) => [s.id, s.name]))
  const dealsWithStage = deals.map((d) => ({
    title: d.title, value: d.value, notes: d.notes, created_at: d.created_at,
    stage_name: stageMap[d.stage_id] || '—',
  }))
  return { contacto, actividades, deals: dealsWithStage }
}

async function extractError(error) {
  let detail = error.message
  try {
    const ctx = error?.context
    if (ctx instanceof Response) {
      const body = await ctx.clone().text()
      try {
        const parsed = JSON.parse(body)
        if (parsed.error) detail = parsed.error
      } catch {
        detail = `${ctx.status}: ${body.slice(0, 200)}`
      }
    } else if (typeof ctx?.data === 'string') {
      const parsed = JSON.parse(ctx.data)
      if (parsed.error) detail = parsed.error
    }
  } catch {}
  return detail
}

async function invokeEF(name, body) {
  const supabase = getSupabase()
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.error)
  return data
}

export async function draftEmail({ context, subject, body, instructions }) {
  return invokeEF('draft-email', { context, subject, body, instructions })
}

export async function summarizeContact(contactId) {
  const supabase = getSupabase()
  const { contacto, actividades, deals } = await fetchContactData(contactId)
  const data = await invokeEF('summarize-contact', { contacto, actividades, deals })
  // Cachear resumen
  try {
    await supabase.from('contacts').update({
      ai_summary: data.summary, summary_updated_at: new Date().toISOString(),
    }).eq('id', contactId)
  } catch {}
  return data
}

export async function scoreContact(contactId) {
  const supabase = getSupabase()
  const { contacto, actividades, deals } = await fetchContactData(contactId)
  const data = await invokeEF('score-contact', { contacto, actividades, deals })
  // Cachear score
  try {
    await supabase.from('contacts').update({
      score: data.score, score_reasoning: data.reasoning, last_scored_at: new Date().toISOString(),
    }).eq('id', contactId)
  } catch {}
  return data
}
