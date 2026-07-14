import { getSupabase } from '@saas/core'

export async function listarFeriados(companyId, anio) {
  const supabase = getSupabase()
  const desde = `${anio}-01-01`
  const hasta = `${anio}-12-31`
  const { data, error } = await supabase.from('feriados').select('*').eq('company_id', companyId).gte('fecha', desde).lte('fecha', hasta).order('fecha')
  if (error) throw error
  return data || []
}

export async function guardarFeriado(companyId, fecha, nombre) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('feriados').insert({
    company_id: companyId, fecha, nombre,
  }).select('id').single()
  if (error) throw error
  return data.id
}

export async function actualizarFeriado(id, fecha, nombre) {
  const supabase = getSupabase()
  const { error } = await supabase.from('feriados').update({ fecha, nombre }).eq('id', id)
  if (error) throw error
}

export async function eliminarFeriado(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('feriados').delete().eq('id', id)
  if (error) throw error
}

const SEED_PY = [
  ['01-01', 'Año Nuevo'],
  ['03-01', 'Día de los Héroes'],
  ['05-01', 'Día del Trabajador'],
  ['05-14', 'Independencia Nacional'],
  ['05-15', 'Independencia Nacional'],
  ['06-12', 'Paz del Chaco'],
  ['08-15', 'Fundación de Asunción'],
  ['09-29', 'Victoria de Boquerón'],
  ['12-08', 'Virgen de Caacupé'],
  ['12-25', 'Navidad'],
]

export async function seedFeriadosPY(companyId, anio) {
  const supabase = getSupabase()
  let count = 0
  for (const [md, nombre] of SEED_PY) {
    const fecha = `${anio}-${md}`
    const { error } = await supabase.from('feriados').upsert({
      company_id: companyId, fecha, nombre,
    }, { onConflict: 'company_id,fecha' })
    if (!error) count++
  }
  return count
}
