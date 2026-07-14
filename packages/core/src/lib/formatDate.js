export function formatDate(date) {
  if (!date) return '—'
  const d = new Date(date)
  return d.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatDateTime(date) {
  if (!date) return '—'
  const d = new Date(date)
  return d.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
