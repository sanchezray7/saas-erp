import { useEffect, useRef, useState } from 'react'
import { useAuth, Button, Skeleton, alertError, notify } from '@saas/core'
import { listarDepartamentos, guardarDepartamento, eliminarDepartamento, listarPuestos, guardarPuesto, eliminarPuesto, listarEmpleados } from '../data/empleados'
import jsPDF from 'jspdf'

const I = ({ nivel, children }) => (
  <div style={{ paddingLeft: nivel * 28 }}>{children}</div>
)

function TreeRow({ icon, label, badge, onClick, onContextMenu, onHover, actions, nivel }) {
  const [hover, setHover] = useState(false)
  return (
    <I nivel={nivel}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 6, cursor: 'pointer', background: hover ? '#f3f4f6' : 'transparent' }}
        onClick={onClick} onContextMenu={onContextMenu}
        onMouseEnter={() => { setHover(true); onHover?.(true) }}
        onMouseLeave={() => { setHover(false); onHover?.(false) }}>
        <span style={{ fontSize: '0.85rem' }}>{icon}</span>
        <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{label}</span>
        {badge && <span style={{ fontSize: '0.7rem', color: '#7c3aed', background: '#ede9fe', borderRadius: 4, padding: '1px 6px' }}>{badge}</span>}
        {hover && actions && <span style={{ marginLeft: 'auto', display: 'flex', gap: 2, fontSize: '0.75rem' }}>{actions}</span>}
      </div>
    </I>
  )
}

function NodoArbol({ node, puestosGlobal, onEditDepto, onEditPuesto, onDeleteDepto, onDeletePuesto, onContextMenu, onCrearPuesto, expandido, onToggle, expandidoPuesto, onTogglePuesto, nivel = 0 }) {
  const puestosDepto = (node.puestos && node.puestos.length > 0) ? node.puestos : (puestosGlobal || []).filter((p) => p.departamento_id === node.id)
  const tieneHijos = node.children && node.children.length > 0
  const estaExpandido = expandido[node.id] !== false
  const empleadosPorPuesto = node.empleadosPorPuesto || {}

  return (
    <div>
      <TreeRow icon={estaExpandido ? '📂' : '📁'} label={node.nombre}
        badge={node.puesto_responsable?.nombre ? `👑 ${node.puesto_responsable.nombre}` : null}
        onClick={() => onToggle(node.id)}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, node) }}
        actions={<>
          <button onClick={(e) => { e.stopPropagation(); onCrearPuesto(node) }} style={btnSm}>+👔</button>
          <button onClick={(e) => { e.stopPropagation(); onEditDepto(node) }} style={btnSm}>✏️</button>
          <button onClick={(e) => { e.stopPropagation(); onDeleteDepto(node) }} style={{ ...btnSm, color: '#dc2626' }}>🗑</button>
        </>}
        nivel={nivel} />
      {estaExpandido && (
        <>
          {puestosDepto.map((p) => {
            const emps = empleadosPorPuesto[p.id] || empleadosPorPuesto['__sin'] || []
            const pExp = expandidoPuesto[p.id] !== false
            return (
              <div key={p.id}>
                <TreeRow icon={p.id === node.puesto_responsable_id ? '👑' : '👔'} label={`${p.nombre} (${emps.length})`}
                  badge={p.id === node.puesto_responsable_id ? 'Responsable' : null}
                  onClick={() => onTogglePuesto(p.id)}
                  onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onEditPuesto(p) }}
                  actions={<button onClick={(e) => { e.stopPropagation(); onDeletePuesto(p.id) }} style={{ ...btnSm, color: '#dc2626' }}>✕</button>}
                  nivel={nivel + 1} />
                {pExp && emps.map((emp) => (
                  <TreeRow key={emp.id} icon="👤" label={`${emp.apellido}, ${emp.nombre}`}
                    badge={emp.email}
                    nivel={nivel + 2} />
                ))}
              </div>
            )
          })}
          {tieneHijos && node.children.map((child) => (
            <NodoArbol key={child.id} node={child} puestosGlobal={puestosGlobal} onEditDepto={onEditDepto} onEditPuesto={onEditPuesto}
              onDeleteDepto={onDeleteDepto} onDeletePuesto={onDeletePuesto} onContextMenu={onContextMenu}
              onCrearPuesto={onCrearPuesto} expandido={expandido} onToggle={onToggle}
              expandidoPuesto={expandidoPuesto} onTogglePuesto={onTogglePuesto} nivel={nivel + 1} />
          ))}
        </>
      )}
    </div>
  )
}

