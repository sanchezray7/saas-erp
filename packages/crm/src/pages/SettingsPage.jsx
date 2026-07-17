import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth, Button, FormField, ConfirmModal, Skeleton, PERMISSIONS, alertError, notify, getSupabase } from '@saas/core'
import { listarIndustries, guardarIndustry, eliminarIndustry } from '../data/industries'
import { listarRouting, guardarRouting, eliminarRouting, listarMiembros, eliminarMiembro } from '../data/roundRobin'
import { crearUsuario } from '../data/users'
import { listarPipelines, guardarPipeline, eliminarPipeline, guardarStage, eliminarStage, reordenarStages } from '../data/pipelines'
import { obtenerWebhookToken, regenerarTokenWebhook, toggleWebhookActivo } from '../data/leads'
import { listarTemplates, guardarTemplate, eliminarTemplate } from '../data/emailTemplates'
import { obtenerPerfilEmpresa, actualizarPerfilEmpresa } from '../data/company'
import { draftEmail } from '../data/ai'
import { resolveTemplate, CONTEXT_VARIABLES, CONTEXT_OPTIONS } from '@saas/core'
import { listarCategorias, guardarCategoria, eliminarCategoria, COLORES_CATEGORIA, ICONOS_CATEGORIA } from '@saas/productos'
import { FacturacionConfigSection } from '@saas/facturacion'
import { CobranzaConfigForm } from '@saas/facturacion'
import { listarMetas, guardarMeta, eliminarMeta, obtenerProgreso } from '../data/metas'
import { TiposCambioSection } from '../components/TiposCambioSection'
import { VacacionReglasSection, FeriadosSection } from '@saas/rrhh'
import PlanSection from '../components/PlanSection'

