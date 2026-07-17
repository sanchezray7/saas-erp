import { getSupabase } from '@saas/core'

export async function listarCentros(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('centros_logisticos').select('*').eq('company_id', companyId).eq('activo', true).order('nombre')
  if (error) throw error
  return data || []
}

export async function guardarCentro(companyId, centro) {
  const supabase = getSupabase()
  const payload = { company_id: companyId, nombre: centro.nombre, direccion: centro.direccion || null }
  if (centro.id) {
    const { error } = await supabase.from('centros_logisticos').update(payload).eq('id', centro.id)
    if (error) throw error
    return centro.id
  }
  const { data, error } = await supabase.from('centros_logisticos').insert(payload).select('id').single()
  if (error) throw error
  return data.id
}

export async function eliminarCentro(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('centros_logisticos').delete().eq('id', id)
  if (error) throw error
}

export async function listarAlmacenes(companyId, centroId) {
  const supabase = getSupabase()
  let query = supabase.from('almacenes').select('*, centro:centro_id(nombre)').eq('company_id', companyId).eq('activo', true).order('nombre')
  if (centroId) query = query.eq('centro_id', centroId)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function guardarAlmacen(companyId, almacen) {
  const supabase = getSupabase()
  const payload = {
    company_id: companyId, centro_id: almacen.centro_id, nombre: almacen.nombre,
    tipo: almacen.tipo || 'general', direccion: almacen.direccion || null,
  }
  if (almacen.id) {
    const { error } = await supabase.from('almacenes').update(payload).eq('id', almacen.id)
    if (error) throw error
    return almacen.id
  }
  const { data, error } = await supabase.from('almacenes').insert(payload).select('id').single()
  if (error) throw error
  return data.id
}

export async function eliminarAlmacen(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('almacenes').delete().eq('id', id)
  if (error) throw error
}

export async function obtenerStock(companyId, productoId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('producto_stock')
    .select('*, almacen:almacen_id(id, nombre, tipo, centro:centro_id(nombre))')
    .eq('company_id', companyId)
    .eq('producto_id', productoId)
    .order('almacen_id')
  if (error) throw error
  return data || []
}

export async function listarStockGeneral(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('producto_stock')
    .select('*, producto:producto_id(id, nombre, codigo, stock_minimo), almacen:almacen_id(id, nombre, tipo, centro:centro_id(nombre)), ubicacion:ubicacion_id(id, nombre, pasillo, estante, posicion)')
    .eq('company_id', companyId)
    .gt('cantidad', 0)
    .order('producto_id')
  if (error) throw error
  return data || []
}

export async function registrarMovimientoStock(companyId, userId, mov) {
  const supabase = getSupabase()

  // Insertar movimiento
  const { data, error } = await supabase.from('movimientos_stock').insert({
    company_id: companyId, producto_id: mov.producto_id, almacen_id: mov.almacen_id,
    tipo: mov.tipo, cantidad: mov.cantidad, costo_unitario: mov.costo_unitario || null,
    lote: mov.lote || null, fecha_vencimiento: mov.fecha_vencimiento || null,
    referencia_type: mov.referencia_type || null, referencia_id: mov.referencia_id || null,
    motivo: mov.motivo || null, created_by: userId || null,
  }).select('id').single()
  if (error) throw error

  // Actualizar o crear producto_stock
  const { data: existing } = await supabase
    .from('producto_stock')
    .select('*')
    .match({ company_id: companyId, producto_id: mov.producto_id, almacen_id: mov.almacen_id })
    .maybeSingle()

  if (existing) {
    if (mov.tipo === 'salida' && existing.cantidad < mov.cantidad) {
      throw new Error(`Stock insuficiente: disponible ${Number(existing.cantidad).toLocaleString()}, requerido ${Number(mov.cantidad).toLocaleString()}`)
    }
    const cantidadNueva = existing.cantidad + (mov.tipo === 'entrada' ? mov.cantidad : -mov.cantidad)
    let costoNuevo = existing.costo_promedio
    if (mov.tipo === 'entrada' && mov.costo_unitario) {
      costoNuevo = (existing.cantidad * existing.costo_promedio + mov.cantidad * mov.costo_unitario) / (existing.cantidad + mov.cantidad)
    }
    await supabase.from('producto_stock').update({ cantidad: cantidadNueva, costo_promedio: costoNuevo }).eq('id', existing.id)

    // Sincronizar precio_compra del catálogo con el costo promedio
    if (mov.tipo === 'entrada' && mov.costo_unitario) {
      await supabase.from('catalogo_productos').update({ precio_compra: Math.round(costoNuevo) }).eq('id', mov.producto_id)
    }
  } else if (mov.tipo === 'entrada') {
    await supabase.from('producto_stock').insert({
      company_id: companyId, producto_id: mov.producto_id, almacen_id: mov.almacen_id,
      cantidad: mov.cantidad,
      costo_promedio: mov.costo_unitario || 0,
    })

    // Sincronizar precio_compra del catálogo (primera entrada)
    if (mov.costo_unitario) {
      await supabase.from('catalogo_productos').update({ precio_compra: Math.round(mov.costo_unitario) }).eq('id', mov.producto_id)
    }
  } else {
    throw new Error('No hay stock disponible para realizar la salida')
  }

  return data.id
}

export async function listarMovimientos(companyId, productoId, desde, hasta) {
  const supabase = getSupabase()
  let query = supabase
    .from('movimientos_stock')
    .select('*, producto:producto_id(nombre, codigo), almacen:almacen_id(nombre, tipo)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (productoId) query = query.eq('producto_id', productoId)
  if (desde) query = query.gte('created_at', desde)
  if (hasta) query = query.lte('created_at', hasta + 'T23:59:59')

  const { data, error } = await query.limit(200)
  if (error) throw error
  return data || []
}

export async function transferirStock(companyId, userId, origenId, destinoId, productoId, cantidad, motivo) {
  const supabase = getSupabase()

  // Verificar stock suficiente en origen
  const { data: stockOrigen } = await supabase
    .from('producto_stock')
    .select('cantidad')
    .match({ company_id: companyId, producto_id: productoId, almacen_id: origenId })
    .maybeSingle()
  if (!stockOrigen || Number(stockOrigen.cantidad) < cantidad) {
    throw new Error('Stock insuficiente en el almacén de origen')
  }

  // Salida del origen
  await registrarMovimientoStock(companyId, userId, {
    producto_id: productoId, almacen_id: origenId, tipo: 'salida',
    cantidad, motivo: 'Transferencia a ' + destinoId, referencia_type: 'ajuste',
  })

  // Entrada en destino
  await registrarMovimientoStock(companyId, userId, {
    producto_id: productoId, almacen_id: destinoId, tipo: 'entrada',
    cantidad, motivo: 'Transferencia desde ' + origenId, referencia_type: 'ajuste',
  })
}

// Ubicaciones
export async function obtenerValuacion(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('producto_stock')
    .select('cantidad, costo_promedio, producto:producto_id(nombre, codigo, unidad_medida), almacen:almacen_id(id, nombre, tipo, centro:centro_id(nombre))')
    .eq('company_id', companyId)
    .gt('cantidad', 0)
    .order('almacen_id')
  if (error) throw error

  const almacenes = {}
  let granTotal = 0
  let granProductos = 0
  for (const row of data || []) {
    const valor = Number(row.cantidad) * Number(row.costo_promedio)
    granTotal += valor
    if (Number(row.cantidad) > 0) granProductos++
    const key = row.almacen?.id || 'sin-almacen'
    if (!almacenes[key]) almacenes[key] = { ...row.almacen, items: [], subTotal: 0, subProductos: 0 }
    almacenes[key].items.push({
      producto_id: row.producto?.id,
      nombre: row.producto?.nombre || '—',
      codigo: row.producto?.codigo || '',
      unidad_medida: row.producto?.unidad_medida || 'UNI',
      cantidad: Number(row.cantidad),
      costo_promedio: Number(row.costo_promedio),
      valor,
    })
    almacenes[key].subTotal += valor
    almacenes[key].subProductos += Number(row.cantidad) > 0 ? 1 : 0
  }
  return { almacenes: Object.values(almacenes), granTotal, granProductos, totalAlmacenes: Object.keys(almacenes).length }
}

export async function listarUbicaciones(companyId, almacenId) {
  const supabase = getSupabase()
  let query = supabase.from('ubicaciones').select('*, almacen:almacen_id(nombre)').eq('company_id', companyId).eq('activo', true).order('nombre')
  if (almacenId) query = query.eq('almacen_id', almacenId)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function guardarUbicacion(companyId, ubi) {
  const supabase = getSupabase()
  const payload = { company_id: companyId, almacen_id: ubi.almacen_id, nombre: ubi.nombre, pasillo: ubi.pasillo || null, estante: ubi.estante || null, posicion: ubi.posicion || null }
  if (ubi.id) {
    const { error } = await supabase.from('ubicaciones').update(payload).eq('id', ubi.id)
    if (error) throw error
    return ubi.id
  }
  const { data, error } = await supabase.from('ubicaciones').insert(payload).select('id').single()
  if (error) throw error
  return data.id
}

export async function eliminarUbicacion(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('ubicaciones').delete().eq('id', id)
  if (error) throw error
}
