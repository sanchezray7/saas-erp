import { useState } from 'react'
import { getSupabase } from '@saas/core'
import { generarFacturaXml, generarCDC, guardarFactura, obtenerProximoNumeroFactura } from '@saas/facturacion'

const SIFEN_URL = import.meta.env.VITE_SIFEN_URL || 'http://localhost:3001/sifen'

/**
 * Hook genérico para emitir facturas electrónicas (e-kuatia/SIFEN).
 * No depende del CRM — funciona con cualquier { empresa, cliente, items }.
 *
 * @example
 *   const { emitirFactura, loading, resultado } = useFacturacion()
 *   const res = await emitirFactura({
 *     empresa: { id, ruc_factura, dv_factura, name, direccion, timbrado, ... },
 *     cliente: { name, ruc, dv, tipo_documento, num_documento, pais, direccion, phone, email },
 *     items: [{ descripcion, cantidad, precio_unitario, tasaIVA }],
 *     moneda: 'PYG',
 *     cotizacion_id: '...',  // opcional, para vincular
 *   })
 */
export function useFacturacion() {
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState(null)

  async function emitirFactura({ empresa, cliente, items = [], moneda = 'PYG', cotizacion_id, fecha_vencimiento, subtotal, impuesto }) {
    setLoading(true)
    setResultado(null)
    try {
      const est = empresa.establecimiento || '001'
      const pto = empresa.punto_expedicion || '001'

      // 1. Número secuencial
      const { numeroDoc, numeroFormateado } = await obtenerProximoNumeroFactura(empresa.id, est, pto)

      // 2. CDC
      const cdcInfo = generarCDC({
        tipoDE: 1,
        rucEmisor: empresa.ruc_factura || '',
        dvEmisor: empresa.dv_factura || 0,
        establecimiento: empresa.establecimiento || 1,
        puntoExp: empresa.punto_expedicion || 1,
        timbrado: empresa.timbrado || '',
        fechaEmision: new Date(),
        numeroDoc,
        tipoEmision: 1,
        codigoSeguridad: '01',
      })

      // 3. Mapear items
      const facturaItems = items.map((item, idx) => ({
        codigoInterno: `ITM${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        descripcion: item.descripcion,
        cantidad: Number(item.cantidad),
        precioUnitario: Number(item.precio_unitario),
        tasaIVA: item.tasaIVA || 10,
      }))

      // 4. Generar XML
      const hasRuc = cliente?.ruc
      const xml = generarFacturaXml({
        rucEmisor: empresa.ruc_factura,
        dvEmisor: empresa.dv_factura,
        nombreEmisor: empresa.name,
        dirEmisor: empresa.direccion,
        telEmisor: empresa.telefono,
        emailEmisor: empresa.email_empresa,
        cActEco: empresa.actividad_economica || '46510',
        desActEco: empresa.des_actividad_economica || 'COMERCIO AL POR MAYOR',
        iTipCont: 2, cTipReg: 3,
        rucReceptor: hasRuc ? cliente.ruc : null,
        dvReceptor: hasRuc ? cliente.dv : null,
        nombreReceptor: cliente?.name || '',
        dirReceptor: cliente?.direccion || '',
        telReceptor: cliente?.phone || '',
        emailReceptor: cliente?.email || '',
        iNatRec: hasRuc ? 1 : 2,
        tipoDocReceptor: hasRuc ? null : (cliente?.tipo_documento || 1),
        numDocReceptor: hasRuc ? null : (cliente?.num_documento || ''),
        paisReceptor: cliente?.pais || 'PRY',
        timbrado: empresa.timbrado,
        establecimiento: empresa.establecimiento || 1,
        puntoExp: empresa.punto_expedicion || 1,
        numeroDoc,
        cdc: cdcInfo.cdc,
        dvCDC: cdcInfo.dv,
        serieNum: 'AB',
        codigoSeguridad: '000000001',
        moneda,
        items: facturaItems,
        condicionOpe: 1,
      })

      // 5. Enviar al SIFEN (mock o real)
      const res = await fetch(`${SIFEN_URL}/recepcion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xml }),
      })
      const sifenRes = await res.json()

      // 6. Guardar en BD
      const total = facturaItems.reduce((s, i) => s + Number(i.cantidad) * Number(i.precioUnitario), 0)
      const facturaId = await guardarFactura(empresa.id, {
        cotizacion_id: cotizacion_id || null,
        cdc: sifenRes.cdc || cdcInfo.cdc,
        numero: numeroFormateado,
        timbrado: empresa.timbrado,
        xml_generado: xml,
        total,
        moneda,
        fecha_vencimiento: fecha_vencimiento || null,
        estado: sifenRes.estado === 'APROBADO' ? 'aprobada' : 'rechazada',
        errores: sifenRes.errores,
        subtotal,
        impuesto,
      })

      const resData = { ...sifenRes, facturaId, numeroFormateado }
      setResultado(resData)
      return resData
    } finally {
      setLoading(false)
    }
  }

  return { emitirFactura, loading, resultado, setResultado }
}
