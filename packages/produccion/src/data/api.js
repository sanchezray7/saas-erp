import { getSupabase } from '@saas/core'

export async function produccionFetch(action, params = {}) {
  const supabase = getSupabase()
  const { data, error } = await supabase.functions.invoke('produccion-data', {
    body: { action, ...params },
  })
  if (error) throw new Error(error.message || 'Error al consultar producción')
  return data
}
