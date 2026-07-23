import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, Button, Skeleton, alertError } from '@saas/core'
import { listarPresupuestos, eliminarPresupuesto } from '../data/presupuestos'

const ESTADOS = {
  borrador: '📄 Borrador', enviado: '📨 Enviado', aprobado: '✅ Aprobado', rechazado: '❌ Rechazado',
}

export function PresupuestosPage() {
  const { activeCompanyId } = useAuth()
  const [presupuestos, setPresupuestos] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try { setPresupuestos(await listarPresupuestos(activeCompanyId)) }
    catch (err) { alertError('Error', err.message) }
    finally { setLoading(false) }
  }, [activeCompanyId])

  useEffect(() => { load() }, [load])

  async function handleEliminar(id) {
    if (!window.confirm('¿Eliminar este presupuesto?')) return
    try { await eliminarPresupuesto(id); load() }
    catch (err) { alertError('Error', err.message) }
  }

  if (loading) return <Skeleton.Card />

  return (
    <div className="card">
      <div className="page-header">
        <h1>📋 Presupuestos</h1>
        <Link to="/presupuestos/nuevo" className="btn">+ Nuevo presupuesto</Link>
      </div>
      {presupuestos.length === 0 ? (
        <p className="meta" style={{ textAlign: 'center', padding: 32 }}>Sin presupuestos.</p>
      ) : (
        <table className="table" style={{ fontSize: '0.82rem' }}>
          <thead><tr>
            <th>#</th><th>Cliente</th><th>Fecha</th><th>Total</th><th>Estado</th><th></th>
          </tr></thead>
          <tbody>
            {presupuestos.map((p) => (
              <tr key={p.id}>
                <td className="meta">{p.numero}</td>
                <td><Link to={`/presupuestos/${p.id}`} style={{ fontWeight: 600 }}>{p.contacto || '—'}</Link></td>
                <td className="meta">{p.fecha_emision}</td>
                <td style={{ fontWeight: 700 }}>${Number(p.total).toLocaleString()}</td>
                <td>{ESTADOS[p.estado] || p.estado}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Link to={`/presupuestos/${p.id}`} className="btn-icon">👁️</Link>
                    {p.estado === 'borrador' && <button onClick={() => handleEliminar(p.id)} className="btn-icon" style={{ color: '#ef4444' }}>🗑️</button>}
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
