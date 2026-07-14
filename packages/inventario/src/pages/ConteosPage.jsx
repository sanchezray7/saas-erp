import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth, Button, Skeleton, alertError, notify } from '@saas/core'
import { listarConteos, crearConteo } from '../data/conteos'
import { listarAlmacenes } from '../data/inventario'
import { listarProductos } from '@saas/productos'

const BADGE_ESTADO = {
  abierto: { bg: '#fef3c7', color: '#d97706' },
  contando: { bg: '#e0f2fe', color: '#0284c7' },
  cerrado: { bg: '#dcfce7', color: '#16a34a' },
}

export function ConteosPage() {
  const navigate = useNavigate()
  const { activeCompanyId, user, can } = useAuth()
  const canEdit = can?.('config_crear')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNuevo, setShowNuevo] = useState(false)
  const [almacenes, setAlmacenes] = useState([])
  const [productos, setProductos] = useState([])
  const [nuevoForm, setNuevoForm] = useState({ almacen_id: '', productos: [] })
  const [creando, setCreando] = useState(false)

  const load = useCallback(async () => {
    try { setData(await listarConteos(activeCompanyId)) }
    catch (err) { alertError('Error', err.message) }
    finally { setLoading(false) }
  }, [activeCompanyId])

  useEffect(() => { load() }, [load])

  function abrirNuevo() {
    Promise.all([listarAlmacenes(activeCompanyId), listarProductos(activeCompanyId)]).then(([a, p]) => {
      setAlmacenes(a); setProductos(p.filter((pr) => pr.activo))
    }).catch(() => {})
    setShowNuevo(true)
  }

  function toggleProducto(id) {
    setNuevoForm((p) => ({
      ...p,
      productos: p.productos.includes(id) ? p.productos.filter((x) => x !== id) : [...p.productos, id],
    }))
  }

  function selectAll() {
    setNuevoForm((p) => ({ ...p, productos: productos.map((pr) => pr.id) }))
  }

  async function handleCrear() {
    if (!nuevoForm.almacen_id || nuevoForm.productos.length === 0) return
    setCreando(true)
    try {
      const conteo = await crearConteo(activeCompanyId, user?.id, nuevoForm.almacen_id, nuevoForm.productos)
      notify(`Conteo ${conteo.numero} creado`)
      setShowNuevo(false)
      navigate(`/conteos/${conteo.id}`)
    } catch (err) { alertError('Error', err.message) }
    finally { setCreando(false) }
  }

  if (loading) return <Skeleton.Card />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <h1>📋 Conteos de inventario</h1>
          <Button size="sm" onClick={abrirNuevo}>+ Nuevo conteo</Button>
        </div>

        {data.length === 0 ? (
          <p className="meta" style={{ textAlign: 'center', padding: 24 }}>Sin conteos registrados</p>
        ) : (
          <table className="table" style={{ fontSize: '0.82rem' }}>
            <thead>
              <tr>
                <th>N°</th>
                <th>Fecha</th>
                <th>Almacén</th>
                <th>Estado</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => {
                const badge = BADGE_ESTADO[c.estado] || BADGE_ESTADO.abierto
                return (
                  <tr key={c.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 600 }}>{c.numero}</td>
                    <td className="meta">{c.fecha?.slice(0, 10)}</td>
                    <td>{c.almacen?.nombre || '—'}</td>
                    <td><span className="badge" style={{ background: badge.bg, color: badge.color }}>{c.estado}</span></td>
                    <td><Link to={`/conteos/${c.id}`}><Button size="xs" variant="ghost">Ver</Button></Link></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal nuevo conteo */}
      {showNuevo && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowNuevo(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 480, margin: 16, maxHeight: '80vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="page-header" style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: '0.95rem', margin: 0 }}>📋 Nuevo conteo</h3>
              <button onClick={() => setShowNuevo(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <select className="form-input" value={nuevoForm.almacen_id} onChange={(e) => setNuevoForm((p) => ({ ...p, almacen_id: e.target.value }))}>
                <option value="">— Seleccionar almacén —</option>
                {almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Productos a contar</span>
                  <Button size="xs" variant="ghost" onClick={selectAll}>Seleccionar todos</Button>
                </div>
                <div style={{ maxHeight: 300, overflow: 'auto', border: '1px solid var(--color-border)', borderRadius: 6, padding: 4 }}>
                  {productos.map((p) => (
                    <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', cursor: 'pointer', fontSize: '0.82rem' }}>
                      <input type="checkbox" checked={nuevoForm.productos.includes(p.id)} onChange={() => toggleProducto(p.id)} />
                      <span>{p.nombre}</span>
                      <span className="meta" style={{ fontSize: '0.72rem' }}>{p.codigo || ''}</span>
                    </label>
                  ))}
                </div>
                <div className="meta" style={{ fontSize: '0.75rem', marginTop: 4 }}>{nuevoForm.productos.length} producto(s) seleccionados</div>
              </div>

              <Button onClick={handleCrear} disabled={creando || !nuevoForm.almacen_id || nuevoForm.productos.length === 0}>
                {creando ? 'Creando...' : '✅ Iniciar conteo'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
