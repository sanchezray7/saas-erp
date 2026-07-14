import { getSupabase } from '@saas/core'

let cache = null

export async function listarActividades() {
  if (cache) return cache
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('listar_actividades_economicas')
  if (error) throw error
  cache = data || []
  return cache
}
