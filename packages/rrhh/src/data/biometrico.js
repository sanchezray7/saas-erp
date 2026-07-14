import { getSupabase } from '@saas/core'

// === Dispositivos ===
export async function listarDispositivos(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('dispositivos_biometricos').select('*').eq('company_id', companyId).eq('activo', true).order('nombre')
  if (error) throw error
  return data || []
}

export async function guardarDispositivo(companyId, payload) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('dispositivos_biometricos').insert({
    company_id: companyId, nombre: payload.nombre,
    tipo_deteccion: payload.tipo_deteccion || 'secuencia',
    umbral_hs: Number(payload.umbral_hs) || 3,
    minimo_min: Number(payload.minimo_min) || 30,
  }).select('id').single()
  if (error) throw error
  return data.id
}

// === Inferencia ===
function parseCSV(texto) {
  const lineas = texto.trim().split('\n').map((l) => l.trim()).filter(Boolean)
  const cabecera = lineas[0].toLowerCase()
  const tieneTipo = cabecera.includes('tipo')
  const resultados = []
  for (let i = tieneTipo ? 1 : 0; i < lineas.length; i++) {
    const partes = lineas[i].split(',').map((p) => p.trim())
    if (partes.length < 3) continue
    resultados.push({
      codigo: partes[0],
      fecha: partes[1],
      hora: partes[2],
      tipo_explicito: tieneTipo ? partes[3] || null : null,
    })
  }
  return { data: resultados, tieneTipo }
}

function inferirTipo(marcas, idx, total, umbralHs, minimoMin) {
  if (idx === 0) return 'entrada'
  // Si es el último evento, siempre es salida
  if (idx === total - 1) return 'salida'

  const actual = marcas[idx]
  const anterior = marcas[idx - 1]

  // Calcular brecha desde la marca anterior en horas
  const [hA, mA] = anterior.hora.split(':').map(Number)
  const [hB, mB] = actual.hora.split(':').map(Number)
  const brechaMin = (hB * 60 + mB) - (hA * 60 + mA)
  const brechaHs = brechaMin / 60

  // Si la brecha es >= umbral, es nueva jornada → entrada
  if (brechaHs >= umbralHs) return 'entrada'
  return 'salida_almuerzo'
}

export function previsualizarMarcaciones(companyId, csvText, umbralHs = 3, minimoMin = 30) {
  const { data: raw, tieneTipo } = parseCSV(csvText)

  // Agrupar por código + fecha
  const grupos = {}
  for (const r of raw) {
    const key = `${r.codigo}||${r.fecha}`
    if (!grupos[key]) grupos[key] = []
    grupos[key].push(r)
  }

  const resultados = []

  for (const [key, marcas] of Object.entries(grupos)) {
    const [codigo, fecha] = key.split('||')
    marcas.sort((a, b) => a.hora.localeCompare(b.hora))

    // Si el dispositivo envía tipo explícito, se usa directamente
    if (tieneTipo) {
      for (const m of marcas) {
        resultados.push({ codigo, fecha, hora: m.hora, tipo: m.tipo_explicito || 'entrada', duracionMin: null })
      }
      continue
    }

    // Inferir por secuencia
    let jornada = []
    let lineasJornada = []

    for (let i = 0; i < marcas.length; i++) {
      const m = marcas[i]
      const tipo = inferirTipo(marcas, i, marcas.length, umbralHs, minimoMin)

      if (tipo === 'entrada' && jornada.length > 0) {
        // Cerrar jornada anterior
        cerrarJornada(jornada, lineasJornada, resultados, codigo, minimoMin)
        jornada = []
        lineasJornada = []
      }

      lineasJornada.push({ ...m, tipo })
      if (tipo === 'entrada') jornada.push(m)
      if (tipo === 'salida') jornada.push(m)
    }
    // Última jornada
    if (lineasJornada.length > 0) {
      cerrarJornada(jornada, lineasJornada, resultados, codigo, minimoMin)
    }
  }

  // Post-procesamiento iterativo: corregir turnos nocturnos
  // Se repite hasta que no haya más cambios porque una corrección puede habilitar otra
  const agrupado = {}
  for (const r of resultados) {
    if (!agrupado[r.codigo]) agrupado[r.codigo] = []
    agrupado[r.codigo].push(r)
  }
  let huboCambios = true
  while (huboCambios) {
    huboCambios = false
    for (const marcas of Object.values(agrupado)) {
      marcas.sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`))
      // Fase 1: si día N termina con entrada y día N+1 empieza con entrada → pasar a salida
      for (let i = 0; i < marcas.length - 1; i++) {
        const act = marcas[i], sig = marcas[i + 1]
        if (act.tipo === 'entrada' && sig.tipo === 'entrada' && act.fecha !== sig.fecha) {
          sig.tipo = 'salida'; huboCambios = true
        }
      }
      // Fase 2: dos salidas consecutivas → la segunda pasa a entrada
      for (let i = 0; i < marcas.length - 1; i++) {
        if (marcas[i].tipo === 'salida' && marcas[i + 1].tipo === 'salida') {
          marcas[i + 1].tipo = 'entrada'; huboCambios = true
        }
      }
    }
  }

  // Fase 3: si una salida está al día siguiente de la entrada (nocturno), unificar fecha
  for (const marcas of Object.values(agrupado)) {
    marcas.sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`))
    for (let i = 0; i < marcas.length - 1; i++) {
      const act = marcas[i], sig = marcas[i + 1]
      if (act.tipo === 'entrada' && sig.tipo === 'salida' && act.fecha !== sig.fecha) {
        const h = parseInt(sig.hora.split(':')[0])
        if (h < 12) {
          sig.fecha = act.fecha
        }
      }
    }
  }

  return resultados
}

