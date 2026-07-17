import { getSupabase } from '@saas/core'

export async function listarCajas(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('cajas').select('*').eq('company_id', companyId).order('nombre')
  if (error) throw error
  return data || []
}

export async function guardarCaja(companyId, caja) {
  const supabase = getSupabase()
  const payload = { company_id: companyId, ...caja }
  delete payload.id
  if (caja.id) payload.id = caja.id
  const { data, error } = await supabase.from('cajas').upsert(payload).select().single()
  if (error) throw error
  return data
}

export async function eliminarCaja(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('cajas').delete().eq('id', id)
  if (error) throw error
}

export async function abrirCaja(cajaId, saldoInicial) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('abrir_caja', { p_caja_id: cajaId, p_saldo_inicial: saldoInicial })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data
}

export async function cerrarCaja(cajaId, saldoReal, observaciones = '') {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('cerrar_caja', { p_caja_id: cajaId, p_saldo_real: saldoReal, p_observaciones: observaciones })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data
}

export async function registrarVentaPos(companyId, venta) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('registrar_venta_pos', {
    p_company_id: companyId,
    p_caja_id: venta.cajaId,
    p_cliente_id: venta.clienteId,
    p_items: JSON.stringify(venta.items),
    p_subtotal: venta.subtotal,
    p_descuento: venta.descuento,
    p_total: venta.total,
    p_forma_pago: venta.formaPago,
    p_monto_efectivo: venta.montoEfectivo || 0,
    p_monto_tarjeta: venta.montoTarjeta || 0,
    p_monto_transferencia: venta.montoTransferencia || 0,
    p_monto_recibido: venta.montoRecibido || 0,
    p_monto_cambio: venta.montoCambio || 0,
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data
}

export async function listarVentasPos(companyId, cajaId, desde, hasta) {
  const supabase = getSupabase()
  let query = supabase.from('ventas_pos').select('*, cliente:cliente_id(name)').eq('company_id', companyId).order('numero', { ascending: false }).limit(100)
  if (cajaId) query = query.eq('caja_id', cajaId)
  if (desde) query = query.gte('created_at', desde)
  if (hasta) query = query.lte('created_at', hasta + 'T23:59:59')
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function listarCierres(companyId, cajaId) {
  const supabase = getSupabase()
  let query = supabase.from('cierres_caja').select('*, caja:caja_id(nombre)').eq('company_id', companyId).order('cierre_en', { ascending: false })
  if (cajaId) query = query.eq('caja_id', cajaId)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function seedConsumidorFinal(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('seed_consumidor_final', { p_company_id: companyId })
  if (error) throw error
  return data
}

export async function listarProductosPos(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('catalogo_productos')
    .select('id, nombre, codigo, precio_venta, precio_compra, codigo_barras, tipo, moneda, unidad_medida, categoria:categoria_id(id, nombre, icono, color)')
    .eq('company_id', companyId)
    .eq('activo', true)
    .eq('tipo', 'producto')
    .order('nombre')
  if (error) throw error
  return data || []
}
