import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth, Button, Skeleton, notify, alertError, FormField, getSupabase } from '@saas/core'
import { listarRecetas, guardarReceta, eliminarReceta, listarIngredientes, guardarIngredientes } from '../data/recetas'

function RecetaFormModal({ receta, onClose, onSaved }) {
  const { t } = useTranslation()
  const { activeCompanyId } = useAuth()
  const [form, setForm] = useState(receta || { codigo: '', nombre: '', producto_final_id: '', cantidad_producida: 1, unidad_medida: 'UNI', instrucciones: '', activo: true })
  const [ingredientes, setIngredientes] = useState([])
  const [productos, setProductos] = useState([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!activeCompanyId) return
    getSupabase().from('catalogo_productos').select('id, nombre, codigo, tipo').eq('company_id', activeCompanyId).order('nombre').then(({ data }) => setProductos(data || []))
    if (receta?.id) {
      listarIngredientes(receta.id).then(setIngredientes)
    }
  }, [activeCompanyId, receta])

  function addIngrediente(esSub = false) {
    setIngredientes([...ingredientes, { producto_id: '', cantidad: 0, unidad_medida: 'UNI', es_subproducto: esSub, merma_porcentaje: 0 }])
  }

  function updIng(index, field, value) {
    const copy = [...ingredientes]
    copy[index] = { ...copy[index], [field]: value }
    setIngredientes(copy)
  }

  function removeIng(index) {
    setIngredientes(ingredientes.filter((_, i) => i !== index))
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.nombre.trim() || !form.producto_final_id) return
    setSubmitting(true)
    try {
      const id = await guardarReceta(activeCompanyId, form)
      await guardarIngredientes(id, ingredientes)
      notify(receta ? 'Receta actualizada' : 'Receta creada')
      onSaved()
      onClose()
    } catch (err) { alertError('Error', err.message) }
    finally { setSubmitting(false) }
  }

  const prodFiltered = productos.filter((p) => p.tipo !== 'servicio')

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', maxWidth: 700, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: 24 }}>
        <h2 style={{ marginBottom: 16 }}>{receta ? 'Editar receta' : 'Nueva receta'}</h2>
        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Código" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
            <FormField label="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
            <FormField label="Producto final" as="select" value={form.producto_final_id} onChange={(e) => setForm({ ...form, producto_final_id: e.target.value })} required>
              <option value="">Seleccionar...</option>
              {prodFiltered.map((p) => <option key={p.id} value={p.id}>{p.codigo ? `[${p.codigo}] ` : ''}{p.nombre}</option>)}
            </FormField>
            <FormField label="Cantidad producida" type="number" value={form.cantidad_producida} onChange={(e) => setForm({ ...form, cantidad_producida: Number(e.target.value) })} />
            <FormField label="Unidad" as="select" value={form.unidad_medida} onChange={(e) => setForm({ ...form, unidad_medida: e.target.value })}>
              <option value="UNI">UNI</option>
              <option value="KG">KG</option>
              <option value="L">L</option>
              <option value="GR">GR</option>
              <option value="ML">ML</option>
            </FormField>
          </div>

          <FormField label="Instrucciones" as="textarea" rows={3} value={form.instrucciones} onChange={(e) => setForm({ ...form, instrucciones: e.target.value })} style={{ marginTop: 12 }} />

          <div style={{ marginTop: 16, marginBottom: 8 }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 8 }}>Ingredientes (materia prima que se consume)</h3>
            {ingredientes.filter((i) => !i.es_subproducto).map((ing, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                <select value={ing.producto_id} onChange={(e) => updIng(ingredientes.indexOf(ing), 'producto_id', e.target.value)} style={{ flex: 1, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.85rem' }} required>
                  <option value="">Seleccionar...</option>
                  {prodFiltered.map((p) => <option key={p.id} value={p.id}>{p.codigo ? `[${p.codigo}] ` : ''}{p.nombre}</option>)}
                </select>
                <input type="number" step="any" value={ing.cantidad} onChange={(e) => updIng(ingredientes.indexOf(ing), 'cantidad', Number(e.target.value))} placeholder="Cant." style={{ width: 80, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.85rem' }} required />
                <select value={ing.unidad_medida} onChange={(e) => updIng(ingredientes.indexOf(ing), 'unidad_medida', e.target.value)} style={{ width: 70, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.85rem' }}>
                  <option value="UNI">UNI</option><option value="KG">KG</option><option value="L">L</option><option value="GR">GR</option><option value="ML">ML</option>
                </select>
                <input type="number" step="any" value={ing.merma_porcentaje} onChange={(e) => updIng(ingredientes.indexOf(ing), 'merma_porcentaje', Number(e.target.value))} placeholder="Merma %" style={{ width: 70, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.85rem' }} />
                <button type="button" onClick={() => removeIng(ingredientes.indexOf(ing))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.1rem' }}>×</button>
              </div>
            ))}
            <button type="button" onClick={() => addIngrediente(false)} style={{ fontSize: '0.82rem', color: 'var(--accent)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>+ Agregar ingrediente</button>
          </div>

          <div style={{ marginTop: 12, marginBottom: 16 }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 8 }}>Subproductos (lo que se genera además del producto final)</h3>
            {ingredientes.filter((i) => i.es_subproducto).map((ing, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                <select value={ing.producto_id} onChange={(e) => updIng(ingredientes.indexOf(ing), 'producto_id', e.target.value)} style={{ flex: 1, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.85rem' }}>
                  <option value="">Seleccionar...</option>
                  {prodFiltered.map((p) => <option key={p.id} value={p.id}>{p.codigo ? `[${p.codigo}] ` : ''}{p.nombre}</option>)}
                </select>
                <input type="number" step="any" value={ing.cantidad} onChange={(e) => updIng(ingredientes.indexOf(ing), 'cantidad', Number(e.target.value))} placeholder="Cant." style={{ width: 80, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.85rem' }} />
                <select value={ing.unidad_medida} onChange={(e) => updIng(ingredientes.indexOf(ing), 'unidad_medida', e.target.value)} style={{ width: 70, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.85rem' }}>
                  <option value="UNI">UNI</option><option value="KG">KG</option><option value="L">L</option><option value="GR">GR</option>
                </select>
                <button type="button" onClick={() => removeIng(ingredientes.indexOf(ing))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.1rem' }}>×</button>
              </div>
            ))}
            <button type="button" onClick={() => addIngrediente(true)} style={{ fontSize: '0.82rem', color: 'var(--accent)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>+ Agregar subproducto</button>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', cursor: 'pointer' }}>Cancelar</button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Guardando...' : 'Guardar'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function RecetasPage() {
  const { t } = useTranslation()
  const { activeCompanyId } = useAuth()
  const [recetas, setRecetas] = useState([])
  const [loading, setLoading] = useState(true)
  const [editReceta, setEditReceta] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [ingredientesMap, setIngredientesMap] = useState({})

  const load = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const data = await listarRecetas(activeCompanyId)
      setRecetas(data)
    } catch (err) { alertError('Error', err.message) }
    finally { setLoading(false) }
  }, [activeCompanyId])

  useEffect(() => { load() }, [load])

  async function handleEliminar(id) {
    if (!window.confirm('¿Eliminar esta receta?')) return
    try {
      await eliminarReceta(id)
      notify('Receta eliminada')
      load()
    } catch (err) { alertError('Error', err.message) }
  }

  async function toggleExpand(id) {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (!ingredientesMap[id]) {
      const ings = await listarIngredientes(id)
      setIngredientesMap((m) => ({ ...m, [id]: ings }))
    }
  }

  if (loading) return <Skeleton.Card />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <h1>📋 Recetas de producción</h1>
          <Button onClick={() => { setEditReceta(null); setShowForm(true) }}>+ Nueva receta</Button>
        </div>

        {recetas.length === 0 ? (
          <p className="meta" style={{ textAlign: 'center', padding: 32 }}>Sin recetas. Creá la primera.</p>
        ) : (
          <table className="table" style={{ fontSize: '0.82rem' }}>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Producto final</th>
                <th>Cantidad</th>
                <th>Versión</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recetas.map((r) => (
                <>
                  <tr key={r.id} onClick={() => toggleExpand(r.id)} style={{ cursor: 'pointer' }}>
                    <td className="meta">{r.codigo || '—'}</td>
                    <td><strong>{r.nombre}</strong></td>
                    <td>{r.producto_final?.nombre || '—'}</td>
                    <td>{Number(r.cantidad_producida).toLocaleString()} {r.unidad_medida}</td>
                    <td>v{r.version}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={(e) => { e.stopPropagation(); setEditReceta(r); setShowForm(true) }} className="btn-icon">✏️</button>
                        <button onClick={(e) => { e.stopPropagation(); handleEliminar(r.id) }} className="btn-icon" style={{ color: '#ef4444' }}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                  {expanded === r.id && (
                    <tr key={`ing-${r.id}`}>
                      <td colSpan={6} style={{ padding: '8px 24px 16px', background: 'var(--bg-alt)' }}>
                        <div style={{ fontSize: '0.78rem' }}>
                          {ingredientesMap[r.id]?.length === 0 ? <span className="meta">Sin ingredientes</span> : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                  <th style={{ textAlign: 'left', padding: '4px 8px' }}>Producto</th>
                                  <th style={{ textAlign: 'right', padding: '4px 8px' }}>Cantidad</th>
                                  <th style={{ padding: '4px 8px' }}>Unidad</th>
                                  <th style={{ padding: '4px 8px' }}>Tipo</th>
                                  <th style={{ textAlign: 'right', padding: '4px 8px' }}>Merma</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(ingredientesMap[r.id] || []).map((ing) => (
                                  <tr key={ing.id}>
                                    <td style={{ padding: '3px 8px' }}>{ing.producto?.nombre}</td>
                                    <td style={{ textAlign: 'right', padding: '3px 8px' }}>{Number(ing.cantidad).toLocaleString()}</td>
                                    <td style={{ textAlign: 'center', padding: '3px 8px' }}>{ing.unidad_medida}</td>
                                    <td style={{ textAlign: 'center', padding: '3px 8px' }}>{ing.es_subproducto ? '🔄 Subproducto' : '⬇️ Materia prima'}</td>
                                    <td style={{ textAlign: 'right', padding: '3px 8px' }}>{ing.merma_porcentaje > 0 ? `${ing.merma_porcentaje}%` : '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                          {r.instrucciones && <p style={{ marginTop: 8, color: 'var(--text-muted)', fontStyle: 'italic' }}>📝 {r.instrucciones}</p>}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <RecetaFormModal
          receta={editReceta}
          onClose={() => setShowForm(false)}
          onSaved={load}
        />
      )}
    </div>
  )
}
