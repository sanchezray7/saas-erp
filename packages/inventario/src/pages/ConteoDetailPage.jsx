import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth, Button, Skeleton, alertError, notify } from '@saas/core'
import { obtenerConteo, actualizarCantidadContada, ajustarConteo } from '../data/conteos'

const BADGE_ESTADO = {
  abierto: { bg: '#fef3c7', color: '#d97706' },
  contando: { bg: '#e0f2fe', color: '#0284c7' },
  cerrado: { bg: '#dcfce7', color: '#16a34a' },
}

export function ConteoDetailPage() {
  const { id } = useParams()
  const { activeCompanyId, user } = useAuth()
  const [conteo, setConteo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(false)
  const [ajustando, setAjustando] = useState(false)

  useEffect(() => {
    obtenerConteo(id).then(setConteo).catch(() => {}).finally(() => setLoading(false))
  }, [id])

  async function handleChangeCantidad(itemId, value) {
    setEditando(true)
    try {
      await actualizarCantidadContada(itemId, value)
      const updated = await obtenerConteo(id)
      setConteo(updated)
    } catch (err) { alertError('Error', err.message) }
    finally { setEditando(false) }
  }

  async function handleAjustar() {
    if (!window.confirm('¿Ajustar el stock según las diferencias del conteo?')) return
    setAjustando(true)
    try {
      await ajustarConteo(id, activeCompanyId, user?.id)
      notify('Stock ajustado correctamente')
      const updated = await obtenerConteo(id)
      setConteo(updated)
    } catch (err) { alertError('Error', err.message) }
    finally { setAjustando(false) }
  }

  if (loading) return <Skeleton.Card />
  if (!conteo) return <div className="card"><p className="meta">Conteo no encontrado</p></div>

  const badge = BADGE_ESTADO[conteo.estado] || BADGE_ESTADO.abierto
  const items = conteo.items || []
  const hayDiferencias = items.some((i) => Number(i.diferencia) !== 0)
  const totalDif = items.reduce((s, i) => s + Math.abs(Number(i.diferencia)), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <div>
            <h1 style={{ fontSize: '1rem', margin: 0, fontFamily: 'monospace' }}>{conteo.numero}</h1>
            <p className="meta" style={{ fontSize: '0.82rem' }}>Almacén: {conteo.almacen?.nombre || '—'} · {conteo.fecha?.slice(0, 10)}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="badge" style={{ background: badge.bg, color: badge.color, fontSize: '0.85rem', padding: '4px 12px' }}>{conteo.estado}</span>
            {conteo.asiento && (
              <div style={{ marginTop: 8 }}>
                <Link to={`/asientos/${conteo.asiento.id}`} className="link" style={{ fontSize: '0.82rem' }}>
                  📒 Ver asiento contable ({conteo.asiento.entry_number})
                </Link>
              </div>
            )}
            {conteo.estado !== 'cerrado' && (
              <div style={{ marginTop: 8 }}>
                <Button size="sm" onClick={handleAjustar} disabled={ajustando || editando || !hayDiferencias} style={{ marginRight: 8 }}>
                  {ajustando ? 'Ajustando...' : '✅ Ajustar diferencias'}
                </Button>
                <Link to="/conteos"><Button variant="ghost" size="sm">Volver</Button></Link>
              </div>
            )}
          </div>
        </div>

        {items.length === 0 ? (
          <p className="meta" style={{ textAlign: 'center', padding: 24 }}>Sin items</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ fontSize: '0.82rem', minWidth: 500 }}>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Lote</th>
                  <th style={{ textAlign: 'right' }}>Sistema</th>
                  <th style={{ textAlign: 'right' }}>Contado</th>
                  <th style={{ textAlign: 'right' }}>Dif.</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const dif = Number(item.diferencia)
                  return (
                    <tr key={item.id} style={{ background: dif === 0 ? undefined : dif > 0 ? '#f0fdf4' : '#fef2f2' }}>
                      <td style={{ fontWeight: 600 }}>{item.producto?.nombre || '—'}</td>
                      <td className="meta">{item.lote || '—'}</td>
                      <td style={{ textAlign: 'right' }}>{Number(item.cantidad_sistema).toLocaleString()}</td>
                      <td style={{ textAlign: 'right' }}>
                        {conteo.estado !== 'cerrado' ? (
                          <input className="form-input" type="number" min="0" step="1"
                            defaultValue={item.cantidad_contada != null ? Number(item.cantidad_contada) : ''}
                            onBlur={(e) => handleChangeCantidad(item.id, e.target.value)}
                            style={{ width: 80, fontSize: '0.82rem', padding: '4px 8px', textAlign: 'right' }} />
                        ) : (
                          <span style={{ fontWeight: 600 }}>{Number(item.cantidad_contada).toLocaleString()}</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: dif > 0 ? '#16a34a' : dif < 0 ? '#dc2626' : undefined }}>
                        {dif !== 0 ? (dif > 0 ? '+' : '') + dif.toLocaleString() : '0'}
                      </td>
                      <td>{dif === 0 ? <span className="badge" style={{ background: '#dcfce7', color: '#16a34a' }}>Ok</span> : <span className="badge" style={{ background: dif > 0 ? '#fef3c7' : '#fef2f2', color: dif > 0 ? '#d97706' : '#dc2626' }}>{dif > 0 ? 'Sobra' : 'Falta'}</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700, borderTop: '2px solid var(--color-border)' }}>
                  <td colSpan={4}>Total diferencias</td>
                  <td style={{ textAlign: 'right' }}>{totalDif.toLocaleString()}</td>
                  <td>{hayDiferencias ? '⚠️ Pendiente' : '✅ Sin diferencias'}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
