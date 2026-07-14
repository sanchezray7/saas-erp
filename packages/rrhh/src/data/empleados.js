import { getSupabase } from '@saas/core'

// === Helpers ===
function hoy() { return new Date().toISOString().slice(0, 10) }
function ayer() { return new Date(Date.now() - 864e5).toISOString().slice(0, 10) }

async function cerrarYcrear(table, companyId, empleadoId, payload) {
  const supabase = getSupabase()
  const today = hoy()
  // Buscar si ya hay un registro activo creado hoy
  const { data: activo } = await supabase.from(table).select('id').eq('empleado_id', empleadoId).is('vigencia_hasta', null).eq('vigencia_desde', today).maybeSingle()
  if (activo) {
    // Ya existe un registro de hoy, actualizarlo en vez de crear duplicado
    const { error } = await supabase.from(table).update(payload).eq('id', activo.id)
    if (error) throw error
    return activo.id
  }
  // Cerrar registro activo anterior (si existe)
  await supabase.from(table).update({ vigencia_hasta: ayer(), activo: false }).eq('empleado_id', empleadoId).is('vigencia_hasta', null)
  // Crear nuevo
  const { data, error } = await supabase.from(table).insert({
    company_id: companyId, empleado_id: empleadoId, vigencia_desde: today, ...payload,
  }).select('id').single()
  if (error) throw error
  return data.id
}

// === Departamentos ===
export async function listarDepartamentos(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('departamentos').select('*').eq('company_id', companyId).eq('activo', true).order('nombre')
  if (error) throw error
  return data || []
}
export async function guardarDepartamento(companyId, { id, nombre, parent_depto_id, puesto_responsable_id }) {
  const supabase = getSupabase()
  if (id) {
    const { error } = await supabase.from('departamentos').update({
      nombre, parent_depto_id: parent_depto_id || null, puesto_responsable_id: puesto_responsable_id || null,
    }).eq('id', id)
    if (error) throw error; return id
  }
  const { data, error } = await supabase.from('departamentos').insert({
    company_id: companyId, nombre, parent_depto_id: parent_depto_id || null, puesto_responsable_id: puesto_responsable_id || null,
  }).select('id').single()
  if (error) throw error; return data.id
}
export async function eliminarDepartamento(id) {
  const supabase = getSupabase()
  // Reasignar hijos al padre
  await supabase.from('departamentos').update({ parent_depto_id: null }).eq('parent_depto_id', id)
  const { error } = await supabase.from('departamentos').delete().eq('id', id)
  if (error) throw error
}

// === Organigrama ===
export async function listarDepartamentosTree(companyId) {
  const supabase = getSupabase()
  const { data: deptos } = await supabase.from('departamentos').select('*, puesto_responsable:puesto_responsable_id(nombre)').eq('company_id', companyId).eq('activo', true).order('nombre')
  const { data: puestos } = await supabase.from('puestos').select('*').eq('company_id', companyId).eq('activo', true).order('nombre')
  const { data: contratos } = await supabase.from('empleado_contratos').select('*, empleado:empleado_id(id, nombre, apellido, email), departamento:departamento_id(nombre), puesto:puesto_id(nombre)').eq('company_id', companyId).is('vigencia_hasta', null)

  function buildTree(parentId) {
    return (deptos || [])
      .filter((d) => (d.parent_depto_id || null) === (parentId || null))
      .map((d) => {
        const contratosDepto = (contratos || []).filter((c) => c.departamento_id === d.id)
        // Puestos del depto: desde contratos activos (más preciso que puestos.departamento_id)
        const puestoIdsDepto = new Set(contratosDepto.map((c) => c.puesto_id).filter(Boolean))
        const puestosDepto = (puestos || []).filter((p) => puestoIdsDepto.has(p.id) || p.departamento_id === d.id)
        const empleadosDepto = contratosDepto.map((c) => c.empleado)
        const empleadosPorPuesto = {}
        contratosDepto.forEach((c) => {
          const pid = c.puesto_id || '__sin'
          if (!empleadosPorPuesto[pid]) empleadosPorPuesto[pid] = []
          empleadosPorPuesto[pid].push({ ...c.empleado, contrato: c })
        })
        return {
          ...d,
          puestos: puestosDepto,
          empleados: empleadosDepto,
          empleadosPorPuesto,
          children: buildTree(d.id),
        }
      })
  }

  return { tree: buildTree(null), puestos, contratos }
}

