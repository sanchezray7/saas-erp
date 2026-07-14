import { useMemo } from 'react'
import { calcularResumenImpuestos } from '../data/impuestos'

export function TaxBreakdown({ taxes, baseAmount, moneda, ivaIncluido = false }) {
  const resumen = useMemo(() => calcularResumenImpuestos(taxes, baseAmount, ivaIncluido), [taxes, baseAmount, ivaIncluido])

  if (!taxes || taxes.length === 0) return null

  const fmt = (n) => (n || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

  return (
    <div style={{ fontSize: '0.85rem' }}>
      {ivaIncluido && (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>
          <span>Subtotal (sin IVA)</span>
          <span style={{ fontWeight: 600 }}>{fmt(resumen.baseSinIva)} {moneda}</span>
        </div>
      )}
      {resumen.lines.map((t, i) => (
        <div key={t.id || i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
          <span>{t.is_withholding ? '⛔' : '🧾'} {t.name} ({Number(t.percentage).toFixed(1)}%)</span>
          <span style={{ fontWeight: 600 }}>{t.is_withholding ? '-' : '+'} {fmt(t.tax_amount)} {moneda}</span>
        </div>
      ))}
      <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '4px 0' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.9rem' }}>
        <span>Total</span>
        <span>{fmt(resumen.total)} {moneda}</span>
      </div>
    </div>
  )
}
