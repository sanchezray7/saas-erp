import { getSupabase } from '@saas/core'

export async function crearUsuario(companyId, email, password, role = 'vendedor', fullName = '', phone = '') {
  const supabase = getSupabase()
  const { data, error } = await supabase.functions.invoke('crear-usuario', {
    body: { company_id: companyId, email, password, role, full_name: fullName, phone },
  })
  if (error) {
    const msg = data?.error || error.message || 'Error al crear usuario'
    console.error('[crear-usuario]', error, data)
    throw new Error(msg)
  }
  if (data?.error) throw new Error(data.error)
  return data
}