export async function obtenerEmpleadoPorUserId(userId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('empleados').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw error; return data
}

export async function listarMiembrosEquipo(companyId) {
  const supabase = getSupabase()
  try {
    const { data, error } = await supabase.rpc('listar_miembros_equipo', { p_company: companyId })
    if (error) throw error
    const { data: empleados } = await supabase.from('empleados').select('id, user_id, nombre, apellido').eq('company_id', companyId)
    const vinculados = new Set((empleados || []).filter((e) => e.user_id).map((e) => e.user_id))
    return (data || []).map((m) => ({
      user_id: m.user_id,
      email: m.email || m.user_id.slice(0, 8) + '...',
      yaVinculado: vinculados.has(m.user_id),
    }))
  } catch {
    return []
  }
}

export async function actualizarEmpleadoUserId(empleadoId, userId) {
  const supabase = getSupabase()
  const { error } = await supabase.from('empleados').update({ user_id: userId || null }).eq('id', empleadoId)
  if (error) throw error
}

// === Puestos ===
export async function listarPuestos(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('puestos').select('*').eq('company_id', companyId).eq('activo', true).order('nombre')
  if (error) throw error; return data || []
}
export async function guardarPuesto(companyId, { id, nombre, departamento_id }) {
  const supabase = getSupabase()
  if (id) {
    const { error } = await supabase.from('puestos').update({ nombre, departamento_id: departamento_id || null }).eq('id', id)
    if (error) throw error; return id
  }
  // Buscar si ya existe (unique company_id, nombre)
  const { data: existente } = await supabase.from('puestos').select('id').match({ company_id: companyId, nombre }).maybeSingle()
  if (existente) {
    if (departamento_id) {
      const { error: errUpd } = await supabase.from('puestos').update({ departamento_id }).eq('id', existente.id)
      if (errUpd) throw errUpd
    }
    return existente.id
  }
  const { data, error } = await supabase.from('puestos').insert({ company_id: companyId, nombre, departamento_id: departamento_id || null }).select('id').single()
  if (error) throw error; return data.id
}
export async function eliminarPuesto(id) {
  const supabase = getSupabase(); const { error } = await supabase.from('puestos').delete().eq('id', id); if (error) throw error
}

// === Empleados (base) ===
export async function listarEmpleados(companyId) {
  const supabase = getSupabase()
  // Traer empleados + su contrato activo
  const { data: empleados, error } = await supabase.from('empleados').select('*').eq('company_id', companyId).order('apellido')
  if (error) throw error
  // Para cada empleado, buscar contrato activo
  const result = []
  for (const emp of empleados || []) {
    const { data: c } = await supabase.from('empleado_contratos').select('*, departamento:departamento_id(nombre), puesto:puesto_id(nombre)').eq('empleado_id', emp.id).is('vigencia_hasta', null).maybeSingle()
    result.push({ ...emp, contrato_activo: c || null })
  }
  return result
}

export async function obtenerEmpleado(id) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('empleados').select('*').eq('id', id).single()
  if (error) throw error; return data
}

export async function guardarEmpleado(companyId, payload) {
  const supabase = getSupabase()
  const data = {
    company_id: companyId, nombre: payload.nombre, apellido: payload.apellido,
    email: payload.email || null, telefono: payload.telefono || null,
    direccion: payload.direccion || null, fecha_nacimiento: payload.fecha_nacimiento || null,
    codigo_biometrico: payload.codigo_biometrico || null,
    user_id: payload.user_id || null,
  }
  if (payload.id) {
    const { error } = await supabase.from('empleados').update(data).eq('id', payload.id)
    if (error) throw error; return payload.id
  }
  const { data: inserted, error } = await supabase.from('empleados').insert(data).select('id').single()
  if (error) throw error; return inserted.id
}