export function SettingsPage() {
  const { t } = useTranslation()
  const { user, activeCompanyId, can } = useAuth()
  const [industries, setIndustries] = useState([])
  const [routing, setRouting] = useState([])
  const [miembros, setMiembros] = useState([])
  const [pipelines, setPipelines] = useState([])
  const [webhook, setWebhook] = useState(null)
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [openSection, setOpenSection] = useState(null)

  const load = useCallback(async () => {
    try {
      const [inds, routes, members, pipes, wh, tmpls] = await Promise.all([
        listarIndustries(activeCompanyId),
        listarRouting(activeCompanyId),
        listarMiembros(activeCompanyId).catch(() => []),
        listarPipelines(activeCompanyId).catch(() => []),
        obtenerWebhookToken(activeCompanyId).catch(() => null),
        listarTemplates(activeCompanyId).catch(() => []),
      ])
      setIndustries(inds)
      setRouting(routes)
      setMiembros(members)
      setPipelines(pipes)
      setWebhook(wh)
      setTemplates(tmpls)
    } catch (err) {
      alertError('Error', err.message)
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId])

  useEffect(() => { load() }, [load])

  if (loading) return <Skeleton.Card />

  return (
    <div className="card">
      <div className="page-header">
        <h1>{t('settings.titulo')}</h1>
      </div>
      <p className="meta" style={{ marginBottom: '1.25rem' }}>
        {t('settings.configDescripcion')}
      </p>

      <details
        className="config-section"
        open={openSection === 'plan'}
        onToggle={(e) => setOpenSection(e.target.open ? 'plan' : null)}
      >
        <summary className="config-section__summary">
          Plan y facturación
        </summary>
        <div style={{ padding: '0.75rem 0' }}>
          <PlanSection />
        </div>
      </details>

      <details
        className="config-section"
        open={openSection === 'categorias'}
        onToggle={(e) => setOpenSection(e.target.open ? 'categorias' : null)}
      >
        <summary className="config-section__summary">
          📁 Categorías de productos
        </summary>
        <CategoriasSection companyId={activeCompanyId} />
      </details>

      <details
        className="config-section"
        open={openSection === 'industries'}
        onToggle={(e) => setOpenSection(e.target.open ? 'industries' : null)}
      >
        <summary className="config-section__summary">
          {t('settings.industrias')}
          <span className="config-section__count">{industries.length} registro{industries.length !== 1 ? 's' : ''}</span>
        </summary>
        <IndustriesTable
          data={industries}
          onRefresh={load}
          companyId={activeCompanyId}
          canEdit={can(PERMISSIONS.CONFIG_CREAR)}
        />
      </details>

      <details
        className="config-section"
        open={openSection === 'routing'}
        onToggle={(e) => setOpenSection(e.target.open ? 'routing' : null)}
      >
        <summary className="config-section__summary">
          {t('settings.routing')}
          <span className="config-section__count">{routing.length} vendedor{routing.length !== 1 ? 'es' : ''}</span>
        </summary>
        <RoutingTable
          data={routing}
          onRefresh={load}
          companyId={activeCompanyId}
          canEdit={can(PERMISSIONS.CONFIG_CREAR)}
        />
      </details>

      <details
        className="config-section"
        open={openSection === 'miembros'}
        onToggle={(e) => setOpenSection(e.target.open ? 'miembros' : null)}
      >
        <summary className="config-section__summary">
          {t('settings.miembros')}
          <span className="config-section__count">{miembros.length} miembro{miembros.length !== 1 ? 's' : ''}</span>
        </summary>
        <MiembrosTable
          data={miembros}
          onRefresh={load}
          companyId={activeCompanyId}
          canEdit={can(PERMISSIONS.CONFIG_CREAR)}
        />
      </details>

      <details
        className="config-section"
        open={openSection === 'pipelines'}
        onToggle={(e) => setOpenSection(e.target.open ? 'pipelines' : null)}
      >
        <summary className="config-section__summary">
          {t('settings.pipelines')}
          <span className="config-section__count">{pipelines.length} pipeline{pipelines.length !== 1 ? 's' : ''}</span>
        </summary>
        <PipelineTable
          data={pipelines}
          onRefresh={load}
          companyId={activeCompanyId}
          canEdit={can(PERMISSIONS.CONFIG_CREAR)}
        />
      </details>

      {can(PERMISSIONS.CONFIG_VER) && (
        <details
          className="config-section"
          open={openSection === 'webhook'}
          onToggle={(e) => setOpenSection(e.target.open ? 'webhook' : null)}
        >
          <summary className="config-section__summary">
            {t('settings.webhook')}
            <span className="config-section__count">{webhook?.is_active ? t('settings.activo') : t('common.no')}</span>
          </summary>
          <WebhookSection
            config={webhook}
            canEdit={can(PERMISSIONS.CONFIG_CREAR)}
            companyId={activeCompanyId}
            onRefresh={load}
          />
        </details>
      )}

      {can(PERMISSIONS.CONFIG_VER) && (
        <details
          className="config-section"
          open={openSection === 'perfil'}
          onToggle={(e) => setOpenSection(e.target.open ? 'perfil' : null)}
        >
          <summary className="config-section__summary">
            Perfil de empresa
          </summary>
          <PerfilSection
            companyId={activeCompanyId}
            canEdit={can(PERMISSIONS.CONFIG_CREAR)}
          />
        </details>
      )}

      {can(PERMISSIONS.CONFIG_VER) && (
        <details
          className="config-section"
          open={openSection === 'facturacion'}
          onToggle={(e) => setOpenSection(e.target.open ? 'facturacion' : null)}
        >
          <summary className="config-section__summary">
            💵 Facturación electrónica
          </summary>
          <FacturacionConfigSection
            companyId={activeCompanyId}
            canEdit={can(PERMISSIONS.CONFIG_CREAR)}
          />
        </details>
      )}

      {can(PERMISSIONS.CONFIG_VER) && (
        <details
          className="config-section"
          open={openSection === 'cobranza'}
          onToggle={(e) => setOpenSection(e.target.open ? 'cobranza' : null)}
        >
          <summary className="config-section__summary">
            🤖 Cobranza automática
          </summary>
          <CobranzaConfigForm
            companyId={activeCompanyId}
            canEdit={can(PERMISSIONS.CONFIG_CREAR)}
            plantillas={templates.filter((t) => t.context === 'whatsapp')}
          />
        </details>
      )}

      {can(PERMISSIONS.CONFIG_VER) && (
        <details
          className="config-section"
          open={openSection === 'metas'}
          onToggle={(e) => setOpenSection(e.target.open ? 'metas' : null)}
        >
          <summary className="config-section__summary">
            🎯 {t('metas.titulo')}
          </summary>
          <MetasSection
            companyId={activeCompanyId}
            canEdit={can(PERMISSIONS.CONFIG_CREAR)}
          />
        </details>
      )}

      {can(PERMISSIONS.CONFIG_VER) && (
        <details className="config-section" open={openSection === 'impuestos'} onToggle={(e) => setOpenSection(e.target.open ? 'impuestos' : null)}>
          <summary className="config-section__summary">🧾 Impuestos</summary>
          <div className="config-table-wrap">
            <p className="meta" style={{ padding: 16, textAlign: 'center' }}>
              Configurar en <Link to="/impuestos" className="link">🧾 Impuestos</Link>
            </p>
          </div>
        </details>
      )}

      {can(PERMISSIONS.CONFIG_VER) && (
        <details
          className="config-section"
          open={openSection === 'templates'}
          onToggle={(e) => setOpenSection(e.target.open ? 'templates' : null)}
        >
          <summary className="config-section__summary">
            {t('settings.emailTemplates')}
            <span className="config-section__count">{templates.length} plantilla{templates.length !== 1 ? 's' : ''}</span>
          </summary>
          <EmailTemplatesSection
            data={templates}
            onRefresh={load}
            companyId={activeCompanyId}
            canEdit={can(PERMISSIONS.CONFIG_CREAR)}
          />
        </details>
      )}

      {can(PERMISSIONS.CONFIG_VER) && (
        <details className="config-section" open={openSection === 'tipos_cambio'} onToggle={(e) => setOpenSection(e.target.open ? 'tipos_cambio' : null)}>
          <summary className="config-section__summary">💱 Tipos de cambio</summary>
          <TiposCambioSection companyId={activeCompanyId} canEdit={can(PERMISSIONS.CONFIG_CREAR)} />
        </details>
      )}

      {can(PERMISSIONS.CONFIG_VER) && (
        <details className="config-section" open={openSection === 'vacacion_reglas'} onToggle={(e) => setOpenSection(e.target.open ? 'vacacion_reglas' : null)}>
          <summary className="config-section__summary">🏖 Reglas de vacaciones</summary>
          <VacacionReglasSection companyId={activeCompanyId} canEdit={can(PERMISSIONS.CONFIG_CREAR)} />
        </details>
      )}

      {can(PERMISSIONS.CONFIG_VER) && (
        <details className="config-section" open={openSection === 'feriados'} onToggle={(e) => setOpenSection(e.target.open ? 'feriados' : null)}>
          <summary className="config-section__summary">🗓 Feriados</summary>
          <FeriadosSection companyId={activeCompanyId} canEdit={can(PERMISSIONS.CONFIG_CREAR)} />
        </details>
      )}
    </div>
  )
}

function RoutingTable({ data, onRefresh, companyId, canEdit }) {
  const { t } = useTranslation()
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ user_id: '', orden: 0, activo: true })
  const [miembros, setMiembros] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => {
    if (canEdit) {
      listarMiembros(companyId)
        .then(setMiembros)
        .catch((err) => { console.warn('[miembros]', err.message); setMiembros([]) })
    }
  }, [companyId, canEdit])

  function startCreate() {
    const nextOrden = data.length > 0 ? Math.max(...data.map((r) => r.orden)) + 1 : 0
    setEditingId('__new__')
    setForm({ user_id: '', orden: nextOrden, activo: true })
  }

  function startEdit(item) {
    setEditingId(item.id)
    setForm({ user_id: item.user_id, orden: item.orden, activo: item.activo })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm({ user_id: '', orden: 0, activo: true })
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.user_id) return
    setSubmitting(true)
    try {
      const isNew = editingId === '__new__'
      await guardarRouting(companyId, { id: isNew ? null : editingId, ...form })
      notify(isNew ? t('common.guardado') : t('common.actualizado'))
      cancelEdit()
      onRefresh()
    } catch (err) {
      alertError('Error', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id) {
    try {
      await eliminarRouting(id)
      notify(t('common.eliminado'))
      setDeleting(null)
      onRefresh()
    } catch (err) {
      alertError('Error', err.message)
    }
  }

  const miembrosEnRouting = new Set(data.map((r) => r.user_id))
  const miembrosDisponibles = miembros.filter((m) => !miembrosEnRouting.has(m.user_id))

  return (
    <div className="config-table-wrap">
      {canEdit && (
        <div style={{ marginBottom: 10 }}>
          <Button size="sm" onClick={startCreate}>
            {t('settings.agregarVendedor')}
          </Button>
        </div>
      )}

      {editingId === '__new__' && (
        <form className="config-form-inline" onSubmit={handleSave}>
          <FormField label={t('settings.vendedor')} as="select" required value={form.user_id} onChange={(e) => setForm((p) => ({ ...p, user_id: e.target.value }))}>
            <option value="">—</option>
            {miembrosDisponibles.map((m) => (
              <option key={m.user_id} value={m.user_id}>{m.email || m.user_id.slice(0, 8) + '…'}</option>
            ))}
          </FormField>
          <FormField label={t('settings.orden')} type="number" min="0" value={form.orden} onChange={(e) => setForm((p) => ({ ...p, orden: Number(e.target.value) }))} />
          <label className="config-form-check">
            <input type="checkbox" checked={form.activo} onChange={(e) => setForm((p) => ({ ...p, activo: e.target.checked }))} />
            {t('settings.activo')}
          </label>
          <div className="config-form-actions">
            <Button type="submit" size="sm" disabled={submitting}>{submitting ? t('common.guardando') : t('common.guardar')}</Button>
            <Button variant="ghost" size="sm" onClick={cancelEdit}>{t('common.cancelar')}</Button>
          </div>
        </form>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>{t('settings.orden')}</th>
            <th>{t('settings.vendedor')}</th>
            <th>{t('settings.activo')}</th>
            {canEdit && <th></th>}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={canEdit ? 4 : 3} className="meta" style={{ textAlign: 'center', padding: 24 }}>
                {t('common.sinDatos')}
              </td>
            </tr>
          ) : data.map((item) => (
            <tr key={item.id}>
              {editingId === item.id ? (
                <td colSpan={canEdit ? 4 : 3}>
                  <form className="config-form-inline" onSubmit={handleSave}>
                    <FormField label={t('settings.orden')} type="number" min="0" value={form.orden} onChange={(e) => setForm((p) => ({ ...p, orden: Number(e.target.value) }))} />
                    <label className="config-form-check">
                      <input type="checkbox" checked={form.activo} onChange={(e) => setForm((p) => ({ ...p, activo: e.target.checked }))} />
                      {t('settings.activo')}
                    </label>
                    <div className="config-form-actions">
                      <Button type="submit" size="sm" disabled={submitting}>{submitting ? t('common.guardando') : t('common.guardar')}</Button>
                      <Button variant="ghost" size="sm" onClick={cancelEdit}>{t('common.cancelar')}</Button>
                    </div>
                  </form>
                </td>
              ) : (
                <>
                  <td>{item.orden}</td>
                  <td>{item.email || '-'}</td>
                  <td>{item.activo ? <span className="badge">{t('common.si')}</span> : <span className="badge" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>{t('common.no')}</span>}</td>
                  {canEdit && (
                    <td className="table-actions">
                      <Button variant="ghost" size="xs" onClick={() => startEdit(item)}>{t('common.editar')}</Button>
                      <Button variant="danger" size="xs" onClick={() => setDeleting(item.id)}>{t('common.eliminar')}</Button>
                    </td>
                  )}
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {deleting && (
        <ConfirmModal
          title={t('settings.eliminarRouting')}
          onConfirm={() => handleDelete(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}

function MiembrosTable({ data, onRefresh, companyId, canEdit }) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [userPhone, setUserPhone] = useState('')
  const [role, setRole] = useState('vendedor')
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(null)

  async function handleInvite(e) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setSubmitting(true)
    try {
      await crearUsuario(companyId, email.trim(), password, role, fullName.trim(), userPhone.trim())
      notify(t('settings.miembroAgregado'))
      setEmail('')
      setPassword('')
      setFullName('')
      setUserPhone('')
      onRefresh()
    } catch (err) {
      alertError('Error', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRemove(userId) {
    const member = data.find((m) => m.user_id === userId)
    if (member?.role === 'admin') {
      const adminCount = data.filter((m) => m.role === 'admin').length
      if (adminCount <= 1) {
        alertError('Error', 'No se puede eliminar al único administrador de la empresa')
        setDeleting(null)
        return
      }
    }
    try {
      await eliminarMiembro(companyId, userId)
      notify(t('settings.miembroEliminado'))
      setDeleting(null)
      onRefresh()
    } catch (err) {
      alertError('Error', err.message)
    }
  }

  return (
    <div className="config-table-wrap">
      {canEdit && (
        <form className="config-form-inline" onSubmit={handleInvite}>
          <FormField label={t('settings.invitarEmail')} required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@ejemplo.com" />
          <FormField label={t('register.contrasena')} required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
          <FormField label="Nombre completo" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <FormField label="Teléfono" value={userPhone} onChange={(e) => setUserPhone(e.target.value)} placeholder="+595..." />
          <FormField label={t('settings.rol')} as="select" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="vendedor">{t('settings.vendedorRol')}</option>
            <option value="admin">{t('settings.adminRol')}</option>
            <option value="supervisor">{t('settings.supervisorRol')}</option>
            <option value="viewer">{t('settings.viewerRol')}</option>
          </FormField>
          <div className="config-form-actions">
            <Button type="submit" size="sm" disabled={submitting}>{submitting ? t('common.guardando') : t('settings.invitar')}</Button>
          </div>
        </form>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>{t('settings.correo')}</th>
            <th>Teléfono</th>
            <th>{t('settings.rol')}</th>
            {canEdit && <th></th>}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={canEdit ? 5 : 4} className="meta" style={{ textAlign: 'center', padding: 24 }}>
                {t('common.sinDatos')}
              </td>
            </tr>
          ) : data.map((m) => (
            <tr key={m.user_id}>
              <td data-label="Nombre">{m.nombre || '—'}</td>
              <td data-label="Correo">{m.email || m.user_id.slice(0, 8) + '…'}</td>
              <td data-label="Teléfono" className="meta">{m.telefono || '—'}</td>
              <td data-label="Rol">{m.role}</td>
              {canEdit && (
                <td data-label="" className="table-actions">
                  <Button variant="danger" size="xs" onClick={() => setDeleting(m.user_id)}>{t('common.eliminar')}</Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {deleting && (
        <ConfirmModal
          title={t('settings.eliminarMiembro')}
          onConfirm={() => handleRemove(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}

function PipelineTable({ data, onRefresh, companyId, canEdit }) {
  const { t } = useTranslation()
  const [editingPipe, setEditingPipe] = useState(null)
  const [pipeForm, setPipeForm] = useState({ name: '', description: '' })
  const [expandedPipe, setExpandedPipe] = useState(null)
  const [stageEditing, setStageEditing] = useState(null)
  const [stageForm, setStageForm] = useState({ name: '', probability: 0, color: '#6366f1' })
  const [deleting, setDeleting] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  function startCreatePipe() {
    setEditingPipe('__new__')
    setPipeForm({ name: '', description: '' })
  }

  function startEditPipe(pipe) {
    setEditingPipe(pipe.id)
    setPipeForm({ name: pipe.name, description: pipe.description || '' })
  }

  function cancelPipeEdit() {
    setEditingPipe(null)
    setPipeForm({ name: '', description: '' })
  }

  async function handleSavePipe(e) {
    e.preventDefault()
    if (!pipeForm.name.trim()) return
    setSubmitting(true)
    try {
      const isNew = editingPipe === '__new__'
      const payload = { name: pipeForm.name.trim(), description: pipeForm.description.trim() }
      if (!isNew) payload.id = editingPipe
      await guardarPipeline(companyId, payload)
      notify(isNew ? t('common.guardado') : t('common.actualizado'))
      cancelPipeEdit()
      onRefresh()
    } catch (err) {
      alertError('Error', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function startCreateStage(pipeId) {
    setExpandedPipe(pipeId)
    setStageEditing('__new__')
    const stages = data.find((p) => p.id === pipeId)?.stages || []
    const nextPos = stages.reduce((max, s) => Math.max(max, s.position || 0), -1) + 1
    setStageForm({ name: '', probability: 0, color: '#6366f1' })
  }

  function startEditStage(stage) {
    setStageEditing(stage.id)
    setStageForm({ name: stage.name, probability: stage.probability, color: stage.color || '#6366f1' })
  }

  function cancelStageEdit() {
    setStageEditing(null)
    setStageForm({ name: '', probability: 0, color: '#6366f1' })
  }

  async function handleSaveStage(e, pipeId) {
    e.preventDefault()
    if (!stageForm.name.trim()) return
    setSubmitting(true)
    try {
      const isNew = stageEditing === '__new__'
      const payload = {
        pipeline_id: pipeId,
        name: stageForm.name.trim(),
        probability: Number(stageForm.probability),
        color: stageForm.color,
      }
      if (!isNew) {
        payload.id = stageEditing
      } else {
        payload.position = Math.max(
          ...(data.find((p) => p.id === pipeId)?.stages || []).map((s) => s.position ?? 0),
          -1
        ) + 1
      }
      await guardarStage(payload)
      notify(isNew ? t('common.guardado') : t('common.actualizado'))
      cancelStageEdit()
      onRefresh()
    } catch (err) {
      alertError('Error', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleMoveStage(pipeId, stageId, direction) {
    const pipe = data.find((p) => p.id === pipeId)
    if (!pipe?.stages) return
    const stages = [...pipe.stages].sort((a, b) => a.position - b.position)
    const idx = stages.findIndex((s) => s.id === stageId)
    if (idx < 0) return
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= stages.length) return
    stages.splice(idx, 1)
    stages.splice(newIdx, 0, pipe.stages.find((s) => s.id === stageId))
    try {
      await reordenarStages(pipeId, stages.map((s) => s.id))
      onRefresh()
    } catch (err) {
      alertError('Error', err.message)
    }
  }

  async function handleDeleteStage(stageId) {
    try {
      await eliminarStage(stageId)
      notify(t('common.eliminado'))
      setDeleting(null)
      onRefresh()
    } catch (err) {
      alertError('Error', err.message)
    }
  }

  async function handleDeletePipe(pipeId) {
    try {
      await eliminarPipeline(pipeId)
      notify(t('common.eliminado'))
      setDeleting(null)
      onRefresh()
    } catch (err) {
      alertError('Error', err.message)
    }
  }

  function togglePipe(pipeId) {
    setExpandedPipe(expandedPipe === pipeId ? null : pipeId)
  }

  return (
    <div className="config-table-wrap">
      {canEdit && (
        <div style={{ marginBottom: 10 }}>
          <Button size="sm" onClick={startCreatePipe}>
            {t('settings.nuevoPipeline')}
          </Button>
        </div>
      )}

      {editingPipe === '__new__' && (
        <form className="config-form-inline" onSubmit={handleSavePipe}>
          <FormField label={t('settings.pipeNombre')} required value={pipeForm.name} onChange={(e) => setPipeForm((p) => ({ ...p, name: e.target.value }))} autoFocus />
          <FormField label={t('settings.pipeDescripcion')} value={pipeForm.description} onChange={(e) => setPipeForm((p) => ({ ...p, description: e.target.value }))} />
          <div className="config-form-actions">
            <Button type="submit" size="sm" disabled={submitting}>{submitting ? t('common.guardando') : t('common.guardar')}</Button>
            <Button variant="ghost" size="sm" onClick={cancelPipeEdit}>{t('common.cancelar')}</Button>
          </div>
        </form>
      )}

      {data.length === 0 ? (
        <p className="meta" style={{ textAlign: 'center', padding: 24 }}>{t('common.sinDatos')}</p>
      ) : data.map((pipe) => (
        <div key={pipe.id} style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', background: 'var(--surface)', userSelect: 'none' }}
            onClick={() => togglePipe(pipe.id)}
          >
            <span style={{ transition: 'transform .2s', transform: expandedPipe === pipe.id ? 'rotate(90deg)' : '' }}>▶</span>
            <span style={{ flex: 1, fontWeight: 600 }}>{pipe.name}</span>
            {pipe.description && <span className="meta" style={{ fontSize: '0.75rem' }}>{pipe.description}</span>}
            <span className="config-section__count">{pipe.stages?.length || 0} etapa{(pipe.stages?.length || 0) !== 1 ? 's' : ''}</span>
          </div>

          {expandedPipe === pipe.id && (
            <div style={{ padding: '0 12px 12px' }}>
              {editingPipe === pipe.id && (
                <form className="config-form-inline" onSubmit={handleSavePipe} style={{ marginBottom: 8 }}>
                  <FormField label={t('settings.pipeNombre')} required value={pipeForm.name} onChange={(e) => setPipeForm((p) => ({ ...p, name: e.target.value }))} autoFocus />
                  <FormField label={t('settings.pipeDescripcion')} value={pipeForm.description} onChange={(e) => setPipeForm((p) => ({ ...p, description: e.target.value }))} />
                  <div className="config-form-actions">
                    <Button type="submit" size="sm" disabled={submitting}>{submitting ? t('common.guardando') : t('common.guardar')}</Button>
                    <Button variant="ghost" size="sm" onClick={cancelPipeEdit}>{t('common.cancelar')}</Button>
                  </div>
                </form>
              )}

              {canEdit && editingPipe !== pipe.id && (
                <div style={{ marginBottom: 8, display: 'flex', gap: 4 }}>
                  <Button size="xs" variant="ghost" onClick={(e) => { e.stopPropagation(); startEditPipe(pipe) }}>{t('common.editar')}</Button>
                  <Button size="xs" danger onClick={(e) => { e.stopPropagation(); setDeleting(pipe.id) }}>{t('common.eliminar')}</Button>
                  <Button size="xs" variant="ghost" onClick={() => startCreateStage(pipe.id)}>{t('settings.agregarEtapa')}</Button>
                </div>
              )}

              {stageEditing === '__new__' && (
                <form className="config-form-inline" onSubmit={(e) => handleSaveStage(e, pipe.id)} style={{ marginBottom: 8 }}>
                  <FormField label={t('settings.stageNombre')} required value={stageForm.name} onChange={(e) => setStageForm((p) => ({ ...p, name: e.target.value }))} autoFocus />
                  <FormField label={t('settings.stageProb')} type="number" min="0" max="100" value={stageForm.probability} onChange={(e) => setStageForm((p) => ({ ...p, probability: e.target.value }))} />
                  <FormField label={t('settings.stageColor')} type="color" value={stageForm.color} onChange={(e) => setStageForm((p) => ({ ...p, color: e.target.value }))} />
                  <div className="config-form-actions">
                    <Button type="submit" size="sm" disabled={submitting}>{submitting ? t('common.guardando') : t('common.guardar')}</Button>
                    <Button variant="ghost" size="sm" onClick={cancelStageEdit}>{t('common.cancelar')}</Button>
                  </div>
                </form>
              )}

              <table className="table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>{t('settings.orden')}</th>
                    <th>{t('settings.stageNombre')}</th>
                    <th style={{ width: 80 }}>{t('settings.stageProb')}</th>
                    <th style={{ width: 60 }}>{t('settings.stageColor')}</th>
                    {canEdit && <th style={{ width: 100 }}></th>}
                  </tr>
                </thead>
                <tbody>
                  {(pipe.stages || []).sort((a, b) => a.position - b.position).map((stage, idx, arr) => (
                    <tr key={stage.id}>
                      {stageEditing === stage.id ? (
                        <td colSpan={canEdit ? 5 : 4}>
                          <form className="config-form-inline" onSubmit={(e) => handleSaveStage(e, pipe.id)}>
                            <FormField label={t('settings.stageNombre')} required value={stageForm.name} onChange={(e) => setStageForm((p) => ({ ...p, name: e.target.value }))} autoFocus />
                            <FormField label={t('settings.stageProb')} type="number" min="0" max="100" value={stageForm.probability} onChange={(e) => setStageForm((p) => ({ ...p, probability: Number(e.target.value) }))} />
                            <FormField label={t('settings.stageColor')} type="color" value={stageForm.color} onChange={(e) => setStageForm((p) => ({ ...p, color: e.target.value }))} />
                            <div className="config-form-actions">
                              <Button type="submit" size="sm" disabled={submitting}>{submitting ? t('common.guardando') : t('common.guardar')}</Button>
                              <Button variant="ghost" size="sm" onClick={cancelStageEdit}>{t('common.cancelar')}</Button>
                            </div>
                          </form>
                        </td>
                      ) : (
                        <>
                          <td>
                            <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                              <span style={{ fontWeight: 600, minWidth: 20 }}>{stage.position}</span>
                              {canEdit && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                  <button
                                    type="button"
                                    disabled={idx === 0}
                                    onClick={() => handleMoveStage(pipe.id, stage.id, -1)}
                                    style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', fontSize: '0.6rem', lineHeight: 1, padding: 0, opacity: idx === 0 ? 0.3 : 1 }}
                                  >▲</button>
                                  <button
                                    type="button"
                                    disabled={idx === arr.length - 1}
                                    onClick={() => handleMoveStage(pipe.id, stage.id, 1)}
                                    style={{ background: 'none', border: 'none', cursor: idx === arr.length - 1 ? 'default' : 'pointer', fontSize: '0.6rem', lineHeight: 1, padding: 0, opacity: idx === arr.length - 1 ? 0.3 : 1 }}
                                  >▼</button>
                                </div>
                              )}
                            </div>
                          </td>
                          <td>{stage.name}</td>
                          <td>{stage.probability}%</td>
                          <td>
                            <span style={{ display: 'inline-block', width: 20, height: 20, borderRadius: 4, background: stage.color || '#6366f1', verticalAlign: 'middle' }} />
                          </td>
                          {canEdit && (
                            <td className="table-actions">
                              <Button variant="ghost" size="xs" onClick={() => startEditStage(stage)}>{t('common.editar')}</Button>
                              <Button variant="danger" size="xs" onClick={() => setDeleting(stage.id)}>{t('common.eliminar')}</Button>
                            </td>
                          )}
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      {deleting && (
        <ConfirmModal
          title={t('settings.eliminarPipeline')}
          onConfirm={() => {
            const isPipe = data.some((p) => p.id === deleting)
            if (isPipe) handleDeletePipe(deleting)
            else handleDeleteStage(deleting)
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}

function IndustriesTable({ data, onRefresh, companyId, canEdit }) {
  const { t } = useTranslation()
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ name: '' })
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(null)

  function startCreate() {
    setEditingId('__new__')
    setForm({ name: '' })
  }

  function startEdit(item) {
    setEditingId(item.id)
    setForm({ name: item.name })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm({ name: '' })
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSubmitting(true)
    try {
      const isNew = editingId === '__new__'
      await guardarIndustry(companyId, { id: isNew ? null : editingId, name: form.name.trim() })
      notify(isNew ? t('common.guardado') : t('common.actualizado'))
      cancelEdit()
      onRefresh()
    } catch (err) {
      alertError(t('common.guardado'), err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id) {
    try {
      await eliminarIndustry(id)
      notify(t('common.eliminado'))
      setDeleting(null)
      onRefresh()
    } catch (err) {
      alertError('Error', err.message)
    }
  }

  return (
    <div className="config-table-wrap">
      {canEdit && (
        <div style={{ marginBottom: 10 }}>
          <Button size="sm" onClick={startCreate}>
            {t('settings.nuevaIndustria')}
          </Button>
        </div>
      )}

      {editingId === '__new__' && (
        <form className="config-form-inline" onSubmit={handleSave}>
          <FormField label={t('settings.nombreIndustria')} required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} autoFocus />
          <div className="config-form-actions">
            <Button type="submit" size="sm" disabled={submitting}>{submitting ? t('common.guardando') : t('common.guardar')}</Button>
            <Button variant="ghost" size="sm" onClick={cancelEdit}>{t('common.cancelar')}</Button>
          </div>
        </form>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>{t('settings.nombreIndustria')}</th>
            {canEdit && <th style={{ width: 150 }}></th>}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={canEdit ? 2 : 1} className="meta" style={{ textAlign: 'center', padding: 24 }}>
                {t('common.sinDatos')}
              </td>
            </tr>
          ) : data.map((item) => (
            <tr key={item.id}>
              {editingId === item.id ? (
                <td colSpan={canEdit ? 2 : 1}>
                  <form className="config-form-inline" onSubmit={handleSave}>
                    <FormField label={t('settings.nombreIndustria')} required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} autoFocus />
                    <div className="config-form-actions">
                      <Button type="submit" size="sm" disabled={submitting}>{submitting ? t('common.guardando') : t('common.guardar')}</Button>
                      <Button variant="ghost" size="sm" onClick={cancelEdit}>{t('common.cancelar')}</Button>
                    </div>
                  </form>
                </td>
              ) : (
                <>
                  <td>{item.name}</td>
                  {canEdit && (
                    <td className="table-actions">
                      <Button variant="ghost" size="xs" onClick={() => startEdit(item)}>{t('common.editar')}</Button>
                      <Button variant="danger" size="xs" onClick={() => setDeleting(item.id)}>{t('common.eliminar')}</Button>
                    </td>
                  )}
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {deleting && (
        <ConfirmModal
          title={t('settings.eliminarIndustria')}
          onConfirm={() => handleDelete(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}

function WebhookSection({ config, canEdit, companyId, onRefresh }) {
  const { t } = useTranslation()
  const [copiedKey, setCopiedKey] = useState(null)
  const [regenerating, setRegenerating] = useState(false)
  const [confirmRegenerate, setConfirmRegenerate] = useState(false)

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
  const endpointUrl = supabaseUrl
    ? `${supabaseUrl}/functions/v1/form-webhook`
    : ''

  async function handleRegenerate() {
    setRegenerating(true)
    try {
      await regenerarTokenWebhook(companyId)
      notify(t('settings.webhookTokenRegenerado'))
      setConfirmRegenerate(false)
      onRefresh()
    } catch (err) {
      alertError('Error', err.message)
    } finally {
      setRegenerating(false)
    }
  }

  async function handleToggle() {
    try {
      await toggleWebhookActivo(companyId, !config?.is_active)
      notify(t('common.actualizado'))
      onRefresh()
    } catch (err) {
      alertError('Error', err.message)
    }
  }

  function copyToClip(text, key) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    })
  }

  const snippet = config?.token
    ? `<form action="${endpointUrl}" method="POST">
  <input type="hidden" name="token" value="${config.token}" />
  <input name="name" placeholder="Nombre" required />
  <input name="email" placeholder="Email" required />
  <input name="phone" placeholder="Teléfono" />
  <textarea name="message" placeholder="Mensaje"></textarea>
  <button type="submit">Enviar</button>
</form>`
    : ''

  if (!config) {
    return (
      <div className="config-table-wrap">
        <p className="meta">{t('settings.webhookNoConfig')}</p>
        {canEdit && (
          <Button size="sm" onClick={handleRegenerate} disabled={regenerating}>
            {regenerating ? t('common.cargando') : t('settings.webhookGenerar')}
          </Button>
      )}
    </div>
  )
}

function CategoriasSection({ companyId }) {
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

  return (
    <div className="config-table-wrap">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Token */}
        <div>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: '0.875rem' }}>
            {t('settings.webhookToken')}
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={{
              flex: 1, padding: '8px 12px', background: 'var(--bg-soft)', borderRadius: 6,
              fontSize: '0.8125rem', wordBreak: 'break-all', border: '1px solid var(--border)',
            }}>
              {config.token}
            </code>
            <Button size="sm" variant="ghost" onClick={() => copyToClip(config.token, 'token')}>
              {copiedKey === 'token' ? t('common.copiado') : t('settings.copiar')}
            </Button>
          </div>
        </div>

        {/* Endpoint URL */}
        <div>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: '0.875rem' }}>
            {t('settings.webhookEndpoint')}
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={{
              flex: 1, padding: '8px 12px', background: 'var(--bg-soft)', borderRadius: 6,
              fontSize: '0.8125rem', wordBreak: 'break-all', border: '1px solid var(--border)',
            }}>
              {endpointUrl}
            </code>
            <Button size="sm" variant="ghost" onClick={() => copyToClip(endpointUrl, 'endpoint')}>
              {copiedKey === 'endpoint' ? t('common.copiado') : t('settings.copiar')}
            </Button>
          </div>
        </div>

        {/* Toggle activo */}
        <label className="config-form-check">
          <input type="checkbox" checked={config.is_active} onChange={handleToggle} disabled={!canEdit} />
          {t('settings.webhookActivo')}
        </label>

        {/* Regenerar token */}
        {canEdit && (
          <div>
            <Button size="sm" variant="danger" onClick={() => setConfirmRegenerate(true)} disabled={regenerating}>
              {regenerating ? t('common.cargando') : t('settings.webhookRegenerar')}
            </Button>
          </div>
        )}

        {/* Snippet HTML */}
        <div>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: '0.875rem' }}>
            {t('settings.webhookSnippet')}
          </label>
          <p className="meta" style={{ marginBottom: 8 }}>{t('settings.webhookSnippetDesc')}</p>
          <pre style={{
            padding: 12, background: 'var(--bg-soft)', borderRadius: 6,
            fontSize: '0.75rem', overflowX: 'auto', border: '1px solid var(--border)',
            lineHeight: 1.5, whiteSpace: 'pre-wrap',
          }}>
            <code>{snippet}</code>
          </pre>
          <div style={{ marginTop: 8 }}>
            <Button size="sm" variant="ghost" onClick={() => copyToClip(snippet, 'snippet')}>
              {copiedKey === 'snippet' ? t('common.copiado') : t('settings.copiar')}
            </Button>
          </div>
        </div>

        {/* Link público para compartir */}
        <div>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: '0.875rem' }}>
            🔗 Link público
          </label>
          <p className="meta" style={{ marginBottom: 8, fontSize: '0.78rem' }}>
            Compartí este link en redes sociales, WhatsApp o email. El lead completa el formulario sin registrarse.
          </p>
          {config?.token ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <code style={{
                flex: 1, padding: '8px 12px', background: 'var(--bg-soft)', borderRadius: 6,
                fontSize: '0.8rem', wordBreak: 'break-all', border: '1px solid var(--border)',
              }}>
                {`${window.location.origin}/lead/${config.token}`}
              </code>
              <Button size="sm" variant="ghost" onClick={() => copyToClip(`${window.location.origin}/lead/${config.token}`, 'leaflink')}>
                {copiedKey === 'leaflink' ? t('common.copiado') : t('settings.copiar')}
              </Button>
            </div>
          ) : (
            <p className="meta">{t('settings.webhookNoConfig')}</p>
          )}
        </div>

        {/* Integraciones */}
        <div>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: '0.875rem' }}>
            🔌 Integraciones rápidas
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <p className="meta" style={{ marginBottom: 4, fontSize: '0.78rem' }}>Typeform — webhook action</p>
              <pre style={{ padding: '6px 10px', background: 'var(--bg-soft)', borderRadius: 6, fontSize: '0.72rem', overflowX: 'auto', border: '1px solid var(--border)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                <code>{`POST ${endpointUrl}
Content-Type: application/json

{
  "token": "${config?.token || 'TU_TOKEN'}",
  "name": "{{respuesta_nombre}}",
  "email": "{{respuesta_email}}",
  "phone": "{{respuesta_telefono}}",
  "message": "{{respuesta_mensaje}}"
}`}</code>
              </pre>
            </div>
            <div>
              <p className="meta" style={{ marginBottom: 4, fontSize: '0.78rem' }}>Elementor Pro — redirect after submit</p>
              <pre style={{ padding: '6px 10px', background: 'var(--bg-soft)', borderRadius: 6, fontSize: '0.72rem', overflowX: 'auto', border: '1px solid var(--border)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                <code>{`URL de acción (redirect):
${endpointUrl}?token=${config?.token || 'TU_TOKEN'}&name=[field id="name"]&email=[field id="email"]`}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>

      {confirmRegenerate && (
        <ConfirmModal
          title={t('settings.webhookConfirmRegenerar')}
          onConfirm={handleRegenerate}
          onCancel={() => setConfirmRegenerate(null)}
        />
      )}
    </div>
  )
}

function PerfilSection({ companyId, canEdit }) {
  const { t } = useTranslation()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    name: '', rif: '', pais: '', direccion: '', telefono: '', email_empresa: '', payment_terms_days: 30,
  })

  useEffect(() => {
    obtenerPerfilEmpresa(companyId)
      .then((d) => {
        setData(d)
        setForm({
          name: d.name || '',
          rif: d.rif || '',
          pais: d.pais || '',
          direccion: d.direccion || '',
          telefono: d.telefono || '',
          email_empresa: d.email_empresa || '',
          payment_terms_days: d.payment_terms_days || 30,
        })
      })
      .catch((err) => alertError('Error', err.message))
      .finally(() => setLoading(false))
  }, [companyId])

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await actualizarPerfilEmpresa(companyId, form)
      notify(t('common.guardado'))
    } catch (err) {
      alertError('Error', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <p className="meta" style={{ padding: 16 }}>{t('common.cargando')}</p>

  return (
    <div className="config-table-wrap">
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 500 }}>
        <FormField label="Nombre fiscal" value={form.name} onChange={(e) => set('name', e.target.value)} required disabled={!canEdit} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="País" value={form.pais} onChange={(e) => set('pais', e.target.value)} disabled={!canEdit} />
          <FormField label="RUC / RIF / CUIT" value={form.rif} onChange={(e) => set('rif', e.target.value)} disabled={!canEdit} />
        </div>
        <FormField label="Dirección" value={form.direccion} onChange={(e) => set('direccion', e.target.value)} disabled={!canEdit} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Teléfono" value={form.telefono} onChange={(e) => set('telefono', e.target.value)} disabled={!canEdit} />
          <FormField label="Email empresa" type="email" value={form.email_empresa} onChange={(e) => set('email_empresa', e.target.value)} disabled={!canEdit} />
        </div>
        <FormField label="Términos de pago (días)" type="number" min="0" max="365" value={form.payment_terms_days} onChange={(e) => set('payment_terms_days', Number(e.target.value))} disabled={!canEdit} hint="Días de vencimiento por defecto para facturas (ej: 30, 60, 90)" />
        {canEdit && (
          <div style={{ marginTop: 8 }}>
            <Button type="submit" size="sm" disabled={submitting}>{submitting ? t('common.guardando') : t('common.guardar')}</Button>
          </div>
        )}
      </form>

      {canEdit && form.rif && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
          <SucursalForm rif={form.rif} companyId={companyId} />
        </div>
      )}
    </div>
  )
}

function SucursalForm({ rif, companyId }) {
  const { t } = useTranslation()
  const [nombre, setNombre] = useState('')
  const [creando, setCreando] = useState(false)

  async function handleCrear() {
    if (!nombre.trim()) return
    setCreando(true)
    try {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const { data: newId, error } = await supabase.rpc('crear_sucursal', {
        p_user_id: user.id,
        p_company_name: nombre.trim(),
        p_rif: rif,
      })
      if (error) throw error

      notify('Sucursal creada correctamente')
      setNombre('')

      // Recargar empresas para que aparezca en el selector
      setTimeout(() => window.location.reload(), 1500)
    } catch (err) {
      alertError('Error', err.message)
    } finally {
      setCreando(false)
    }
  }

  return (
    <div>
      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: '0 0 8px' }}>🏢 Agregar sucursal</h4>
      <p className="meta" style={{ fontSize: '0.78rem', marginBottom: 8 }}>
        Creá una nueva empresa con el mismo RUC para representar otra sucursal o establecimiento.
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <FormField label="Nombre de la sucursal" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Mi Empresa — Sucursal Centro" />
        <div style={{ paddingBottom: 2 }}>
          <Button size="sm" onClick={handleCrear} disabled={creando || !nombre.trim()}>
            {creando ? 'Creando...' : 'Crear sucursal'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function MetasSection({ companyId, canEdit }) {
  const { t } = useTranslation()
  const [miembros, setMiembros] = useState([])
  const [metas, setMetas] = useState([])
  const [loading, setLoading] = useState(true)
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [editUserId, setEditUserId] = useState(null)
  const [editMonto, setEditMonto] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([
      listarMiembros(companyId).catch(() => []),
      listarMetas(companyId, anio, mes).catch(() => []),
    ]).then(([m, mt]) => {
      setMiembros(m)
      setMetas(mt)
    }).catch((err) => alertError('Error', err.message))
      .finally(() => setLoading(false))
  }, [companyId, anio, mes])

  async function handleSave(userId) {
    if (!editMonto || Number(editMonto) < 0) return
    setSubmitting(true)
    try {
      await guardarMeta(companyId, userId, anio, mes, Number(editMonto))
      notify(t('common.guardado'))
      setEditUserId(null)
      setEditMonto('')
      const mt = await listarMetas(companyId, anio, mes)
      setMetas(mt)
    } catch (err) {
      alertError('Error', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id) {
    try {
      await eliminarMeta(id)
      notify(t('common.eliminado'))
      const mt = await listarMetas(companyId, anio, mes)
      setMetas(mt)
    } catch (err) {
      alertError('Error', err.message)
    }
  }

  if (loading) return <p className="meta" style={{ padding: 16 }}>{t('common.cargando')}</p>

  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const miembrosConMeta = new Set(metas.map((m) => m.user_id))

  return (
    <div className="config-table-wrap">
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
        <FormField label="Año" as="select" value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
          {[2024, 2025, 2026, 2027].map((a) => <option key={a} value={a}>{a}</option>)}
        </FormField>
        <FormField label="Mes" as="select" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
          {meses.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </FormField>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Vendedor</th>
            <th style={{ textAlign: 'right' }}>{t('metas.objetivo')}</th>
            <th style={{ textAlign: 'right' }}>{t('common.acciones')}</th>
          </tr>
        </thead>
        <tbody>
          {miembros.map((m) => {
            const meta = metas.find((mt) => mt.user_id === m.user_id)
            return (
              <tr key={m.user_id}>
                <td>{m.nombre || m.email || m.user_id.slice(0, 8)}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>
                  {editUserId === m.user_id ? (
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <input className="form-input" type="number" min="0" style={{ width: 140, fontSize: '0.82rem', padding: '4px 8px', textAlign: 'right' }} value={editMonto} onChange={(e) => setEditMonto(e.target.value)} autoFocus />
                      <Button size="xs" onClick={() => handleSave(m.user_id)} disabled={submitting}>OK</Button>
                      <Button size="xs" variant="ghost" onClick={() => setEditUserId(null)}>{t('common.cancelar')}</Button>
                    </div>
                  ) : (
                    <span>{(meta?.monto_objetivo || 0).toLocaleString()}</span>
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {canEdit && editUserId !== m.user_id && (
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <Button size="xs" variant="ghost" onClick={() => { setEditUserId(m.user_id); setEditMonto(meta?.monto_objetivo?.toString() || '') }}>
                        {meta ? t('common.editar') : 'Asignar'}
                      </Button>
                      {meta && <Button size="xs" danger onClick={() => handleDelete(meta.id)}>{t('common.eliminar')}</Button>}
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function EmailTemplatesSection({ data, onRefresh, companyId, canEdit }) {
  const { t } = useTranslation()
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ name: '', subject: '', body: '', context: 'contact' })
  const [previewVars, setPreviewVars] = useState({})
  const [showPreview, setShowPreview] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [aiDraftLoading, setAiDraftLoading] = useState(false)
  const [aiInstructions, setAiInstructions] = useState('')

  function startCreate() {
    setEditingId('__new__')
    setForm({ name: '', subject: '', body: '', context: 'contact' })
    setShowPreview(false)
  }

  function startEdit(item) {
    setEditingId(item.id)
    setForm({ name: item.name, subject: item.subject, body: item.body, context: item.context })
    setShowPreview(false)
  }

  function cancelEdit() {
    setEditingId(null)
    setForm({ name: '', subject: '', body: '', context: 'contact' })
    setShowPreview(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.subject.trim() || !form.body.trim()) return
    setSubmitting(true)
    try {
      const isNew = editingId === '__new__'
      await guardarTemplate(companyId, {
        id: isNew ? null : editingId,
        name: form.name.trim(),
        subject: form.subject.trim(),
        body: form.body.trim(),
        context: form.context,
      })
      notify(isNew ? t('common.guardado') : t('common.actualizado'))
      cancelEdit()
      onRefresh()
    } catch (err) {
      alertError('Error', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id) {
    try {
      await eliminarTemplate(id)
      notify(t('common.eliminado'))
      setDeleting(null)
      onRefresh()
    } catch (err) {
      alertError('Error', err.message)
    }
  }

  async function handleAiDraft() {
    setAiDraftLoading(true)
    try {
      const res = await draftEmail({
        context: form.context,
        subject: form.subject,
        body: form.body,
        instructions: aiInstructions || undefined,
      })
      if (!res.subject && !res.body) throw new Error('La IA no generó contenido')
      setForm((p) => ({ ...p, subject: res.subject, body: res.body }))
      notify('Borrador generado correctamente')
    } catch (err) {
      alertError('Error al redactar', err.message)
    } finally {
      setAiDraftLoading(false)
    }
  }

  const variables = CONTEXT_VARIABLES[form.context] || []
  const previewSubject = resolveTemplate(form.subject, previewVars)
  const previewBody = resolveTemplate(form.body, previewVars)

  function fillSampleVars() {
    const sample = {}
    variables.forEach((v) => {
      const keys = v.key.split('.')
      const lastKey = keys.pop()
      let obj = sample
      keys.forEach((k) => { if (!obj[k]) obj[k] = {}; obj = obj[k] })
      obj[lastKey] = `[${v.desc}]`
    })
    setPreviewVars(sample)
    setShowPreview(true)
  }

  return (
    <div className="config-table-wrap">
      {canEdit && (
        <div style={{ marginBottom: 10 }}>
          <Button size="sm" onClick={startCreate}>
            {t('settings.nuevaPlantilla')}
          </Button>
        </div>
      )}

      {editingId === '__new__' && (
        <form className="config-form-inline" onSubmit={handleSave} style={{ flexDirection: 'column', gap: 8, alignItems: 'stretch' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <FormField label={t('settings.plantillaNombre')} required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} autoFocus />
            <FormField label={t('settings.plantillaContexto')} as="select" value={form.context} onChange={(e) => { setForm((p) => ({ ...p, context: e.target.value })); setShowPreview(false) }}>
              {CONTEXT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </FormField>
          </div>
          <FormField label={t('settings.plantillaAsunto')} required value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))} />
          <FormField label={t('settings.plantillaCuerpo')} as="textarea" rows={6} required value={form.body} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))} />

          {variables.length > 0 && (
            <div style={{ fontSize: '0.8125rem' }}>
              <strong style={{ display: 'block', marginBottom: 4 }}>{t('settings.plantillaVariables')}:</strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                {variables.map((v) => (
                  <code key={v.key} style={{ fontSize: '0.75rem', cursor: 'pointer', padding: '1px 4px', borderRadius: 3, background: 'var(--bg-soft)' }}
                    onClick={() => setForm((p) => ({ ...p, body: p.body + ` {{${v.key}}}` }))}
                    title={v.desc}
                  >{`{{${v.key}}}`}</code>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button type="submit" size="sm" disabled={submitting}>{submitting ? t('common.guardando') : t('common.guardar')}</Button>
            <Button variant="ghost" size="sm" onClick={() => { fillSampleVars(); setShowPreview(!showPreview) }}>
              {showPreview ? t('common.cerrar') : t('settings.plantillaVistaPrevia')}
            </Button>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginLeft: 8 }}>
              <input
                type="text"
                className="form-input"
                placeholder="Ej: tono formal, breve..."
                value={aiInstructions}
                onChange={(e) => setAiInstructions(e.target.value)}
                style={{ width: 200, fontSize: '0.8rem' }}
              />
              <Button size="sm" variant="ghost" onClick={handleAiDraft} disabled={aiDraftLoading}>
                {aiDraftLoading ? 'Generando...' : '🤖 Redactar con IA'}
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={cancelEdit}>{t('common.cancelar')}</Button>
          </div>

          {showPreview && (
            <div style={{ padding: 12, background: 'var(--bg-soft)', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.875rem' }}>
              <strong style={{ display: 'block', marginBottom: 4 }}>{t('settings.plantillaAsunto')}:</strong>
              <p style={{ marginBottom: 12, color: 'var(--accent)' }}>{previewSubject}</p>
              <strong style={{ display: 'block', marginBottom: 4 }}>{t('settings.plantillaCuerpo')}:</strong>
              <div style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: previewBody }} />
            </div>
          )}
        </form>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>{t('settings.plantillaNombre')}</th>
            <th>{t('settings.plantillaContexto')}</th>
            <th>{t('settings.plantillaAsunto')}</th>
            {canEdit && <th style={{ width: 150 }}></th>}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={canEdit ? 4 : 3} className="meta" style={{ textAlign: 'center', padding: 24 }}>
                {t('common.sinDatos')}
              </td>
            </tr>
          ) : data.map((item) => (
            <tr key={item.id}>
              {editingId === item.id ? (
                <td colSpan={canEdit ? 4 : 3}>
                  <form className="config-form-inline" onSubmit={handleSave} style={{ flexDirection: 'column', gap: 8, alignItems: 'stretch' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <FormField label={t('settings.plantillaNombre')} required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
                      <FormField label={t('settings.plantillaContexto')} as="select" value={form.context} onChange={(e) => { setForm((p) => ({ ...p, context: e.target.value })); setShowPreview(false) }}>
                        {CONTEXT_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </FormField>
                    </div>
                    <FormField label={t('settings.plantillaAsunto')} required value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))} />
                    <FormField label={t('settings.plantillaCuerpo')} as="textarea" rows={6} required value={form.body} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))} />

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Button type="submit" size="sm" disabled={submitting}>{submitting ? t('common.guardando') : t('common.guardar')}</Button>
                      <Button variant="ghost" size="sm" onClick={() => { fillSampleVars(); setShowPreview(!showPreview) }}>
                        {showPreview ? t('common.cerrar') : t('settings.plantillaVistaPrevia')}
                      </Button>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginLeft: 8 }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Ej: tono formal, breve..."
                          value={aiInstructions}
                          onChange={(e) => setAiInstructions(e.target.value)}
                          style={{ width: 200, fontSize: '0.8rem' }}
                        />
                        <Button size="sm" variant="ghost" onClick={handleAiDraft} disabled={aiDraftLoading}>
                          {aiDraftLoading ? 'Generando...' : '🤖 Redactar con IA'}
                        </Button>
                      </div>
                      <Button variant="ghost" size="sm" onClick={cancelEdit}>{t('common.cancelar')}</Button>
                    </div>

                    {showPreview && (
                      <div style={{ padding: 12, background: 'var(--bg-soft)', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.875rem' }}>
                        <strong style={{ display: 'block', marginBottom: 4 }}>{t('settings.plantillaAsunto')}:</strong>
                        <p style={{ marginBottom: 12, color: 'var(--accent)' }}>{previewSubject}</p>
                        <strong style={{ display: 'block', marginBottom: 4 }}>{t('settings.plantillaCuerpo')}:</strong>
                        <div style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: previewBody }} />
                      </div>
                    )}
                  </form>
                </td>
              ) : (
                <>
                  <td style={{ fontWeight: 600 }}>{item.name}</td>
                  <td>{t(`settings.contexto_${item.context}`)}</td>
                  <td style={{ color: 'var(--text-soft)', fontSize: '0.875rem' }}>{item.subject}</td>
                  {canEdit && (
                    <td className="table-actions">
                      <Button variant="ghost" size="xs" onClick={() => startEdit(item)}>{t('common.editar')}</Button>
                      <Button variant="danger" size="xs" onClick={() => setDeleting(item.id)}>{t('common.eliminar')}</Button>
                    </td>
                  )}
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {deleting && (
        <ConfirmModal
          title={t('settings.eliminarPlantilla')}
          onConfirm={() => handleDelete(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
