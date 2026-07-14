import { getSupabase } from '@saas/core'

let cache = null

export async function listarPaises() {
  if (cache) return cache
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('listar_paises')
  if (error) throw error
  cache = data || []
  return cache
}

export function getPaisMap(paises) {
  const map = {}
  for (const p of paises) {
    map[p.codigo] = p
  }
  return map
}
