import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth, Button, Skeleton, formatMoney, alertError, notify, getSupabase } from '@saas/core'
import { obtenerAsiento, anularAsiento, eliminarAsiento } from '../data/asientos'

export function AsientoDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [asiento, setAsiento] = useState(null)
  const [loading, setLoading] = useState(true)
  const [accionando, setAccionando] = useState(false)

  useEffect(() => {
    obtenerAsiento(id).then(setAsiento).catch(() => {}).finally(() => setLoading(false))
  }, [id])

  async function handleAnular() {
    if (!window.confirm(`¿Anular el asiento ${asiento.entry_number}? Queda registrado como anulado para auditoría.`)) return
    setAccionando(true)
    try {
      await anularAsiento(id)
      notify('Asiento anulado')
      const updated = await obtenerAsiento(id)
      setAsiento(updated)
    } catch (err) { alertError('Error', err.message) }
    finally { setAccionando(false) }
  }

  async function handleContabilizar() {
    setAccionando(true)
    try {
      const supabase = getSupabase()
      const { error } = await supabase.from('journal_entries').update({ estado: 'contabilizado' }).eq('id', id)
      if (error) throw error
      notify('Asiento contabilizado')
      const updated = await obtenerAsiento(id)
      setAsiento(updated)
    } catch (err) { alertError('Error', err.message) }
    finally { setAccionando(false) }
  }

  async function handleEliminar() {
    if (!window.confirm(`¿Eliminar permanentemente el asiento ${asiento.entry_number}?`)) return
    setAccionando(true)
    try {
      await eliminarAsiento(id)
      notify('Asiento eliminado')
      navigate('/asientos')
    } catch (err) { alertError('Error', err.message) }
    finally { setAccionando(false) }
  }

  if (loading) return <Skeleton.Card />
  if (!asiento) return <div className="card"><p className="meta">Asiento no encontrado</p></div>

  const lines = asiento.lines || []
  const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0)
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0)
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <Link to="/asientos"><Button variant="ghost" size="sm">Volver</Button></Link>
        {asiento.estado === 'contabilizado' && (
          <Button size="sm" danger onClick={handleAnular} disabled={accionando} style={{ marginLeft: 8 }}>
            {accionando ? 'Anulando...' : '🗑 Anular'}
          </Button>
        )}
        {asiento.estado === 'borrador' && (
          <>
            <Button size="sm" onClick={handleContabilizar} disabled={accionando} style={{ marginLeft: 8 }}>
              {accionando ? 'Contabilizando...' : '✅ Contabilizar'}
            </Button>
            <Button size="sm" danger onClick={handleEliminar} disabled={accionando} style={{ marginLeft: 4 }}>
              {accionando ? 'Eliminando...' : '🗑 Eliminar'}
            </Button>
          </>
        )}
      </div>

      <div className="card">
        <div className="page-header" style={{ marginBottom: 12 }}>
          <div>
            <h1 style={{ fontSize: '1rem', margin: 0, fontFamily: 'monospace' }}>{asiento.entry_number}</h1>
            <p className="meta" style={{ fontSize: '0.82rem' }}>{asiento.description}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="meta">{asiento.entry_date?.slice(0, 10)}</div>
            <div><span className="badge" style={{
              background: asiento.estado === 'contabilizado' ? '#dcfce7' : asiento.estado === 'anulado' ? '#f5f5f5' : '#fef3c7',
              color: asiento.estado === 'contabilizado' ? '#16a34a' : asiento.estado === 'anulado' ? '#9ca3af' : '#d97706',
            }}>{asiento.estado}</span></div>
            <div style={{ fontWeight: 600, color: balanced ? '#16a34a' : '#dc2626' }}>
              {balanced ? '✅ Cuadrado' : '❌ Descadrado'}
            </div>
          </div>
        </div>

        <table className="table" style={{ fontSize: '0.82rem' }}>
          <thead>
            <tr>
              <th>Cuenta</th>
              <th>Descripción</th>
              <th style={{ textAlign: 'right', width: 120 }}>Débito</th>
              <th style={{ textAlign: 'right', width: 120 }}>Crédito</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id}>
                <td data-label="Cuenta">
                  <span className="badge" style={{ fontSize: '0.72rem', fontFamily: 'monospace' }}>{l.account?.code}</span>
                  <span style={{ marginLeft: 6 }}>{l.account?.name || '—'}</span>
                </td>
                <td data-label="Descripción" className="meta">{l.description || '—'}</td>
                <td data-label="Débito" style={{ textAlign: 'right', fontWeight: 600, color: l.debit > 0 ? '#16a34a' : undefined }}>{l.debit > 0 ? formatMoney(l.debit, 'PYG') : ''}</td>
                <td data-label="Crédito" style={{ textAlign: 'right', fontWeight: 600, color: l.credit > 0 ? '#dc2626' : undefined }}>{l.credit > 0 ? formatMoney(l.credit, 'PYG') : ''}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700, borderTop: '2px solid var(--color-border)' }}>
              <td data-label="" colSpan={2}>Totales</td>
              <td data-label="Total Débito" style={{ textAlign: 'right', color: '#16a34a' }}>{formatMoney(totalDebit, 'PYG')}</td>
              <td data-label="Total Crédito" style={{ textAlign: 'right', color: '#dc2626' }}>{formatMoney(totalCredit, 'PYG')}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