export async function eliminarEmpleado(id) {
  const supabase = getSupabase(); const { error } = await supabase.from('empleados').delete().eq('id', id); if (error) throw error
}

// === Contratos (histórico) ===
export async function obtenerContratoActivo(empleadoId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('empleado_contratos').select('*, departamento:departamento_id(nombre), puesto:puesto_id(nombre)').eq('empleado_id', empleadoId).is('vigencia_hasta', null).maybeSingle()
  if (error) throw error; return data
}

export async function listarContratos(empleadoId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('empleado_contratos').select('*, departamento:departamento_id(nombre), puesto:puesto_id(nombre)').eq('empleado_id', empleadoId).order('vigencia_desde', { ascending: false })
  if (error) throw error; return data || []
}

export async function guardarContrato(companyId, payload) {
  return cerrarYcrear('empleado_contratos', companyId, payload.empleado_id, {
    departamento_id: payload.departamento_id || null, puesto_id: payload.puesto_id || null,
    tipo: payload.tipo, salario: Number(payload.salario), moneda: payload.moneda || 'PYG',
    cargo: payload.cargo || null, activo: true,
    frecuencia_pago: payload.frecuencia_pago || 'mensual',
  })
}

// === Bancario (histórico) ===
export async function obtenerBancarioActivo(empleadoId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('empleado_bancario').select('*').eq('empleado_id', empleadoId).is('vigencia_hasta', null).maybeSingle()
  if (error) throw error; return data
}

export async function listarBancarioHistorial(empleadoId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('empleado_bancario').select('*').eq('empleado_id', empleadoId).order('vigencia_desde', { ascending: false })
  if (error) throw error; return data || []
}

export async function guardarBancario(companyId, empleadoId, payload) {
  return cerrarYcrear('empleado_bancario', companyId, empleadoId, {
    banco: payload.banco || null, tipo_cuenta: payload.tipo_cuenta || null,
    numero_cuenta: payload.numero_cuenta || null, alias_cbu: payload.alias_cbu || null,
  })
}

// === Fiscal (histórico) ===
export async function obtenerFiscalActivo(empleadoId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('empleado_fiscal').select('*').eq('empleado_id', empleadoId).is('vigencia_hasta', null).maybeSingle()
  if (error) throw error; return data
}

export async function listarFiscalHistorial(empleadoId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('empleado_fiscal').select('*').eq('empleado_id', empleadoId).order('vigencia_desde', { ascending: false })
  if (error) throw error; return data || []
}

export async function guardarFiscal(companyId, empleadoId, payload) {
  return cerrarYcrear('empleado_fiscal', companyId, empleadoId, {
    numero_ips: payload.numero_ips || null,
  })
}

// === Documentos (histórico por tipo) ===
export async function listarDocumentos(empleadoId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('empleado_documentos').select('*').eq('empleado_id', empleadoId).order('tipo').order('vigencia_desde', { ascending: false })
  if (error) throw error; return data || []
}

export async function guardarDocumento(companyId, empleadoId, payload) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('empleado_documentos').insert({
    company_id: companyId, empleado_id: empleadoId, tipo: payload.tipo,
    numero: payload.numero || null, fecha_emision: payload.fecha_emision || null,
    fecha_vencimiento: payload.fecha_vencimiento || null,
    vigencia_desde: payload.vigencia_desde || hoy(),
  }).select('id').single()
  if (error) throw error; return data.id
}

export async function eliminarDocumento(id) {
  const supabase = getSupabase(); const { error } = await supabase.from('empleado_documentos').delete().eq('id', id); if (error) throw error
}
