export function validarTaxId(pais, valor) {
  if (!valor) return { valido: false, formateado: '', mensaje: 'Requerido' }

  const limpio = valor.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()

  switch (pais) {
    case 'PY': // RUC: 6-8 dígitos + guión + dígito verificador
      return validarRucPy(limpio)
    case 'AR': // CUIT: 11 dígitos
      return validarCuitAr(limpio)
    case 'CL': // RUT: 7-8 dígitos + dígito verificador
      return validarRutCl(limpio)
    case 'CO': // NIT: 9-15 dígitos
      return validarNitCo(limpio)
    case 'PE': // RUC: 11 dígitos
      return validarRucPe(limpio)
    case 'UY': // RUT: 12 dígitos
      return validarRutUy(limpio)
    case 'BO': // NIT: 7-15 dígitos
      return validarNitBo(limpio)
    case 'EC': // RUC: 13 dígitos
      return validarRucEc(limpio)
    case 'VE': // RIF: letra + 8 dígitos
      return validarRifVe(limpio)
    case 'MX': // RFC: 13 caracteres
      return validarRfcMx(limpio)
    case 'BR': // CNPJ: 14 dígitos
      return validarCnpjBr(limpio)
    default:
      return { valido: limpio.length >= 3, formateado: valor, mensaje: '' }
  }
}

function validarRucPy(limpio) {
  // RUC Paraguay: dígitos (6-8) + dígito verificador (1)
  const match = limpio.match(/^(\d{6,8})(\d)$/)
  if (!match) return { valido: false, formateado: limpio, mensaje: 'Debe ser 6-8 dígitos + dígito verificador (ej: 1234567-8)' }
  return { valido: true, formateado: `${match[1]}-${match[2]}`, mensaje: '' }
}

function validarCuitAr(limpio) {
  if (!/^\d{11}$/.test(limpio)) return { valido: false, formateado: limpio, mensaje: 'Debe tener 11 dígitos (ej: 20-12345678-9)' }
  return { valido: true, formateado: `${limpio.slice(0, 2)}-${limpio.slice(2, 10)}-${limpio.slice(10)}`, mensaje: '' }
}

function validarRutCl(limpio) {
  const match = limpio.match(/^(\d{7,8})([0-9K])$/)
  if (!match) return { valido: false, formateado: limpio, mensaje: 'Debe ser 7-8 dígitos + dígito verificador (ej: 12345678-9)' }
  return { valido: true, formateado: `${match[1]}-${match[2]}`, mensaje: '' }
}

function validarNitCo(limpio) {
  if (limpio.length < 9 || limpio.length > 15) return { valido: false, formateado: limpio, mensaje: 'Debe tener entre 9 y 15 dígitos' }
  return { valido: true, formateado: limpio, mensaje: '' }
}

function validarRucPe(limpio) {
  if (!/^\d{11}$/.test(limpio)) return { valido: false, formateado: limpio, mensaje: 'Debe tener 11 dígitos (ej: 12345678901)' }
  return { valido: true, formateado: limpio, mensaje: '' }
}

function validarRutUy(limpio) {
  if (!/^\d{12}$/.test(limpio)) return { valido: false, formateado: limpio, mensaje: 'Debe tener 12 dígitos' }
  return { valido: true, formateado: limpio, mensaje: '' }
}

function validarNitBo(limpio) {
  if (limpio.length < 7 || limpio.length > 15) return { valido: false, formateado: limpio, mensaje: 'Debe tener entre 7 y 15 dígitos' }
  return { valido: true, formateado: limpio, mensaje: '' }
}

function validarRucEc(limpio) {
  if (!/^\d{13}$/.test(limpio)) return { valido: false, formateado: limpio, mensaje: 'Debe tener 13 dígitos' }
  return { valido: true, formateado: `${limpio.slice(0, 10)}-${limpio.slice(10)}`, mensaje: '' }
}

function validarRifVe(limpio) {
  const match = limpio.match(/^([JPGVEJ])?(\d{8})(\d)$/)
  if (!match) return { valido: false, formateado: limpio, mensaje: 'Debe ser letra + 8 dígitos + dígito verificador (ej: J-12345678-9)' }
  return { valido: true, formateado: `${match[1]}-${match[2]}-${match[3]}`, mensaje: '' }
}

function validarRfcMx(limpio) {
  if (!/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(limpio)) return { valido: false, formateado: limpio, mensaje: 'RFC inválido (ej: ABC123456XYZ)' }
  return { valido: true, formateado: limpio, mensaje: '' }
}

function validarCnpjBr(limpio) {
  if (!/^\d{14}$/.test(limpio)) return { valido: false, formateado: limpio, mensaje: 'Debe tener 14 dígitos (ej: 12.345.678/0001-90)' }
  return { valido: true, formateado: `${limpio.slice(0, 2)}.${limpio.slice(2, 5)}.${limpio.slice(5, 8)}/${limpio.slice(8, 12)}-${limpio.slice(12)}`, mensaje: '' }
}
