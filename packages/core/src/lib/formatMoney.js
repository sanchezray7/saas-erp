const SIMBOLOS = {
  PYG: 'Gs.',
  USD: '$',
  ARS: '$',
  CLP: '$',
  COP: '$',
  PEN: 'S/',
  UYU: '$U',
  BOB: 'Bs.',
  MXN: '$',
  BRL: 'R$',
}

const DECIMALES_POR_MONEDA = {
  PYG: 0,
}

export function formatMoney(amount, currency = 'USD') {
  if (amount == null) return '—'
  const sym = SIMBOLOS[currency] || currency
  const decimals = DECIMALES_POR_MONEDA[currency] ?? 2
  const n = Number(amount).toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return `${sym} ${n}`
}

export const MONEDA_POR_PAIS = {
  PY: 'PYG', AR: 'ARS', CL: 'CLP', CO: 'COP',
  PE: 'PEN', UY: 'UYU', BO: 'BOB', EC: 'USD',
  VE: 'USD', MX: 'MXN', BR: 'BRL',
}

export function formatearFecha(isoDate, pais) {
  if (!isoDate) return '—'
  const [y, m, d] = isoDate.slice(0, 10).split('-')
  if (pais === 'US') return `${m}/${d}/${y}`
  return `${d}/${m}/${y}`
}
