import { getSupabase } from '@saas/core'
import { registrarMovimientoStock } from '@saas/inventario'

export async function listarOrdenes(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('ordenes_produccion')
    .select('*, receta:recetas(id, codigo, nombre)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getOrden(id) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('ordenes_produccion')
    .select('*, receta:recetas(id, codigo, nombre, cantidad_producida, unidad_medida, instrucciones)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function guardarOrden(companyId, userId, orden) {
  const supabase = getSupabase()
  const payload = {
    company_id: companyId,
    receta_id: orden.receta_id,
    lote: orden.lote || null,
    cantidad_planeada: orden.cantidad_planeada,
    fecha_inicio_planeada: orden.fecha_inicio_planeada || null,
    notas: orden.notas || null,
    created_by: userId || null,
  }
  const { data, error } = await supabase.from('ordenes_produccion').insert(payload).select('id').single()
  if (error) throw error
  return data.id
}

export async function iniciarOrden(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('ordenes_produccion').update({
    estado: 'en_proceso',
    fecha_inicio_real: new Date().toISOString(),
  }).eq('id', id)
  if (error) throw error
}

export async function cancelarOrden(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('ordenes_produccion').update({
    estado: 'cancelada',
  }).eq('id', id)
  if (error) throw error
}

export async function registrarConsumo(ordenId, productoId, cantidad, lote, costoUnitario) {
  const supabase = getSupabase()
  const { error } = await supabase.from('orden_consumos').insert({
    orden_id: ordenId, producto_id: productoId,
    cantidad, lote: lote || null, costo_unitario: costoUnitario || null,
  })
  if (error) throw error
}

export async function registrarObtencion(ordenId, productoId, cantidad, lote, costoUnitario) {
  const supabase = getSupabase()
  const { error } = await supabase.from('orden_obtenciones').insert({
    orden_id: ordenId, producto_id: productoId,
    cantidad, lote: lote || null, costo_unitario: costoUnitario || null,
  })
  if (error) throw error
}

export async function getConsumos(ordenId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('orden_consumos')
    .select('*, producto:catalogo_productos(id, nombre, codigo)')
    .eq('orden_id', ordenId)
    .order('created_at')
  if (error) {
    const { data: d2, error: e2 } = await supabase.from('orden_consumos').select('*').eq('orden_id', ordenId).order('created_at')
    if (e2) throw e2
    return d2 || []
  }
  return data || []
}

export async function getObtenciones(ordenId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('orden_obtenciones')
    .select('*, producto:catalogo_productos(id, nombre, codigo)')
    .eq('orden_id', ordenId)
    .order('created_at')
  if (error) {
    const { data: d2, error: e2 } = await supabase.from('orden_obtenciones').select('*').eq('orden_id', ordenId).order('created_at')
    if (e2) throw e2
    return d2 || []
  }
  return data || []
}

export async function completarOrden(companyId, userId, ordenId, almacenId, cantidadProducida, lote) {
  const supabase = getSupabase()
  const orden = await getOrden(ordenId)
  if (!orden || orden.estado !== 'en_proceso') throw new Error('La orden no está en proceso')

  // Obtener ingredientes de la receta para calcular costos
  let ingredientes = []
  try {
    const { data } = await supabase
      .from('receta_ingredientes')
      .select('*, producto:catalogo_productos(id, nombre, codigo, tipo)')
      .eq('receta_id', orden.receta_id)
      .order('orden')
    ingredientes = data || []
  } catch (_) {
    const { data } = await supabase.from('receta_ingredientes').select('*').eq('receta_id', orden.receta_id).order('orden')
    ingredientes = data || []
  }

  let costoTotal = 0

  // 1. Registrar consumos de materia prima (salida de stock)
  for (const ing of (ingredientes || [])) {
    if (ing.es_subproducto) continue
    const cantidadConsumir = (ing.cantidad / orden.receta.cantidad_producida) * cantidadProducida
    let costoUnit = 0
    try { // producto_stock puede no existir en dev
      const { data: stock } = await supabase
        .from('producto_stock')
        .select('costo_promedio')
        .match({ company_id: companyId, producto_id: ing.producto_id, almacen_id: almacenId })
        .maybeSingle()
      costoUnit = stock?.costo_promedio || 0
    } catch (_) { /* dev mode */ }

    await registrarMovimientoStock(companyId, userId, {
      producto_id: ing.producto_id,
      almacen_id: almacenId,
      tipo: 'salida',
      cantidad: cantidadConsumir,
      lote: lote || null,
      referencia_type: 'produccion',
      referencia_id: ordenId,
      motivo: `Consumo OP #${orden.numero}`,
    })

    await registrarConsumo(ordenId, ing.producto_id, cantidadConsumir, lote, costoUnit)
    costoTotal += costoUnit * cantidadConsumir
  }

  // 2. Registrar obtención de producto final (entrada de stock)
  let costoFinal = cantidadProducida > 0 ? costoTotal / cantidadProducida : 0
  try {
    const { data: prodFinal } = await supabase
      .from('catalogo_productos')
      .select('precio_compra')
      .eq('id', orden.receta.producto_final_id)
      .single()
    if (prodFinal?.precio_compra) costoFinal = prodFinal.precio_compra
  } catch (_) {}

  await registrarMovimientoStock(companyId, userId, {
    producto_id: orden.receta.producto_final_id,
    almacen_id: almacenId,
    tipo: 'entrada',
    cantidad: cantidadProducida,
    costo_unitario: costoFinal,
    lote: lote || null,
    referencia_type: 'produccion',
    referencia_id: ordenId,
    motivo: `Producción OP #${orden.numero}`,
  })

  await registrarObtencion(ordenId, orden.receta.producto_final_id, cantidadProducida, lote, costoFinal)

  // 3. Registrar subproductos (entrada de stock - by-products como suero)
  for (const ing of (ingredientes || [])) {
    if (!ing.es_subproducto) continue
    const cantidadSub = (ing.cantidad / orden.receta.cantidad_producida) * cantidadProducida

    await registrarMovimientoStock(companyId, userId, {
      producto_id: ing.producto_id,
      almacen_id: almacenId,
      tipo: 'entrada',
      cantidad: cantidadSub,
      costo_unitario: 0,
      lote: lote || null,
      referencia_type: 'produccion',
      referencia_id: ordenId,
      motivo: `Subproducto OP #${orden.numero}`,
    })

    await registrarObtencion(ordenId, ing.producto_id, cantidadSub, lote, 0)
  }

  // 4. Cerrar orden
  const { error } = await supabase.from('ordenes_produccion').update({
    estado: 'completada',
    cantidad_producida: cantidadProducida,
    fecha_fin: new Date().toISOString(),
    costo_total: costoTotal,
  }).eq('id', ordenId)
  if (error) throw error
}