export function OrganigramaPage() {
  const { activeCompanyId, can } = useAuth()
  const [tree, setTree] = useState([])
  const [puestos, setPuestos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editDepto, setEditDepto] = useState(null)
  const [form, setForm] = useState({ nombre: '', parent_depto_id: '', puesto_responsable_id: '' })
  const [deptos, setDeptos] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [expandido, setExpandido] = useState({})
  const [expandidoPuesto, setExpandidoPuesto] = useState({})
  const puedeEditar = can('config:crear')

  // Context menu
  const [ctxMenu, setCtxMenu] = useState(null)
  const [ctxCrearPuesto, setCtxCrearPuesto] = useState(false)
  const [ctxPuestoNombre, setCtxPuestoNombre] = useState('')
  const [ctxEsResponsable, setCtxEsResponsable] = useState(false)
  const [ctxCreando, setCtxCreando] = useState(false)
  const ctxRef = useRef(null)

  // Edit puesto modal
  const [puestoEdit, setPuestoEdit] = useState(null)
  const [puestoEditNombre, setPuestoEditNombre] = useState('')

  async function load() {
    setLoading(true)
    try {
      const [t, d, p] = await Promise.all([
        import('../data/empleados').then((m) => m.listarDepartamentosTree(activeCompanyId)),
        listarDepartamentos(activeCompanyId).catch(() => []),
        listarPuestos(activeCompanyId).catch(() => []),
      ])
      setTree(t.tree || [])
      setPuestos(p)
      setDeptos(d)
    } catch (err) {
      alertError('Error al cargar organigrama', err.message)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [activeCompanyId])

  useEffect(() => {
    if (!ctxMenu) return
    function handleClick(e) {
      if (ctxRef.current && !ctxRef.current.contains(e.target)) {
        setCtxMenu(null); setCtxCrearPuesto(false); setCtxPuestoNombre('')
      }
    }
    function handleKey(e) {
      if (e.key === 'Escape') { setCtxMenu(null); setCtxCrearPuesto(false); setCtxPuestoNombre('') }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleKey) }
  }, [ctxMenu])

  function toggleNode(id) {
    setExpandido((p) => ({ ...p, [id]: p[id] === false ? true : false }))
  }

  function togglePuesto(id) {
    setExpandidoPuesto((p) => ({ ...p, [id]: p[id] === false ? true : false }))
  }

  function abrirModal(depto = null) {
    setEditDepto(depto)
    setForm({ nombre: depto?.nombre || '', parent_depto_id: depto?.parent_depto_id || '', puesto_responsable_id: depto?.puesto_responsable_id || '' })
    setShowModal(true)
    setCtxMenu(null)
  }

  function abrirContextMenu(e, node) {
    if (!puedeEditar) return
    setCtxMenu({ x: e.clientX, y: e.clientY, node })
    setCtxCrearPuesto(false); setCtxPuestoNombre(''); setCtxEsResponsable(false)
  }

  function iniciarCrearPuesto(node) {
    setCtxMenu({ x: 0, y: 0, node })
    setCtxCrearPuesto(true); setCtxPuestoNombre(''); setCtxEsResponsable(false)
  }

  async function handleGuardar() {
    if (!form.nombre.trim()) { alertError('Error', 'El nombre es requerido'); return }
    setSubmitting(true)
    try {
      await guardarDepartamento(activeCompanyId, {
        id: editDepto?.id || null, nombre: form.nombre.trim(),
        parent_depto_id: form.parent_depto_id || null,
        puesto_responsable_id: form.puesto_responsable_id || null,
      })
      notify(editDepto ? 'Departamento actualizado' : 'Departamento creado')
      setShowModal(false); load()
    } catch (err) { alertError('Error', err.message) }
    finally { setSubmitting(false) }
  }

  async function handleEliminar(depto) {
    if (!window.confirm(`¿Eliminar "${depto.nombre}"? Los sub-departamentos pasarán a nivel raíz.`)) return
    try { await eliminarDepartamento(depto.id); notify('Departamento eliminado'); load() }
    catch (err) { alertError('Error', err.message) }
  }

  async function handleCrearPuestoEnDepto() {
    if (!ctxPuestoNombre.trim()) return
    setCtxCreando(true)
    try {
      const id = await guardarPuesto(activeCompanyId, { nombre: ctxPuestoNombre.trim(), departamento_id: ctxMenu.node.id })
      if (ctxEsResponsable) {
        await guardarDepartamento(activeCompanyId, {
          id: ctxMenu.node.id, nombre: ctxMenu.node.nombre,
          parent_depto_id: ctxMenu.node.parent_depto_id, puesto_responsable_id: id,
        })
      }
      notify(`Puesto "${ctxPuestoNombre.trim()}" creado${ctxEsResponsable ? ' como responsable' : ''}`)
      setCtxMenu(null); setCtxCrearPuesto(false); setCtxPuestoNombre(''); load()
    } catch (err) { alertError('Error', err.message) }
    finally { setCtxCreando(false) }
  }

  async function handleGuardarPuesto() {
    if (!puestoEditNombre.trim()) return
    try {
      await guardarPuesto(activeCompanyId, { id: puestoEdit.id, nombre: puestoEditNombre.trim() })
      notify('Puesto actualizado')
      setPuestoEdit(null); load()
    } catch (err) { alertError('Error', err.message) }
  }

  async function handleEliminarPuesto(id) {
    if (!window.confirm('¿Eliminar este puesto?')) return
    try { await eliminarPuesto(id); load() }
    catch (err) { alertError('Error', err.message) }
  }

  // PDF
  function generarPDF() {
    try {
      const doc = new jsPDF()
      let y = 20

      doc.setFontSize(16)
      doc.text('Organigrama', 14, y)
      y += 10
      doc.setFontSize(9)
      doc.text('Generado: ' + new Date().toLocaleDateString('es-PY'), 14, y)
      y += 12

      function dibujarNodo(node, x, y, nivel) {
        const ancho = 70; const alto = 22
        const cx = x - ancho / 2

        // Card
        doc.setDrawColor(200)
        doc.setFillColor(255, 255, 255)
        doc.roundedRect(cx, y, ancho, alto, 3, 3, 'FD')
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.text(node.nombre, x, y + 8, { align: 'center' })
        if (node.puesto_responsable?.nombre) {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(7)
          doc.text('👑 ' + node.puesto_responsable.nombre, x, y + 16, { align: 'center' })
        }

        // Empleados
        const emps = node.empleados?.length || 0
        doc.setFontSize(6)
        doc.setTextColor(150)
        doc.text(`👥 ${emps} emp.`, x, y + alto - 3, { align: 'center' })
        doc.setTextColor(0)

        y += alto + 8

        // Hijos
        const hijos = node.children || []
        if (hijos.length > 0) {
          const xInicio = x - ((hijos.length - 1) * 80) / 2
          // Línea vertical desde padre
          doc.setDrawColor(180)
          doc.line(x, y - 8, x, y - 4)
          // Línea horizontal entre hijos
          if (hijos.length > 1) {
            doc.line(xInicio + 35, y - 4, xInicio + (hijos.length - 1) * 80 + 35, y - 4)
          }
          hijos.forEach((child, i) => {
            const cxChild = xInicio + i * 80
            // Línea vertical hacia hijo
            doc.line(cxChild + 35, y - 4, cxChild + 35, y)
            dibujarNodo(child, cxChild + 35, y, nivel + 1)
          })
        }
        return y
      }

      tree.forEach((node) => {
        y = dibujarNodo(node, 105, y, 0)
        y += 10
      })

      doc.save('organigrama.pdf')
    } catch (err) {
      alertError('Error al generar PDF', err.message)
    }
  }

  if (loading) return <Skeleton.Card />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <h1>🏢 Organigrama</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="sm" onClick={generarPDF} disabled={tree.length === 0}>📥 PDF</Button>
            {puedeEditar && <Button size="sm" onClick={() => abrirModal(null)}>+ Departamento</Button>}
          </div>
        </div>
        <p className="meta" style={{ fontSize: '0.78rem' }}>
          Los jefes de departamento se definen por puesto. Quien ocupe el puesto responsable podrá aprobar ausencias y vacaciones de los empleados del departamento.
        </p>
      </div>

      {tree.length === 0 ? (
        <div className="card"><p className="meta" style={{ padding: 24, textAlign: 'center' }}>Sin departamentos. {puedeEditar && 'Creá el primer departamento para comenzar.'}</p></div>
      ) : (
        <div className="card">
          {tree.map((node) => (
            <NodoArbol key={node.id} node={node} puestosGlobal={puestos} onEditDepto={abrirModal} onEditPuesto={(p) => { setPuestoEdit(p); setPuestoEditNombre(p.nombre) }}
              onDeleteDepto={handleEliminar} onDeletePuesto={handleEliminarPuesto} onContextMenu={abrirContextMenu}
              onCrearPuesto={iniciarCrearPuesto} expandido={expandido} onToggle={toggleNode}
              expandidoPuesto={expandidoPuesto} onTogglePuesto={togglePuesto} nivel={0} />
          ))}
        </div>
      )}

      {/* Menú contextual */}
      {ctxMenu && (
        <div ref={ctxRef} style={{
          position: 'fixed', zIndex: 1001, left: ctxMenu.x, top: ctxMenu.y,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: 220, padding: 4, fontSize: '0.82rem',
        }}>
          {ctxCrearPuesto ? (
            <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontWeight: 600, color: '#374151' }}>Nuevo puesto en "{ctxMenu.node.nombre}"</div>
              <input className="form-input" value={ctxPuestoNombre} onChange={(e) => setCtxPuestoNombre(e.target.value)}
                placeholder="Ej: Gerente de Ventas" style={{ width: '100%', fontSize: '0.82rem' }}
                autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleCrearPuestoEnDepto(); if (e.key === 'Escape') setCtxCrearPuesto(false) }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={ctxEsResponsable} onChange={(e) => setCtxEsResponsable(e.target.checked)} />
                Es el puesto responsable de "{ctxMenu.node.nombre}"
              </label>
              <div style={{ display: 'flex', gap: 4 }}>
                <Button size="sm" onClick={handleCrearPuestoEnDepto} disabled={ctxCreando || !ctxPuestoNombre.trim()}>{ctxCreando ? '...' : '💾 Crear'}</Button>
                <Button variant="ghost" size="sm" onClick={() => { setCtxCrearPuesto(false); setCtxPuestoNombre('') }}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <>
              <div onClick={() => { setCtxCrearPuesto(true); setCtxPuestoNombre(''); setCtxEsResponsable(false) }} style={menuItemStyle}>👔 Crear puesto</div>
              <div onClick={() => abrirModal(ctxMenu.node)} style={menuItemStyle}>📝 Editar departamento</div>
              <div onClick={() => { setEditDepto(null); setForm({ nombre: '', parent_depto_id: ctxMenu.node.id, puesto_responsable_id: '' }); setShowModal(true); setCtxMenu(null) }} style={menuItemStyle}>➕ Agregar sub-departamento</div>
              <div style={{ borderTop: '1px solid #e5e7eb', margin: '4px 0' }} />
              <div onClick={() => { handleEliminar(ctxMenu.node); setCtxMenu(null) }} style={{ ...menuItemStyle, color: '#dc2626' }}>🗑 Eliminar departamento</div>
            </>
          )}
        </div>
      )}

      {/* Modal editar puesto */}
      {puestoEdit && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={() => setPuestoEdit(null)}>
          <div className="card" style={{ width: '100%', maxWidth: 360, margin: 16 }} onClick={(e) => e.stopPropagation()}>
            <div className="page-header" style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: '0.95rem', margin: 0 }}>✏️ Editar puesto</h3>
              <button onClick={() => setPuestoEdit(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div className="meta">Nombre</div>
                <input className="form-input" value={puestoEditNombre} onChange={(e) => setPuestoEditNombre(e.target.value)}
                  style={{ width: '100%' }} onKeyDown={(e) => { if (e.key === 'Enter') handleGuardarPuesto() }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button size="sm" onClick={handleGuardarPuesto}>💾 Guardar</Button>
                <Button variant="ghost" size="sm" onClick={() => setPuestoEdit(null)}>Cancelar</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal departamento */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowModal(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 400, margin: 16 }} onClick={(e) => e.stopPropagation()}>
            <div className="page-header" style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: '0.95rem', margin: 0 }}>{editDepto ? '✏️ Editar departamento' : '🏢 Nuevo departamento'}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><div className="meta">Nombre</div><input className="form-input" value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} placeholder="Ej: Ventas" style={{ width: '100%' }} /></div>
              <div>
                <div className="meta">Departamento padre</div>
                <select className="form-input" value={form.parent_depto_id} onChange={(e) => setForm((p) => ({ ...p, parent_depto_id: e.target.value }))} style={{ width: '100%' }}>
                  <option value="">— Raíz (sin padre) —</option>
                  {deptos.filter((d) => d.id !== editDepto?.id).map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                </select>
              </div>
              <div>
                <div className="meta">Puesto responsable (jefe)</div>
                <select className="form-input" value={form.puesto_responsable_id} onChange={(e) => setForm((p) => ({ ...p, puesto_responsable_id: e.target.value }))} style={{ width: '100%' }}>
                  <option value="">— Sin responsable —</option>
                  {puestos.filter((p) => !p.departamento_id || p.departamento_id === editDepto?.id).map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}{p.departamento_id && deptos.find((d) => d.id === p.departamento_id) ? ` (${deptos.find((d) => d.id === p.departamento_id).nombre})` : ''}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <Button size="sm" onClick={handleGuardar} disabled={submitting}>{submitting ? '...' : '💾 Guardar'}</Button>
                <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>Cancelar</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const menuItemStyle = { padding: '8px 12px', cursor: 'pointer', borderRadius: 4, color: '#374151' }
const btnSm = { background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', padding: '0 2px' }
