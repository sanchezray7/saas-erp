import { useEffect, useState, useCallback } from 'react'
import { useAuth, Button, Skeleton, FormField, ConfirmModal, PERMISSIONS, alertError, notify } from '@saas/core'
import { listarAccounts, guardarAccount, eliminarAccount, buildAccountTree, seedAccounts } from '../data/accounts'

function AccountRow({ account, depth, onEdit, onDelete, canEdit }) {
  const [open, setOpen] = useState(true)
  const hasChildren = account.children && account.children.length > 0
  const indent = depth * 16

  return (
    <>
      <tr style={{ cursor: hasChildren ? 'pointer' : undefined }} onClick={() => hasChildren && setOpen(!open)}>
        <td style={{ paddingLeft: 12 + indent }} data-label="Código">
          {hasChildren ? (open ? '▼ ' : '▶ ') : ''}
          <span className="badge" style={{ fontSize: '0.72rem', fontFamily: 'monospace' }}>{account.code}</span>
        </td>
        <td data-label="Nombre">{account.name}</td>
        <td data-label="Tipo"><span className="badge" style={{
          background: account.type === 'activo' ? '#e0f2fe' : account.type === 'pasivo' ? '#fef3c7' : account.type === 'patrimonio' ? '#dcfce7' : account.type === 'ingreso' ? '#f0fdf4' : '#fce7f3',
          color: account.type === 'activo' ? '#0284c7' : account.type === 'pasivo' ? '#d97706' : account.type === 'patrimonio' ? '#16a34a' : account.type === 'ingreso' ? '#059669' : '#db2777',
        }}>{account.type}</span></td>
        <td data-label="Act.">{account.is_active ? '✅' : '❌'}</td>
        <td data-label="">
          {canEdit && (
            <div style={{ display: 'flex', gap: 4 }}>
              <Button size="xs" variant="ghost" onClick={(e) => { e.stopPropagation(); onEdit(account) }}>Editar</Button>
              <Button size="xs" danger onClick={(e) => { e.stopPropagation(); onDelete(account.id) }}>✕</Button>
            </div>
          )}
        </td>
      </tr>
      {open && hasChildren && account.children.map((child) => (
        <AccountRow key={child.id} account={child} depth={depth + 1} onEdit={onEdit} onDelete={onDelete} canEdit={canEdit} />
      ))}
    </>
  )
}

