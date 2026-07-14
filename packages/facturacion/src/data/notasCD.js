import { getSupabase } from '@saas/core'
import { generarCDC } from '../lib/cdc.js'
import { generarNotaXml } from '../lib/notaXml.js'

const SIFEN_URL = import.meta.env.VITE_SIFEN_URL || 'http://localhost:3001/sifen'

export async function listarNotas(companyId, tipo) {
  const supabase = getSupabase()
  let query = supabase
    .from('notas_credito_debito')
    .select('*, factura_origen:factura_origen_id(numero, cdc, total, moneda)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
  if (tipo) query = query.eq('tipo', tipo)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function obtenerNota(id) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('notas_credito_debito')
    .select('*, factura_origen:factura_origen_id(numero, cdc, total, moneda)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function guardarNota(companyId, userId, payload) {
  const supabase = getSupabase()
  const items = payload.items || []
  const subtotal = items.reduce((s, i) => s + Number(i.cantidad) * Number(i.precioUnitario), 0)
  const total = subtotal + Number(payload.impuesto || 0)

  const data = {
    company_id: companyId,
    factura_origen_id: payload.factura_origen_id,
    cotizacion_id: payload.cotizacion_id || null,
    tipo: payload.tipo,
    motivo: payload.motivo,
    items: items,
    subtotal,
    impuesto: Number(payload.impuesto || 0),
    total,
    moneda: payload.moneda || 'PYG',
    estado: payload.estado || 'borrador',
    created_by: userId,
  }

  if (payload.id) {
    const { error } = await supabase.from('notas_credito_debito').update(data).eq('id', payload.id)
    if (error) throw error
    return payload.id
  }

  const { data: inserted, error } = await supabase.from('notas_credito_debito').insert(data).select('id').single()
  if (error) throw error
  return inserted.id
}

export async function emitirNota(notaId, companyData) {
  const supabase = getSupabase()
  const nota = await obtenerNota(notaId)
  if (!nota) throw new Error('Nota no encontrada')
  if (nota.estado !== 'borrador') throw new Error('Solo notas en borrador pueden emitirse')

  const { data: factura } = await supabase.from('facturas').select('*, cotizacion:cotizacion_id(contact:contact_id(name, phone, email, ruc, dv, direccion, pais))').eq('id', nota.factura_origen_id).single()

  // Generar número secuencial
  const { data: numData, error: numErr } = await supabase.rpc('incrementar_contador_nota', {
    p_company_id: companyData.company_id,
    p_tipo: nota.tipo,
    p_establecimiento: companyData.establecimiento || '001',
    p_punto_exp: companyData.punto_expedicion || '001',
  })
  if (numErr) console.warn('Error al generar número secuencial:', numErr.message)

  const fallbackNum = 'NC-' + Date.now().toString(36).toUpperCase()
  const numeroDoc = numData?.numero_doc || 1
  const numeroFormateado = numData?.numero_formateado || fallbackNum

  // Generar CDC
  let cdc = ''
  try {
    const cdcResult = generarCDC({
      tipoDE: nota.tipo === 'credito' ? 5 : 6,
      rucEmisor: companyData.ruc_factura,
      dvEmisor: companyData.dv_factura || 0,
      establecimiento: (companyData.establecimiento || '001').padStart(3, '0'),
      puntoExp: (companyData.punto_expedicion || '001').padStart(3, '0'),
      timbrado: companyData.timbrado || '12345678',
      fechaEmision: new Date().toISOString().slice(0, 10),
      numeroDoc: String(numeroDoc).padStart(7, '0'),
      tipoEmision: 1,
      codigoSeguridad: '01',
    })
    cdc = cdcResult?.cdc || ''
  } catch (_) {
    cdc = 'MOCK-CDC-NOTA-' + Date.now().toString(36).toUpperCase()
  }

  const contacto = factura?.cotizacion?.contact || {}

  // Generar XML
  const xml = generarNotaXml({
    tipo: nota.tipo,
    rucEmisor: companyData.ruc_factura,
    dvEmisor: companyData.dv_factura || 0,
    nombreEmisor: companyData.name || companyData.nombre_empresa || '',
    dirEmisor: companyData.direccion || '',
    telEmisor: companyData.telefono || '',
    emailEmisor: companyData.email_empresa || '',
    cActEco: companyData.actividad_economica || '00000',
    desActEco: companyData.des_actividad_economica || 'COMERCIO GENERAL',
    rucReceptor: contacto.ruc || '',
    dvReceptor: contacto.dv || 0,
    nombreReceptor: contacto.name || '',
    dirReceptor: contacto.direccion || '',
    tipoDocReceptor: contacto.tipo_documento || 'CI',
    numDocReceptor: contacto.numero_documento || '',
    paisReceptor: contacto.pais || 'PRY',
    timbrado: companyData.timbrado || '12345678',
    establecimiento: companyData.establecimiento || '001',
    puntoExp: companyData.punto_expedicion || '001',
    numeroDoc: numeroFormateado,
    cdc,
    fechaEmision: new Date().toISOString().slice(0, 10),
    motivo: nota.motivo,
    cdcOriginal: factura.cdc || '',
    numeroOriginal: factura.numero || '',
    fechaOriginal: factura.created_at?.slice(0, 10) || '',
    items: nota.items || [],
    subtotal: nota.subtotal,
    impuesto: nota.impuesto,
    total: nota.total,
  })

  // Enviar a SIFEN
  let sifenRes
  try {
    const res = await fetch(`${SIFEN_URL}/recepcion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ xml }),
    })
    sifenRes = await res.json()
  } catch (err) {
    sifenRes = { estado: 'RECHAZADO', errores: [{ codigo: 9999, descripcion: err.message }] }
  }

  const newEstado = sifenRes.estado === 'APROBADO' ? 'aprobada' : 'rechazada'
  await supabase.from('notas_credito_debito').update({
    cdc, numero: numeroFormateado, xml_generado: xml,
    estado: newEstado, errores: sifenRes.errores ? JSON.stringify(sifenRes.errores) : null,
  }).eq('id', notaId)

  if (newEstado === 'aprobada') {
    // Generar asiento contable
    try {
      const asiento = await supabase.rpc('generar_asiento_nota_credito_debito', { p_nota_id: notaId })
      if (asiento.data?.entry_number) console.log('Asiento generado:', asiento.data.entry_number)
    } catch (err) { console.warn('Asiento contable no generado:', err.message) }

    // Actualizar saldo de factura original
    try {
      await supabase.rpc('actualizar_saldo_por_nota', { p_nota_id: notaId })
    } catch (err) { console.warn('Saldo no actualizado:', err.message) }
  }

  return { estado: newEstado, cdc, numero: numeroFormateado, errores: sifenRes.errores }
}