function cerrarJornada(jornada, lineas, resultados, codigo, minimoMin) {
  const entrada = lineas[0]
  const salida = lineas[lineas.length - 1]

  // Si la salida es al día siguiente, ajustar fecha
  const [hE] = entrada.hora.split(':').map(Number)
  const [hS] = salida.hora.split(':').map(Number)
  const cruza = hS < hE

  // Calcular duración en minutos
  const dur = calcularDuracion(entrada.hora, salida.hora, cruza)

  // Si solo hay 1 evento, es una entrada sin salida registrada
  if (lineas.length === 1) {
    resultados.push({ codigo, fecha: entrada.fecha, hora: entrada.hora, tipo: 'entrada', duracionMin: null })
    return
  }

  // Si hay múltiples eventos pero la duración total es muy corta, marcar como pre-entrada
  if (dur < minimoMin) {
    resultados.push({ codigo, fecha: entrada.fecha, hora: entrada.hora, tipo: 'pre_entrada', duracionMin: dur })
    if (salida.hora !== entrada.hora) {
      resultados.push({ codigo, fecha: cruza ? salida.fecha : salida.fecha, hora: salida.hora, tipo: 'pre_salida', duracionMin: dur })
    }
    return
  }

  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i]
    resultados.push({
      codigo, fecha: l.fecha, hora: l.hora,
      tipo: l.tipo || (i === 0 ? 'entrada' : i === lineas.length - 1 ? 'salida' : 'salida_almuerzo'),
      duracionMin: i === lineas.length - 1 ? dur : null,
    })
  }
}

function calcularDuracion(horaInicio, horaFin, cruza) {
  const [h1, m1] = horaInicio.split(':').map(Number)
  const [h2, m2] = horaFin.split(':').map(Number)
  let inicio = h1 * 60 + m1
  let fin = h2 * 60 + m2
  if (cruza) fin += 1440
  return fin - inicio
}

// === Procesar ===
export async function procesarMarcaciones(companyId, dispositivoId, csvText, umbralHs = 3, minimoMin = 30, codeMapExterno) {
  const supabase = getSupabase()
  const preview = previsualizarMarcaciones(companyId, csvText, umbralHs, minimoMin)

  // Obtener empleados para vincular desde DB (más confiable)
  const { data: empleados } = await supabase.from('empleados').select('id, codigo_biometrico').eq('company_id', companyId).not('codigo_biometrico', 'is', null)
  console.log('[import] empleados desde DB:', empleados?.length, 'con código biométrico')
  const codeMap = {}
  ;(empleados || []).forEach((e) => {
    if (e.codigo_biometrico) {
      const key = e.codigo_biometrico.trim().toLowerCase()
      codeMap[key] = e.id
      codeMap[e.codigo_biometrico] = e.id
    }
  })
  console.log('[import] codeMap keys:', Object.keys(codeMap), 'preview items:', preview.length)

  let insertados = 0

  // Separar por tipo
  const batchMarcaciones = []
  const batchEntradas = []
  const batchSalidas = []

  for (const m of preview) {
    if (m.tipo === 'pre_entrada' || m.tipo === 'pre_salida') continue
    const empId = codeMap[m.codigo.trim().toLowerCase()]
    batchMarcaciones.push({
      company_id: companyId, dispositivo_id: dispositivoId,
      empleado_id: empId || null, codigo_empleado: m.codigo,
      fecha: m.fecha, hora: m.hora, tipo_inferido: m.tipo, procesado: true,
    })
    if (!empId) continue
    if (m.tipo === 'entrada') {
      batchEntradas.push({ company_id: companyId, empleado_id: empId, fecha: m.fecha, hora_entrada: m.hora })
    } else if (m.tipo === 'salida') {
      batchSalidas.push({ company_id: companyId, empleado_id: empId, fecha: m.fecha, hora_salida: m.hora })
    }
    insertados++
  }

  // Batch 1: marcaciones_biometricas
  if (batchMarcaciones.length > 0) {
    try { await supabase.from('marcaciones_biometricas').insert(batchMarcaciones) } catch (_) {}
  }

  // Batch 2: upsert entradas
  if (batchEntradas.length > 0) {
    try {
      await supabase.from('asistencia').upsert(
        batchEntradas.map((e) => ({ ...e, tipo: 'normal' })),
        { onConflict: 'company_id,empleado_id,fecha' }
      )
    } catch (_) {}
  }

  // Batch 3: upsert salidas (actualizar hora_salida donde exista el registro)
  for (const s of batchSalidas) {
    try {
      await supabase.from('asistencia').upsert({
        company_id: companyId, empleado_id: s.empleado_id, fecha: s.fecha,
        hora_salida: s.hora_salida, tipo: 'normal',
      }, { onConflict: 'company_id,empleado_id,fecha' })
    } catch (_) {}
  }

  return { procesados: insertados, total: preview.length, sinVincular: preview.filter((m) => !codeMap[m.codigo.trim().toLowerCase()] && m.tipo !== 'pre_entrada' && m.tipo !== 'pre_salida').length }
}