export function PlanContablePage() {
  const { activeCompanyId, can } = useAuth()
  const canEdit = can(PERMISSIONS.CONFIG_CREAR)
  const [accounts, setAccounts] = useState([])
  const [tree, setTree] = useState([])
  const [loading, setLoading] = useState(true)
  const [seedLoading, setSeedLoading] = useState(false)
  const [editForm, setEditForm] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const load = useCallback(async () => {
    try {
      const data = await listarAccounts(activeCompanyId)
      setAccounts(data)
      setTree(buildAccountTree(data))
    } catch (err) { alertError('Error', err.message) }
    finally { setLoading(false) }
  }, [activeCompanyId])

  useEffect(() => { load() }, [load])

  async function handleSeed() {
    if (!window.confirm('¿Cargar plan de cuentas por defecto? Las cuentas existentes no se modificarán.')) return
    setSeedLoading(true)
    try {
      await seedAccounts(activeCompanyId)
      notify('Plan de cuentas cargado')
      load()
    } catch (err) { alertError('Error', err.message) }
    finally { setSeedLoading(false) }
  }

  async function handleGuardar(e) {
    e.preventDefault()
    if (!editForm.code || !editForm.name) return
    try {
      await guardarAccount(activeCompanyId, editForm)
      notify(editForm.id ? 'Cuenta actualizada' : 'Cuenta creada')
      setEditForm(null)
      load()
    } catch (err) { alertError('Error', err.message) }
  }

  async function handleEliminar(id) {
    try {
      await eliminarAccount(id)
      notify('Cuenta eliminada')
      setDeleting(null)
      load()
    } catch (err) { alertError('Error', err.message) }
  }

  function startNew() {
    setEditForm({ code: '', name: '', type: 'gasto', parent_id: '', is_active: true })
  }

  function startEdit(account) {
    setEditForm({ id: account.id, code: account.code, name: account.name, type: account.type, parent_id: account.parent_id || '', is_active: account.is_active })
  }

  const tf = (n) => n.toLocaleString()

  if (loading) return <Skeleton.Card />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <h1>📒 Plan de Cuentas</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            {canEdit && <Button size="sm" variant="ghost" onClick={handleSeed} disabled={seedLoading}>{seedLoading ? 'Cargando...' : '📥 Cargar plantilla PY'}</Button>}
            {canEdit && <Button size="sm" onClick={startNew}>+ Nueva cuenta</Button>}
          </div>
        </div>

        {accounts.length === 0 ? (
          <p className="meta" style={{ textAlign: 'center', padding: 32 }}>
            Sin cuentas contables. Presioná "Cargar plantilla PY" para crear las cuentas por defecto.
          </p>
        ) : (
          <>
            {/* Desktop: árbol en tabla */}
            <div className="items-table-desktop">
              <table className="table" style={{ fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th style={{ width: 120 }}>Código</th>
                    <th>Nombre</th>
                    <th style={{ width: 100 }}>Tipo</th>
                    <th style={{ width: 50 }}>Act.</th>
                    <th style={{ width: 120 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {tree.map((root) => (
                    <AccountRow key={root.id} account={root} depth={0} onEdit={startEdit} onDelete={(id) => setDeleting(id)} canEdit={canEdit} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: cards agrupadas por tipo */}
            <div className="items-table-mobile">
              {['activo', 'pasivo', 'patrimonio', 'ingreso', 'costo', 'gasto'].map((tipo) => {
                const tipoAccounts = accounts.filter((a) => a.type === tipo)
                if (tipoAccounts.length === 0) return null
                const colors = { activo: { bg: '#e0f2fe', color: '#0284c7' }, pasivo: { bg: '#fef3c7', color: '#d97706' }, patrimonio: { bg: '#dcfce7', color: '#16a34a' }, ingreso: { bg: '#f0fdf4', color: '#059669' }, costo: { bg: '#fce7f3', color: '#db2777' }, gasto: { bg: '#fce7f3', color: '#db2777' } }
                const c = colors[tipo] || { bg: '#f5f5f5', color: '#9ca3af' }
                return (
                  <details key={tipo} open style={{ marginBottom: 8, border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                    <summary style={{ fontWeight: 700, fontSize: '0.85rem', padding: '8px 12px', background: c.bg, color: c.color, cursor: 'pointer' }}>
                      {tipo.charAt(0).toUpperCase() + tipo.slice(1)} ({tipoAccounts.length})
                    </summary>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {tipoAccounts.map((a) => (
                        <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', borderBottom: '1px solid var(--color-border)', fontSize: '0.82rem' }}>
                          <div>
                            <span className="badge" style={{ fontSize: '0.7rem', fontFamily: 'monospace', marginRight: 6 }}>{a.code}</span>
                            <span style={{ fontWeight: 600 }}>{a.name}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
                            {!a.is_active && <span style={{ fontSize: '0.75rem' }}>❌</span>}
                            {canEdit && (
                              <>
                                <Button size="xs" variant="ghost" onClick={() => startEdit(a)} style={{ fontSize: '0.7rem' }}>Editar</Button>
                                <Button size="xs" danger onClick={() => setDeleting(a.id)} style={{ fontSize: '0.7rem' }}>✕</Button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Modal formulario */}
      {editForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={() => setEditForm(null)}>
          <div className="card" style={{ width: '100%', maxWidth: 440, margin: 16 }} onClick={(e) => e.stopPropagation()}>
            <div className="page-header" style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: '0.95rem', margin: 0 }}>{editForm.id ? 'Editar cuenta' : 'Nueva cuenta'}</h3>
              <button onClick={() => setEditForm(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <form onSubmit={handleGuardar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
                <FormField label="Código" required value={editForm.code} onChange={(e) => setEditForm((p) => ({ ...p, code: e.target.value }))} placeholder="1.1.1" />
                <FormField label="Nombre" required value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <FormField label="Tipo" as="select" value={editForm.type} onChange={(e) => setEditForm((p) => ({ ...p, type: e.target.value }))}>
                  <option value="activo">Activo</option>
                  <option value="pasivo">Pasivo</option>
                  <option value="patrimonio">Patrimonio</option>
                  <option value="ingreso">Ingreso</option>
                  <option value="costo">Costo</option>
                  <option value="gasto">Gasto</option>
                </FormField>
                <FormField label="Cuenta padre" as="select" value={editForm.parent_id} onChange={(e) => setEditForm((p) => ({ ...p, parent_id: e.target.value }))}>
                  <option value="">— Ninguna (raíz) —</option>
                  {accounts.filter((a) => a.id !== editForm.id).map((a) => (
                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                  ))}
                </FormField>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
                <input type="checkbox" checked={editForm.is_active} onChange={(e) => setEditForm((p) => ({ ...p, is_active: e.target.checked }))} />
                Cuenta activa
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button type="submit">Guardar</Button>
                <Button variant="ghost" onClick={() => setEditForm(null)}>Cancelar</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleting && (
        <ConfirmModal title="Eliminar cuenta" onConfirm={() => handleEliminar(deleting)} onCancel={() => setDeleting(null)} />
      )}
    </div>
  )
}
