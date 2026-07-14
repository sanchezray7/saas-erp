import { useState, useEffect } from 'react'
import { listarImpuestos } from '../data/impuestos'
import { TaxBreakdown } from './TaxBreakdown'

export function TaxSelector({ companyId, selectedTaxes, onChange, baseAmount, moneda, ivaIncluido = false, context = 'proveedor' }) {
  const [allTaxes, setAllTaxes] = useState([])
  const [grupos, setGrupos] = useState([])

  useEffect(() => {
    if (!companyId) return
    listarImpuestos(companyId).then((data) => {
      setAllTaxes(data)
      const g = {}
      data.forEach((t) => { if (t.tax_group) { const key = t.tax_group.id; if (!g[key]) g[key] = { ...t.tax_group, taxes: [] }; g[key].taxes.push(t) } })
      setGrupos(Object.values(g))
    }).catch(() => {})
  }, [companyId])

  const tiposPermitidos = context === 'proveedor' ? ['credito_fiscal', 'retencion_compra'] : ['debito_fiscal', 'retencion_venta']
  const gruposFiltrados = grupos.filter((g) => tiposPermitidos.includes(g.type))

  const selectedIds = new Set((selectedTaxes || []).map((t) => t.id))

  function toggle(tax) {
    if (selectedIds.has(tax.id)) {
      onChange((selectedTaxes || []).filter((t) => t.id !== tax.id))
    } else {
      onChange([...(selectedTaxes || []), { id: tax.id, name: tax.name, percentage: tax.percentage, is_withholding: tax.is_withholding, tax_group: tax.tax_group }])
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
        {gruposFiltrados.map((g) => (
          <details key={g.id} style={{ fontSize: '0.82rem' }}>
            <summary style={{ fontWeight: 600, cursor: 'pointer', marginBottom: 4 }}>
              {g.name} ({g.type})
            </summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 12 }}>
              {g.taxes.map((t) => (
                <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '2px 0' }}>
                  <input type="checkbox" checked={selectedIds.has(t.id)} onChange={() => toggle(t)} />
                  <span>{t.name} ({Number(t.percentage).toFixed(1)}%)</span>
                  {t.is_withholding && <span className="badge" style={{ fontSize: '0.7rem', background: '#fef3c7', color: '#d97706' }}>Retención</span>}
                </label>
              ))}
            </div>
          </details>
        ))}
        {gruposFiltrados.length === 0 && <p className="meta" style={{ fontSize: '0.78rem' }}>Sin impuestos configurados para {context === 'proveedor' ? 'compras' : 'ventas'}. Creá grupos e impuestos en Configuración.</p>}
      </div>

      {baseAmount > 0 && selectedTaxes?.length > 0 && (
        <TaxBreakdown taxes={selectedTaxes} baseAmount={baseAmount} moneda={moneda} ivaIncluido={ivaIncluido} />
      )}
    </div>
  )
}
