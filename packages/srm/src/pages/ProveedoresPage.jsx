import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth, Button, Skeleton, ConfirmModal, alertError, notify } from '@saas/core'
import { listarProveedores, eliminarProveedor } from '../data/proveedores'

export function ProveedoresPage() {
  const { t } = useTranslation()
  const { activeCompanyId } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState(null)

  const load = useCallback(async () => {
    try {
      const d = await listarProveedores(activeCompanyId)
      setData(d)
    } catch (err) { alertError('Error', err.message) }
    finally { setLoading(false) }
  }, [activeCompanyId])

  useEffect(() => { load() }, [load])

  async function handleDelete(id) {
    try {
      await eliminarProveedor(id)
      notify('Proveedor eliminado')
      setData((prev) => prev.filter((p) => p.id !== id))
    } catch (err) { alertError('Error', err.message) }
    setDeleting(null)
  }

  const filtered = data.filter((p) => {
    if (!search) return true
    const q = search.toLowerCase()
    return p.nombre?.toLowerCase().includes(q) || p.ruc?.includes(q)
  })

  if (loading) return <Skeleton.Card />

  return (
    <div className="card">
      <div className="page-header">
        <h1>🏭 Proveedores</h1>
        <Link to="/proveedores/nuevo"><Button size="sm">+ Nuevo proveedor</Button></Link>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input type="search" placeholder="Buscar proveedores..." className="form-input" style={{ width: '100%', maxWidth: 320 }} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>RUC</th>
            <th>Contacto</th>
            <th>Teléfono</th>
            <th>Categoría</th>
            <th>Estado</th>
            <th style={{ width: 120 }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr><td colSpan={7} className="meta" style={{ textAlign: 'center', padding: 32 }}>Sin datos</td></tr>
          ) : filtered.map((p) => (
            <tr key={p.id}>
              <td><Link to={`/proveedores/${p.id}`} className="link">{p.nombre}</Link></td>
              <td className="meta">{p.ruc || '—'}</td>
              <td>{p.contact?.name || p.email || '—'}</td>
              <td>{p.telefono || '—'}</td>
              <td><span className="badge">{p.categoria || '—'}</span></td>
              <td><span className="badge" style={{ background: p.estado === 'activo' ? '#dcfce7' : '#fce4ec', color: p.estado === 'activo' ? '#16a34a' : '#dc2626' }}>{p.estado}</span></td>
              <td>
                <div style={{ display: 'flex', gap: 4 }}>
                  <Link to={`/proveedores/${p.id}`}><Button size="xs" variant="ghost">Ver</Button></Link>
                  <Link to={`/proveedores/${p.id}/editar`}><Button size="xs" variant="ghost">Editar</Button></Link>
                  <Button size="xs" danger onClick={() => setDeleting(p.id)}>Eliminar</Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {deleting && (
        <ConfirmModal title="Eliminar proveedor" onConfirm={() => handleDelete(deleting)} onCancel={() => setDeleting(null)} />
      )}
    </div>
  )
}
