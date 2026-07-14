import { getSupabase } from '@saas/core'

export async function listarConteos(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('conteos')
    .select('*, almacen:almacen_id(id, nombre)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function obtenerConteo(id) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('conteos')
    .select('*, almacen:almacen_id(id, nombre), items:conteo_items(*, producto:producto_id(id, nombre, codigo)), asiento:asiento_id(id, entry_number)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function crearConteo(companyId, userId, almacenId, productoIds) {
  const supabase = getSupabase()

  // Generar número
  const { data: numData } = await supabase.rpc('generar_numero_conteo', { p_company_id: companyId })
  const numero = numData || 'CT-' + Date.now().toString(36).toUpperCase()

  // Crear conteo
  const { data: conteo, error } = await supabase.from('conteos').insert({
    company_id: companyId, almacen_id: almacenId, numero, estado: 'contando', created_by: userId,
  }).select('id, numero').single()
  if (error) throw error

  // Obtener stock actual de cada producto en este almacén
  const { data: stocks, error: stockErr } = await supabase
    .from('producto_stock')
    .select('producto_id, cantidad')
    .in('producto_id', productoIds)
    .eq('almacen_id', almacenId)
  if (stockErr) throw stockErr

  const stockMap = {}
  ;(stocks || []).forEach((s) => { stockMap[s.producto_id] = Number(s.cantidad) })

  // Insertar items
  const items = productoIds.map((pid) => ({
    conteo_id: conteo.id,
    producto_id: pid,
    cantidad_sistema: stockMap[pid] || 0,
  }))

  const { error: err2 } = await supabase.from('conteo_items').insert(items)
  if (err2) throw err2

  return conteo
}

export async function actualizarCantidadContada(itemId, cantidad) {
  const supabase = getSupabase()
  const { data: item } = await supabase.from('conteo_items').select('*').eq('id', itemId).single()
  if (!item) throw new Error('Item no encontrado')
  const diferencia = (Number(cantidad) || 0) - Number(item.cantidad_sistema)
  const { error } = await supabase.from('conteo_items').update({ cantidad_contada: Number(cantidad) || null, diferencia }).eq('id', itemId)
  if (error) throw error
}

export async function ajustarConteo(conteoId, companyId, userId) {
  const supabase = getSupabase()
  const { data: conteo } = await supabase.from('conteos').select('*, items:conteo_items(*)').eq('id', conteoId).single()
  if (!conteo) throw new Error('Conteo no encontrado')

  for (const item of conteo.items || []) {
    const dif = Number(item.diferencia)
    if (dif === 0) continue

    const { registrarMovimientoStock } = await import('./inventario')
    await registrarMovimientoStock(companyId, userId, {
      producto_id: item.producto_id,
      almacen_id: conteo.almacen_id,
      tipo: dif > 0 ? 'entrada' : 'salida',
      cantidad: Math.abs(dif),
      lote: item.lote || null,
      motivo: 'Ajuste por conteo ' + conteo.numero,
      referencia_type: 'ajuste',
    })
  }

  await supabase.from('conteos').update({ estado: 'cerrado' }).eq('id', conteoId)

  // Generar asiento contable
  try {
    const { generarAsientoAjusteInventario } = await import('@saas/accounting')
    const result = await generarAsientoAjusteInventario(conteoId)
    if (result?.error) {
      console.warn('Asiento contable no generado:', result.error)
    } else {
      // Guardar referencia al asiento en el conteo
      await supabase.from('conteos').update({ asiento_id: result.id }).eq('id', conteoId)
    }
  } catch (err) {
    console.warn('Error al generar asiento contable:', err.message)
  }
}
