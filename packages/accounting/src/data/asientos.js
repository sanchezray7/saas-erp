import { getSupabase } from '@saas/core'

export async function listarAsientos(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return data || []
}

export async function obtenerAsiento(id) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('journal_entries')
    .select('*, lines:journal_entry_lines(*, account:account_id(code, name))')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function generarAsientoFacturaProveedor(facturaId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('generar_asiento_factura_proveedor', { p_factura_id: facturaId })
  if (error) throw error
  return data
}

export async function generarAsientoFacturaCliente(facturaId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('generar_asiento_factura_cliente', { p_factura_id: facturaId })
  if (error) throw error
  return data
}

export async function copiarTaxLinesACliente(cotizacionId, facturaId) {
  const supabase = getSupabase()
  const { data: lines } = await supabase
    .from('invoice_tax_lines')
    .select('*')
    .match({ invoice_type: 'cliente', invoice_id: cotizacionId })
  if (!lines || lines.length === 0) return
  const newLines = lines.map((l) => ({
    company_id: l.company_id, invoice_type: 'cliente', invoice_id: facturaId,
    tax_id: l.tax_id, base_amount: l.base_amount, tax_amount: l.tax_amount,
  }))
  const { error } = await supabase.from('invoice_tax_lines').insert(newLines)
  if (error) throw error
}

export async function generarAsientoPagoProveedor(facturaId, cuentaBancoId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('generar_asiento_pago_proveedor', { p_factura_id: facturaId, p_cuenta_banco_id: cuentaBancoId })
  if (error) throw error
  return data
}

export async function generarAsientoPagoCliente(facturaId, cuentaBancoId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('generar_asiento_pago_cliente', { p_factura_id: facturaId, p_cuenta_banco_id: cuentaBancoId })
  if (error) throw error
  return data
}

export async function generarAsientoAjusteInventario(conteoId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('generar_asiento_ajuste_inventario', {
    p_conteo_id: conteoId,
    p_fecha: new Date().toISOString().slice(0, 10),
  })
  if (error) throw error
  return data
}

export async function anularAsiento(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('journal_entries').update({ estado: 'anulado' }).eq('id', id)
  if (error) throw error
}

export async function eliminarAsiento(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('journal_entry_lines').delete().eq('journal_entry_id', id)
  if (error) throw error
  const { error: err2 } = await supabase.from('journal_entries').delete().eq('id', id)
  if (err2) throw err2
}

export async function generarAsientoNomina(periodoId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('generar_asiento_nomina', { p_periodo_id: periodoId })
  if (error) throw error
  return data
}

export async function generarAsientoPagoNomina(periodoId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('generar_asiento_pago_nomina', { p_periodo_id: periodoId })
  if (error) throw error
  return data
}
