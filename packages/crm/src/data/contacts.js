import { getSupabase } from '@saas/core'

const CAMPOS_BASE = ['id', 'name', 'email', 'phone', 'position', 'organization_id', 'source', 'notes', 'assigned_to', 'company_id']
const CAMPOS_FISCALES = ['ruc', 'dv', 'tipo_documento', 'num_documento', 'pais', 'direccion', 'codigo_cliente']

export async function listarContactos(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('contacts')
    .select('*, organization:organization_id(name)')
    .eq('company_id', companyId)
    .order('name')
  if (error) throw error
  return data || []
}

export async function obtenerContacto(id) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('contacts')
    .select('*, organization:organization_id(name)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function guardarContacto(companyId, contact) {
  const supabase = getSupabase()

  // Construir payload solo con campos base (siempre existen)
  const payload = { company_id: companyId }
  for (const campo of CAMPOS_BASE) {
    if (campo in contact) payload[campo] = contact[campo]
  }
  delete payload.id // se upserta sin id para crear, con id para actualizar
  if (contact.id) payload.id = contact.id
  if (!payload.organization_id) payload.organization_id = null
  if (!payload.assigned_to) payload.assigned_to = null

  // Agregar campos fiscales solo si existen en el formulario
  for (const campo of CAMPOS_FISCALES) {
    if (contact[campo] !== undefined) {
      payload[campo] = contact[campo] || null
    }
  }
  if (payload.tipo_documento === '' || payload.tipo_documento === null) payload.tipo_documento = null

  const { data, error } = await supabase
    .from('contacts')
    .upsert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function eliminarContacto(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('contacts').delete().eq('id', id)
  if (error) throw error
}

export async function importarContactos(companyId, rows) {
  const supabase = getSupabase()
  const payload = rows.map((r) => ({ ...r, company_id: companyId }))
  const { error } = await supabase.from('contacts').upsert(payload)
  if (error) throw error
}
