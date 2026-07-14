import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth, Button, Skeleton, formatMoney, alertError, notify } from '@saas/core'
import { obtenerNota, emitirNota } from '../data/notasCD'

const BADGE = {
  borrador: { bg: '#f5f5f5', color: '#6b7280' },
  emitida: { bg: '#e0f2fe', color: '#0284c7' },
  aprobada: { bg: '#dcfce7', color: '#16a34a' },
  rechazada: { bg: '#fef2f2', color: '#dc2626' },
  cancelada: { bg: '#f5f5f5', color: '#9ca3af' },
}

export function NotaCDDetailPage() {
  const { id } = useParams()
  const { activeCompanyId } = useAuth()
  const [nota, setNota] = useState(null)
  const [loading, setLoading] = useState(true)
  const [emitiendo, setEmitiendo] = useState(false)

  useEffect(() => {
    obtenerNota(id).then(setNota).catch(() => {}).finally(() => setLoading(false))
  }, [id])

  async function handleEmitir() {
    if (!window.confirm('¿Emitir esta nota a SIFEN?')) return
    setEmitiendo(true)
    try {
      const supabase = (await import('@saas/core')).getSupabase()
      const { data: company } = await supabase.from('companies').select('*').eq('id', activeCompanyId).single()
      const res = await emitirNota(id, company)
      if (res.estado === 'aprobada') {
        notify(`Nota emitida y aprobada. CDC: ${res.cdc}`)
      } else {
        alertError('Nota rechazada', res.errores?.map((e) => e.descripcion).join(', ') || 'Error desconocido')
      }
      const updated = await obtenerNota(id)
      setNota(updated)
    } catch (err) { alertError('Error', err.message) }
    finally { setEmitiendo(false) }
  }

  if (loading) return <Skeleton.Card />
  if (!nota) return <div className="card"><p className="meta">Nota no encontrada</p></div>

  const badge = BADGE[nota.estado] || BADGE.borrador
  const items = nota.items || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link to="/notas-cd"><Button variant="ghost" size="sm">Volver</Button></Link>
        {nota.estado === 'borrador' && (
          <Button size="sm" onClick={handleEmitir} disabled={emitiendo}>
            {emitiendo ? 'Emitiendo...' : '📡 Emitir a SIFEN'}
          </Button>
        )}
      </div>

      <div className="card">
        <div className="page-header">
          <div>
            <h1 style={{ fontSize: '1rem', margin: 0 }}>
              {nota.tipo === 'credito' ? '🧾 Nota de Crédito' : '📈 Nota de Débito'}
            </h1>
            <p className="meta" style={{ fontFamily: 'monospace' }}>{nota.numero || '—'}</p>
          </div>
          <span className="badge" style={{ background: badge.bg, color: badge.color, fontSize: '0.85rem', padding: '4px 12px' }}>{nota.estado}</span>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', marginBottom: 16 }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Factura origen</div>
            <div>{nota.factura_origen?.numero || '—'}</div>
            <div className="meta" style={{ fontSize: '0.72rem', wordBreak: 'break-all' }}>CDC: {nota.factura_origen?.cdc || '—'}</div>
          </div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Motivo</div>
            <div>{nota.motivo}</div>
          </div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>CDC</div>
            <div className="meta" style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{nota.cdc || '—'}</div>
          </div>
        </div>

        <table className="table" style={{ marginBottom: 16 }}>
          <thead>
            <tr>
              <th>Descripción</th>
              <th style={{ textAlign: 'right' }}>Cant.</th>
              <th style={{ textAlign: 'right' }}>Precio</th>
              <th style={{ textAlign: 'right' }}>IVA</th>
              <th style={{ textAlign: 'right' }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const sub = Number(item.cantidad || 0) * Number(item.precioUnitario || 0)
              return (
                <tr key={idx}>
                  <td style={{ fontWeight: 600 }}>{item.descripcion || '—'}</td>
                  <td style={{ textAlign: 'right' }}>{Number(item.cantidad).toLocaleString()}</td>
                  <td style={{ textAlign: 'right' }}>{formatMoney(item.precioUnitario, nota.moneda)}</td>
                  <td style={{ textAlign: 'right' }}>{Number(item.tasaIVA || 0).toFixed(1)}%</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatMoney(sub, nota.moneda)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.9rem' }}>Subtotal: {formatMoney(nota.subtotal, nota.moneda)}</div>
          <div style={{ fontSize: '0.9rem' }}>IVA: {formatMoney(nota.impuesto, nota.moneda)}</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: nota.tipo === 'credito' ? '#dc2626' : '#16a34a' }}>
            {nota.tipo === 'credito' ? '−' : '+'} {formatMoney(nota.total, nota.moneda)}
          </div>
        </div>

        {nota.xml_generado && (
          <details style={{ marginTop: 16 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>📄 Ver XML generado</summary>
            <pre style={{ marginTop: 8, padding: 12, background: '#1e1e1e', color: '#d4d4d4', borderRadius: 6, fontSize: '0.72rem', overflowX: 'auto', maxHeight: 400, whiteSpace: 'pre-wrap' }}>{nota.xml_generado}</pre>
          </details>
        )}

        {nota.errores && (
          <div style={{ marginTop: 16, padding: 12, background: '#fef2f2', borderRadius: 6, border: '1px solid #fecaca' }}>
            <div style={{ fontWeight: 600, color: '#dc2626', marginBottom: 4 }}>Errores SIFEN</div>
            <p className="meta" style={{ color: '#dc2626' }}>{nota.errores}</p>
          </div>
        )}
      </div>
    </div>
  )
}
