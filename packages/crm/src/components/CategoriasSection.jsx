import { useState, useEffect } from 'react'
import { listarCategorias, guardarCategoria, eliminarCategoria, COLORES_CATEGORIA, ICONOS_CATEGORIA } from '@saas/productos'

export default function CategoriasSection({ companyId }) {
  const [categorias, setCategorias] = useState([])
  const [tipoFiltro, setTipoFiltro] = useState('producto')
  const [editando, setEditando] = useState(null)

  const load = () => listarCategorias(companyId, tipoFiltro).then(setCategorias).catch(() => {})
  useEffect(() => { load() }, [companyId, tipoFiltro])

  async function handleGuardar(e) {
    e.preventDefault()
    if (!editando.nombre.trim()) return
    try {
      await guardarCategoria(companyId, editando)
      setEditando(null); load()
    } catch (err) { alertError('Error', err.message) }
  }

  async function handleEliminar(id) {
    if (!confirm('¿Eliminar categoría?')) return
    try { await eliminarCategoria(id); load() }
    catch (err) { alertError('Error', err.message) }
  }

  const padre = categorias.filter((c) => !c.parent_id)
  const hijas = (pid) => categorias.filter((c) => c.parent_id === pid)

  return (
    <div style={{ padding: '0.75rem 0' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <button className={`btn ${tipoFiltro === 'producto' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTipoFiltro('producto')} size="sm">📦 Productos</button>
        <button className={`btn ${tipoFiltro === 'servicio' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTipoFiltro('servicio')} size="sm">🔧 Servicios</button>
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm" onClick={() => setEditando({ nombre: '', tipo: tipoFiltro, icono: '📦', color: '#6366f1' })}>+ Nueva categoría</button>
      </div>

      <table className="table">
        <thead><tr><th>Icono</th><th>Nombre</th><th>Color</th><th>Subcategorías</th><th></th></tr></thead>
        <tbody>
          {padre.length === 0 ? (
            <tr><td colSpan={5} className="meta" style={{ textAlign: 'center', padding: 16 }}>Sin categorías</td></tr>
          ) : padre.map((cat) => (
            <>
              <tr key={cat.id}>
                <td style={{ fontSize: '1.2rem' }}>{cat.icono || '📦'}</td>
                <td style={{ fontWeight: 600 }}>{cat.nombre}</td>
                <td><span style={{ display: 'inline-block', width: 20, height: 20, background: cat.color, borderRadius: 4 }} /></td>
                <td>{hijas(cat.id).length} subcategorías</td>
                <td style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-sm btn-ghost" onClick={() => setEditando(cat)}>✏️</button>
                  <button className="btn btn-sm btn-ghost" onClick={() => setEditando({ nombre: '', tipo: tipoFiltro, icono: '📦', color: '#6366f1', parent_id: cat.id })}>+ Sub</button>
                  <button className="btn btn-sm btn-ghost" onClick={() => handleEliminar(cat.id)}>🗑️</button>
                </td>
              </tr>
              {hijas(cat.id).map((sub) => (
                <tr key={sub.id} style={{ background: 'var(--bg-alt)' }}>
                  <td style={{ fontSize: '1rem', paddingLeft: 32 }}>{sub.icono || '•'}</td>
                  <td style={{ paddingLeft: 32 }}>{sub.nombre}</td>
                  <td><span style={{ display: 'inline-block', width: 20, height: 20, background: sub.color, borderRadius: 4 }} /></td>
                  <td>—</td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-sm btn-ghost" onClick={() => setEditando(sub)}>✏️</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => handleEliminar(sub.id)}>🗑️</button>
                  </td>
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>

      {editando && (
        <div className="modal-overlay" onClick={() => setEditando(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <h3>{editando.id ? 'Editar categoría' : 'Nueva categoría'}</h3>
            <form onSubmit={handleGuardar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-field">
                <label>Nombre</label>
                <input className="form-input" value={editando.nombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} required autoFocus />
              </div>
              <div className="form-field">
                <label>Ícono</label>
                <select className="form-input" value={editando.icono} onChange={(e) => setEditando({ ...editando, icono: e.target.value })}>
                  {ICONOS_CATEGORIA.map((ico) => <option key={ico} value={ico}>{ico}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>Color</label>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {COLORES_CATEGORIA.map((c) => (
                    <button key={c.value} type="button" onClick={() => setEditando({ ...editando, color: c.value })}
                      style={{ width: 32, height: 32, background: c.value, borderRadius: 6, border: editando.color === c.value ? '3px solid #000' : '1px solid #ddd', cursor: 'pointer' }} />
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditando(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary btn-sm">{editando.id ? 'Guardar' : 'Crear'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
