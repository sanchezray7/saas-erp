import { useEffect, useState, useCallback } from 'react'
import { useAuth, Button, Skeleton, FormField, ConfirmModal, PERMISSIONS, alertError, notify } from '@saas/core'
import { listarGruposImpuestos, guardarGrupoImpuesto, eliminarGrupoImpuesto, listarImpuestos, guardarImpuesto, eliminarImpuesto } from '../data/impuestos'
import { listarAccounts, autoAsignarCuentasImpuestos } from '../data/accounts'

export function ImpuestosConfigPage() {
  const { activeCompanyId, can } = useAuth()
  const canEdit = can(PERMISSIONS.CONFIG_CREAR)
  const [grupos, setGrupos] = useState([])
  const [impuestos, setImpuestos] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [editGrupo, setEditGrupo] = useState(null)
  const [editImpuesto, setEditImpuesto] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const load = useCallback(async () => {
    try {
      const [g, t, a] = await Promise.all([listarGruposImpuestos(activeCompanyId), listarImpuestos(activeCompanyId), listarAccounts(activeCompanyId)])
      setGrupos(g); setImpuestos(t); setAccounts(a)
    } catch (err) { alertError('Error', err.message) }
    finally { setLoading(false) }
  }, [activeCompanyId])

  useEffect(() => { load() }, [load])

  async function handleGuardarGrupo(e) {
    e.preventDefault()
    const f = editGrupo
    if (!f.name || !f.type) return
    try { await guardarGrupoImpuesto(activeCompanyId, f); setEditGrupo(null); load(); notify('Grupo guardado') }
    catch (err) { alertError('Error', err.message) }
  }

  async function handleGuardarImpuesto(e) {
    e.preventDefault()
    const f = editImpuesto
    if (!f.name || !f.tax_group_id || !f.percentage) return
    try { await guardarImpuesto(activeCompanyId, f); setEditImpuesto(null); load(); notify('Impuesto guardado') }
    catch (err) { alertError('Error', err.message) }
  }

  async function handleAutoAsignar() {
    try { await autoAsignarCuentasImpuestos(activeCompanyId); notify('Cuentas asignadas'); load() }
    catch (err) { alertError('Error', err.message) }
  }

  async function handleEliminar(id, tipo) {
    try {
      if (tipo === 'grupo') await eliminarGrupoImpuesto(id)
      else await eliminarImpuesto(id)
      notify('Eliminado'); setDeleting(null); load()
    } catch (err) { alertError('Error', err.message) }
  }

  if (loading) return <Skeleton.Card />

  return (
    <div className="card">
      <div className="page-header">
        <h1>🧾 Impuestos</h1>
        <Button size="sm" variant="ghost" onClick={handleAutoAsignar}>🔗 Auto-asignar cuentas</Button>
      </div>

      <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '12px 0 8px' }}>Grupos de impuestos</h3>
      {canEdit && (
        <Button size="sm" onClick={() => setEditGrupo({ name: '', type: 'credito_fiscal' })} style={{ marginBottom: 8 }}>+ Nuevo grupo</Button>
      )}
      {editGrupo && (
        <form onSubmit={handleGuardarGrupo} style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <input className="form-input" placeholder="Nombre" value={editGrupo.name} onChange={(e) => setEditGrupo((p) => ({ ...p, name: e.target.value }))} style={{ width: 200 }} />
          <select className="form-input" value={editGrupo.type} onChange={(e) => setEditGrupo((p) => ({ ...p, type: e.target.value }))} style={{ width: 180 }}>
            <option value="credito_fiscal">Crédito Fiscal</option>
            <option value="debito_fiscal">Débito Fiscal</option>
            <option value="retencion_compra">Retención Compra</option>
            <option value="retencion_venta">Retención Venta</option>
          </select>
          <Button type="submit" size="sm">Guardar</Button>
          <Button variant="ghost" size="sm" onClick={() => setEditGrupo(null)}>Cancelar</Button>
        </form>
      )}
      <table className="table" style={{ fontSize: '0.82rem', marginBottom: 20 }}>
        <thead><tr><th>Nombre</th><th>Tipo</th><th style={{ width: 80 }}></th></tr></thead>
        <tbody>
          {grupos.length === 0 ? <tr><td colSpan={3} className="meta" style={{ textAlign: 'center', padding: 16 }}>Sin grupos</td></tr>
          : grupos.map((g) => (
            <tr key={g.id}>
              <td style={{ fontWeight: 600 }}>{g.name}</td>
              <td><span className="badge">{g.type}</span></td>
              <td>{canEdit && <Button size="xs" danger onClick={() => setDeleting({ id: g.id, tipo: 'grupo' })}>✕</Button>}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '12px 0 8px' }}>Impuestos</h3>
      {canEdit && (
        <Button size="sm" onClick={() => setEditImpuesto({ name: '', tax_group_id: grupos[0]?.id || '', percentage: 10, is_withholding: false, account_id: '' })} style={{ marginBottom: 8 }}>+ Nuevo impuesto</Button>
      )}
      {editImpuesto && (
        <form onSubmit={handleGuardarImpuesto} style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <input className="form-input" placeholder="Nombre" value={editImpuesto.name} onChange={(e) => setEditImpuesto((p) => ({ ...p, name: e.target.value }))} style={{ width: 160 }} />
          <select className="form-input" value={editImpuesto.tax_group_id} onChange={(e) => setEditImpuesto((p) => ({ ...p, tax_group_id: e.target.value }))} style={{ width: 150 }}>
            {grupos.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <input className="form-input" type="number" step="0.01" min="0" max="100" placeholder="%" value={editImpuesto.percentage} onChange={(e) => setEditImpuesto((p) => ({ ...p, percentage: e.target.value }))} style={{ width: 60 }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={editImpuesto.is_withholding} onChange={(e) => setEditImpuesto((p) => ({ ...p, is_withholding: e.target.checked }))} />
            Retención
          </label>
          <select className="form-input" value={editImpuesto.account_id || ''} onChange={(e) => setEditImpuesto((p) => ({ ...p, account_id: e.target.value }))} style={{ width: 160 }}>
            <option value="">Sin cuenta</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
          </select>
          <Button type="submit" size="sm">Guardar</Button>
          <Button variant="ghost" size="sm" onClick={() => setEditImpuesto(null)}>Cancelar</Button>
        </form>
      )}
      <table className="table" style={{ fontSize: '0.82rem' }}>
        <thead><tr><th>Nombre</th><th>Grupo</th><th>%</th><th>Tipo</th><th>Cuenta contable</th><th style={{ width: 80 }}></th></tr></thead>
        <tbody>
          {impuestos.length === 0 ? <tr><td colSpan={6} className="meta" style={{ textAlign: 'center', padding: 16 }}>Sin impuestos</td></tr>
          : impuestos.map((t) => (
            <tr key={t.id}>
              <td style={{ fontWeight: 600 }}>{t.name}</td>
              <td className="meta">{t.tax_group?.name || '—'}</td>
              <td>{Number(t.percentage).toFixed(1)}%</td>
              <td>{t.is_withholding ? <span className="badge" style={{ background: '#fef3c7', color: '#d97706' }}>Retención</span> : <span className="badge" style={{ background: '#dcfce7', color: '#16a34a' }}>Directo</span>}</td>
              <td className="meta">{t.account_id ? accounts.find((a) => a.id === t.account_id)?.code + ' - ' + accounts.find((a) => a.id === t.account_id)?.name : '—'}</td>
              <td>{canEdit && <Button size="xs" danger onClick={() => setDeleting({ id: t.id, tipo: 'impuesto' })}>✕</Button>}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {deleting && (
        <ConfirmModal title="Eliminar" onConfirm={() => handleEliminar(deleting.id, deleting.tipo)} onCancel={() => setDeleting(null)} />
      )}
    </div>
  )
}