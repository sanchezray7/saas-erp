import { useEffect, useState, useCallback } from 'react'
import { useAuth, Button, ConfirmModal, alertError, notify } from '@saas/core'
import { listarCajas, guardarCaja, eliminarCaja, abrirCaja, cerrarCaja } from '../data/pos'

export function CajasPage() {
  const { activeCompanyId } = useAuth()
  const [cajas, setCajas] = useState([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(null)
  const [eliminando, setEliminando] = useState(null)
  const [cerrando, setCerrando] = useState(null)
  const [saldoCierre, setSaldoCierre] = useState(0)

  const load = useCallback(async () => {
    try { setCajas(await listarCajas(activeCompanyId)) }
    catch (err) { alertError('Error', err.message) }
    finally { setLoading(false) }
  }, [activeCompanyId])

  useEffect(() => { load() }, [load])

  async function handleGuardar(e) {
    e.preventDefault()
    if (!editando.nombre.trim()) return
    try {
      await guardarCaja(activeCompanyId, editando)
      notify(editando.id ? 'Caja actualizada' : 'Caja creada')
      setEditando(null)
      load()
    } catch (err) { alertError('Error', err.message) }
  }

  async function handleAbrir(caja) {
    try {
      await abrirCaja(caja.id, 0)
      notify('Caja abierta')
      load()
    } catch (err) { alertError('Error', err.message) }
  }

  async function handleCerrar() {
    if (!cerrando) return
    try {
      await cerrarCaja(cerrando.id, saldoCierre)
      notify('Caja cerrada — corte Z generado')
      setCerrando(null)
      setSaldoCierre(0)
      load()
    } catch (err) { alertError('Error', err.message) }
  }

  if (loading) return <p className="meta">Cargando...</p>

  return (
    <div className="card">
      <div className="page-header">
        <h1>🏦 Cajas</h1>
        <Button size="sm" onClick={() => setEditando({ nombre: '' })}>+ Nueva caja</Button>
      </div>

      <table className="table">
        <thead>
          <tr><th>Nombre</th><th>Estado</th><th>Saldo actual</th><th>Apertura</th><th></th></tr>
        </thead>
        <tbody>
          {cajas.map((c) => (
            <tr key={c.id}>
              <td style={{ fontWeight: 600 }}>{c.nombre}</td>
              <td><span className={`badge ${c.estado === 'abierta' ? 'badge--success' : ''}`}>{c.estado}</span></td>
              <td>{Number(c.saldo_actual).toLocaleString()} Gs.</td>
              <td className="meta">{c.apertura_en ? new Date(c.apertura_en).toLocaleString('es-PY') : '—'}</td>
              <td style={{ display: 'flex', gap: 4 }}>
                {c.estado === 'cerrada' && <Button size="sm" onClick={() => handleAbrir(c)}>Abrir</Button>}
                {c.estado === 'abierta' && <Button size="sm" onClick={() => { setCerrando(c); setSaldoCierre(c.saldo_actual) }}>Cerrar</Button>}
                <Button size="sm" variant="ghost" onClick={() => setEditando(c)}>✏️</Button>
                {c.estado === 'cerrada' && <Button size="sm" variant="ghost" onClick={() => setEliminando(c.id)}>🗑️</Button>}
              </td>
            </tr>
          ))}
          {cajas.length === 0 && <tr><td colSpan={5} className="meta" style={{ textAlign: 'center', padding: 24 }}>No hay cajas registradoras</td></tr>}
        </tbody>
      </table>

      {/* Modal editar/crear */}
      {editando && (
        <div className="modal-overlay" onClick={() => setEditando(null)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
            <h3>{editando.id ? 'Editar caja' : 'Nueva caja'}</h3>
            <form onSubmit={handleGuardar}>
              <div className="form-field">
                <label>Nombre</label>
                <input className="form-input" value={editando.nombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} required autoFocus />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <Button type="button" variant="ghost" onClick={() => setEditando(null)}>Cancelar</Button>
                <Button type="submit">{editando.id ? 'Guardar' : 'Crear'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal cerrar caja */}
      {cerrando && (
        <div className="modal-overlay" onClick={() => setCerrando(null)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
            <h3>Cerrar caja: {cerrando.nombre}</h3>
            <p className="meta" style={{ marginBottom: 12 }}>Saldo actual: {Number(cerrando.saldo_actual).toLocaleString()} Gs.</p>
            <div className="form-field">
              <label>Saldo real (conteo físico)</label>
              <input type="number" className="form-input" value={saldoCierre} onChange={(e) => setSaldoCierre(Number(e.target.value) || 0)} autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <Button variant="ghost" onClick={() => setCerrando(null)}>Cancelar</Button>
              <Button onClick={handleCerrar}>Confirmar cierre</Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal open={!!eliminando} onConfirm={async () => { await eliminarCaja(eliminando); setEliminando(null); load() }} onCancel={() => setEliminando(null)} title="¿Eliminar caja?" />
    </div>
  )
}
