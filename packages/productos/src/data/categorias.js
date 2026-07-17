import { getSupabase } from '@saas/core'

export async function listarCategorias(companyId, tipo) {
  const supabase = getSupabase()
  let q = supabase.from('categorias').select('*').eq('company_id', companyId).order('nombre')
  if (tipo) q = q.eq('tipo', tipo)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function guardarCategoria(companyId, cat) {
  const supabase = getSupabase()
  const payload = { company_id: companyId, ...cat }
  delete payload.id
  if (cat.id) payload.id = cat.id
  const { data, error } = await supabase.from('categorias').upsert(payload).select().single()
  if (error) throw error
  return data
}

export async function eliminarCategoria(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('categorias').delete().eq('id', id)
  if (error) throw error
}

export const COLORES_CATEGORIA = [
  { value: '#f59e0b', label: 'Ámbar' },
  { value: '#3b82f6', label: 'Azul' },
  { value: '#22c55e', label: 'Verde' },
  { value: '#8b5cf6', label: 'Púrpura' },
  { value: '#ef4444', label: 'Rojo' },
  { value: '#64748b', label: 'Gris' },
  { value: '#06b6d4', label: 'Cian' },
  { value: '#f97316', label: 'Naranja' },
  { value: '#14b8a6', label: 'Teal' },
  { value: '#ec4899', label: 'Rosa' },
]

export const ICONOS_CATEGORIA = ['📦', '🍞', '🥤', '🧀', '🥩', '🥬', '🧹', '💻', '📋', '🎓', '🔧', '📊', '🎨', '🏗️']
