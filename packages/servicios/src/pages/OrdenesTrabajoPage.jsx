import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, Button, Skeleton, alertError } from '@saas/core'
import { listarOrdenesTrabajo, cancelarOT } from '../data/ordenes'

const ESTADOS = {
  pendiente: '🟡 Pendiente', en_progreso: '🔵 En progreso', completada: '✅ Completada', cancelada: '❌ Cancelada',
}
const PRIORIDADES = {
  baja: '🟢 Baja', normal: '🔵 Normal', alta: '🟠 Alta', urgente: '🔴 Urgente',
}

export function OrdenesTrabajoPage() {
  const { activeCompanyId } = useAuth()
  const [ordenes, setOrdenes] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try { setOrdenes(await listarOrdenesTrabajo(activeCompanyId)) }
    catch (err) { alertError('Error', err.message) }
    finally { setLoading(false) }
  }, [activeCompanyId])

  useEffect(() => { load() }, [load])

  async function handleCancelar(id) {
    if (!window.confirm('¿Cancelar esta orden de trabajo?')) return
    try { await cancelarOT(id); load() }
    catch (err) { alertError('Error', err.message) }
  }

  if (loading) return <Skeleton.Card />

  return (
    <div className="card">
      <div className="page-header">
        <h1>⚡ Órdenes de trabajo</h1>
        <Link to="/ordenes-trabajo/nueva" className="btn">+ Nueva OT</Link>
      </div>
      {ordenes.length === 0 ? (
        <p className="meta" style={{ textAlign: 'center', padding: 32 }}>Sin órdenes de trabajo.</p>
      ) : (
        <table className="table" style={{ fontSize: '0.82rem' }}>
          <thead><tr>
            <th>#</th><th>Título</th><th>Cliente</th><th>Prioridad</th><th>Estado</th><th>Fecha</th><th></th>
          </tr></thead>
          <tbody>
            {ordenes.map((o) => (
              <tr key={o.id}>
                <td className="meta">{o.numero}</td>
                <td><Link to={`/ordenes-trabajo/${o.id}`} style={{ fontWeight: 600 }}>{o.titulo}</Link></td>
                <td>{o.contacto || '—'}</td>
                <td>{PRIORIDADES[o.prioridad] || o.prioridad}</td>
                <td>{ESTADOS[o.estado] || o.estado}</td>
                <td className="meta">{o.created_at ? new Date(o.created_at).toLocaleDateString() : '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Link to={`/ordenes-trabajo/${o.id}`} className="btn-icon">👁️</Link>
                    {(o.estado === 'pendiente' || o.estado === 'en_progreso') &&
                      <button onClick={() => handleCancelar(o.id)} className="btn-icon" style={{ color: '#ef4444' }}>🗑️</button>
                    }
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
