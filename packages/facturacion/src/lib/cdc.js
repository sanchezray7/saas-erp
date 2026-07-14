const MODULO11_PESOS = [2, 3, 4, 5, 6, 7, 2, 3, 4, 5, 6, 7, 2, 3, 4, 5, 6, 7, 2, 3, 4, 5, 6, 7, 2, 3, 4, 5, 6, 7, 2, 3, 4, 5, 6, 7, 2, 3, 4, 5, 6, 7]

function digitoVerificadorModulo11(numero) {
  const digitos = String(numero).split('').reverse()
  let suma = 0
  for (let i = 0; i < digitos.length; i++) {
    suma += parseInt(digitos[i]) * (MODULO11_PESOS[i] || 2)
  }
  const resto = suma % 11
  const dv = 11 - resto
  if (dv === 11) return 0
  if (dv === 10) return 1
  return dv
}

/**
 * Genera un CDC de 44 caracteres según especificación SIFEN v150:
 * TipoDoc(2) + RUC(8) + DV(1) + Est(3) + PtoExp(3) + Timbrado(8) +
 * Fecha(8: AAAAMMDD) + NumDoc(7) + TipoEmision(1) + DV CDC(1) + CodSeg(2)
 */
export function generarCDC({ tipoDE = 1, rucEmisor, dvEmisor, establecimiento, puntoExp, timbrado, fechaEmision, numeroDoc, tipoEmision = 1, codigoSeguridad }) {
  const tipo = String(tipoDE).padStart(2, '0')
  const ruc = String(rucEmisor || '').padStart(8, '0')
  const dv = String(dvEmisor || 0)
  const est = String(establecimiento || 1).padStart(3, '0')
  const pto = String(puntoExp || 1).padStart(3, '0')
  const timb = String(timbrado || '').padStart(8, '0')
  const fecha = String(fechaEmision || '').replace(/-/g, '').slice(0, 8)
  const num = String(numeroDoc || 1).padStart(7, '0')
  const tEmi = String(tipoEmision)
  const codSeg = String(codigoSeguridad || '01').padStart(2, '0')

  const base = `${tipo}${ruc}${dv}${est}${pto}${timb}${fecha}${num}${tEmi}${codSeg}`
  const dvCDC = digitoVerificadorModulo11(base)

  const cdc = `${base}${dvCDC}`

  return { cdc, dv: dvCDC, base }
}

export function extraerDVCDC(cdc) {
  if (!cdc || cdc.length < 44) return null
  return parseInt(cdc.slice(-1))
}
