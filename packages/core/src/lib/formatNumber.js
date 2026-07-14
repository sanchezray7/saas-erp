export function formatNumber(n, locale = 'es-ES') {
  if (n == null) return '—'
  return Number(n).toLocaleString(locale)
}

export function formatPercent(n, decimals = 1) {
  if (n == null) return '—'
  return `${Number(n).toFixed(decimals)}%`
}
