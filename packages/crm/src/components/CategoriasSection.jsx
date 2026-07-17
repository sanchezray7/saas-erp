import { useState, useEffect } from 'react'
import { alertError, Button } from '@saas/core'
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
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, paddingLeft: 4 }}>
        <Button size="sm" variant={tipoFiltro === 'producto' ? 'primary' : 'outline'} onClick={() => setTipoFiltro('producto')}>📦 Productos</Button>
        <Button size="sm" variant={tipoFiltro === 'servicio' ? 'primary' : 'outline'} onClick={() => setTipoFiltro('servicio')}>🔧 Servicios</Button>
        <div style={{ flex: 1 }} />
        <Button size="sm" onClick={() => setEditando({ nombre: '', tipo: tipoFiltro, icono: '📦', color: '#6366f1' })}>+ Nueva categoría</Button>
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
                  <Button size="sm" variant="ghost" onClick={() => setEditando(cat)}>✏️</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditando({ nombre: '', tipo: tipoFiltro, icono: '📦', color: '#6366f1', parent_id: cat.id })}>+ Sub</Button>
                  <Button size="sm" variant="ghost" onClick={() => handleEliminar(cat.id)}>🗑️</Button>
                </td>
              </tr>
              {hijas(cat.id).map((sub) => (
                <tr key={sub.id} style={{ background: 'var(--bg-alt)' }}>
                  <td style={{ fontSize: '1rem', paddingLeft: 32 }}>{sub.icono || '•'}</td>
                  <td style={{ paddingLeft: 32 }}>{sub.nombre}</td>
                  <td><span style={{ display: 'inline-block', width: 20, height: 20, background: sub.color, borderRadius: 4 }} /></td>
                  <td>—</td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    <Button size="sm" variant="ghost" onClick={() => setEditando(sub)}>✏️</Button>
                    <Button size="sm" variant="ghost" onClick={() => handleEliminar(sub.id)}>🗑️</Button>
                  </td>
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>

      {editando && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.4)',
        }} onClick={() => setEditando(null)}>
          <div style={{
            background: 'var(--color-surface)', borderRadius: 12,
            padding: 24, width: '90%', maxWidth: 400,
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            maxHeight: '90vh', overflow: 'auto',
          }} onClick={(e) => e.stopPropagation()}>
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
                <Button variant="ghost" size="sm" onClick={() => setEditando(null)}>Cancelar</Button>
                <Button type="submit" size="sm">{editando.id ? 'Guardar' : 'Crear'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
