import { getSupabase } from '@saas/core'

let cache = null

export async function listarUnidadesMedida() {
  if (cache) return cache
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('listar_unidades_medida')
  if (error) throw error
  cache = data || []
  return cache
}

export function mapUnidad(codigo) {
  if (!cache) return codigo
  const u = cache.find((c) => c.codigo === Number(codigo) || c.sigla === codigo)
  return u ? u.sigla : codigo
}
