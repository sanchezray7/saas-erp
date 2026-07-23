import { getSupabase } from '@saas/core'

export async function serviciosFetch(action, params = {}) {
  const supabase = getSupabase()
  const { data, error } = await supabase.functions.invoke('servicios-data', {
    body: { action, ...params },
  })
  if (error) throw new Error(error.message || 'Error al consultar')
  return data
}
