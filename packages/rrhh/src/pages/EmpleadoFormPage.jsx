import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useAuth, Button, FormField, Skeleton, alertError, notify, MONEDA_POR_PAIS } from '@saas/core'
import { obtenerEmpleado, guardarEmpleado, obtenerContratoActivo, guardarContrato, obtenerBancarioActivo, guardarBancario, obtenerFiscalActivo, guardarFiscal, listarDepartamentos, listarPuestos, listarDocumentos, guardarDocumento, eliminarDocumento, listarMiembrosEquipo } from '../data/empleados'

export function EmpleadoFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { activeCompanyId, pais } = useAuth()
  const moneda = MONEDA_POR_PAIS[pais] || 'PYG'
  const isEdit = Boolean(id)
  const [loading, setLoading] = useState(isEdit)
  const [tab, setTab] = useState('datos')
  const [deptos, setDeptos] = useState([])
  const [puestos, setPuestos] = useState([])
  const [miembros, setMiembros] = useState([])

  // Datos personales
  const [form, setForm] = useState({ nombre: '', apellido: '', email: '', telefono: '', direccion: '', fecha_nacimiento: '', codigo_biometrico: '', user_id: '' })
  const [savingPersonal, setSavingPersonal] = useState(false)

  // Contrato
  const [contrato, setContrato] = useState({ departamento_id: '', puesto_id: '', tipo: 'indefinido', salario: '', moneda, cargo: '', frecuencia_pago: 'mensual' })
  const [contratoLoaded, setContratoLoaded] = useState(false)
  const [savingContrato, setSavingContrato] = useState(false)

  // Bancario
  const [bancario, setBancario] = useState({ banco: '', tipo_cuenta: 'sueldo', numero_cuenta: '', alias_cbu: '' })
  const [bancarioLoaded, setBancarioLoaded] = useState(false)
  const [savingBancario, setSavingBancario] = useState(false)

  // Fiscal
  const [fiscal, setFiscal] = useState({ numero_ips: '' })
  const [fiscalLoaded, setFiscalLoaded] = useState(false)
  const [savingFiscal, setSavingFiscal] = useState(false)

  // Documentos
  const [documentos, setDocumentos] = useState([])
  const [docForm, setDocForm] = useState({ tipo: 'CI', numero: '', fecha_emision: '', fecha_vencimiento: '' })

  // Cargar empleado al inicio
  useEffect(() => {
    Promise.all([listarDepartamentos(activeCompanyId), listarPuestos(activeCompanyId)])
      .then(([d, p]) => { setDeptos(d); setPuestos(p) }).catch(() => {})
    listarMiembrosEquipo(activeCompanyId).then(setMiembros).catch(() => {})
    if (!isEdit) { setLoading(false); return }
    obtenerEmpleado(id).then((emp) => {
      if (emp) setForm({ nombre: emp.nombre, apellido: emp.apellido, email: emp.email || '', telefono: emp.telefono || '', direccion: emp.direccion || '', fecha_nacimiento: emp.fecha_nacimiento || '', codigo_biometrico: emp.codigo_biometrico || '', user_id: emp.user_id || '' })
    }).catch(() => {}).finally(() => setLoading(false))
    listarDocumentos(id).then(setDocumentos).catch(() => {})
  }, [id, isEdit, activeCompanyId])

  // Cargar datos al cambiar de tab
  useEffect(() => {
    if (!isEdit || !id) return
    if (tab === 'laboral' && !contratoLoaded) {
      obtenerContratoActivo(id).then((c) => {
        if (c) setContrato({ departamento_id: c.departamento_id || '', puesto_id: c.puesto_id || '', tipo: c.tipo, salario: String(c.salario || ''), moneda: c.moneda, cargo: c.cargo || '', frecuencia_pago: c.frecuencia_pago || 'mensual' })
        setContratoLoaded(true)
      }).catch(() => setContratoLoaded(true))
    }
    if (tab === 'bancario' && !bancarioLoaded) {
      obtenerBancarioActivo(id).then((b) => {
        if (b) setBancario({ banco: b.banco || '', tipo_cuenta: b.tipo_cuenta || 'sueldo', numero_cuenta: b.numero_cuenta || '', alias_cbu: b.alias_cbu || '' })
        setBancarioLoaded(true)
      }).catch(() => setBancarioLoaded(true))
    }
    if (tab === 'fiscal' && !fiscalLoaded) {
      obtenerFiscalActivo(id).then((f) => {
        if (f) setFiscal({ numero_ips: f.numero_ips || '' })
        setFiscalLoaded(true)
      }).catch(() => setFiscalLoaded(true))
    }
  }, [tab, isEdit, id, contratoLoaded, bancarioLoaded, fiscalLoaded])

  // Handlers
  async function handleSavePersonal() {
    if (!form.nombre.trim() || !form.apellido.trim()) { alertError('Error', 'Nombre y apellido requeridos'); return }
    setSavingPersonal(true)
    try {
      const empId = await guardarEmpleado(activeCompanyId, { ...form, id })
      if (!isEdit) { navigate(`/empleados/${empId}/editar`); return }
      notify('Datos personales guardados')
    } catch (err) { alertError('Error', err.message) }
    finally { setSavingPersonal(false) }
  }

  async function handleSaveContrato() {
    if (!isEdit) { alertError('Error', 'Guardá primero los datos personales'); return }
    setSavingContrato(true)
    try {
      await guardarContrato(activeCompanyId, { ...contrato, empleado_id: id })
      notify('Contrato guardado (se cerró el anterior si existía)')
    } catch (err) { alertError('Error', err.message) }
    finally { setSavingContrato(false) }
  }

  async function handleSaveBancario() {
    if (!isEdit) { alertError('Error', 'Guardá primero los datos personales'); return }
    setSavingBancario(true)
    try {
      await guardarBancario(activeCompanyId, id, bancario)
      notify('Datos bancarios guardados')
    } catch (err) { alertError('Error', err.message) }
    finally { setSavingBancario(false) }
  }

  async function handleSaveFiscal() {
    if (!isEdit) { alertError('Error', 'Guardá primero los datos personales'); return }
    setSavingFiscal(true)
    try {
      await guardarFiscal(activeCompanyId, id, fiscal)
      notify('Datos fiscales guardados')
    } catch (err) { alertError('Error', err.message) }
    finally { setSavingFiscal(false) }
  }

  if (loading) return <Skeleton.Card />

  const TABS = [
    { key: 'datos', label: '👤 Personales' },
    { key: 'laboral', label: '💼 Laboral' },
    { key: 'bancario', label: '🏦 Bancario' },
    { key: 'fiscal', label: '📄 Fiscal' },
    { key: 'documentos', label: '🪪 Documentos' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <h1>{isEdit ? 'Editar' : 'Nuevo'} empleado</h1>
          <Link to="/empleados"><Button variant="ghost" size="sm">Volver</Button></Link>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '6px 14px', borderRadius: 6, border: tab === t.key ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
              background: tab === t.key ? 'var(--color-accent)' : 'transparent',
              color: tab === t.key ? '#fff' : 'var(--color-text)', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem',
            }}>{t.label}</button>
          ))}
        </div>

        <form onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 600 }}>
          {/* ── Personales ── */}
          {tab === 'datos' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="Nombre" required value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} />
                <FormField label="Apellido" required value={form.apellido} onChange={(e) => setForm((p) => ({ ...p, apellido: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="Email" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
                <FormField label="Teléfono" value={form.telefono} onChange={(e) => setForm((p) => ({ ...p, telefono: e.target.value }))} />
              </div>
              <FormField label="Dirección" value={form.direccion} onChange={(e) => setForm((p) => ({ ...p, direccion: e.target.value }))} />
              <FormField label="Fecha de nacimiento" type="date" value={form.fecha_nacimiento} onChange={(e) => setForm((p) => ({ ...p, fecha_nacimiento: e.target.value }))} />
              <FormField label="Código en reloj biométrico" value={form.codigo_biometrico} onChange={(e) => setForm((p) => ({ ...p, codigo_biometrico: e.target.value }))} placeholder="Ej: EMP001" hint="Código del empleado en el dispositivo biométrico" />
              <FormField label="👤 Usuario del sistema" as="select" value={form.user_id} onChange={(e) => setForm((p) => ({ ...p, user_id: e.target.value }))}>
                <option value="">— Sin vincular —</option>
                {miembros.filter((m) => !m.yaVinculado || m.user_id === form.user_id).map((m) => (
                  <option key={m.user_id} value={m.user_id}>{m.email || m.nombre || m.user_id}</option>
                ))}
              </FormField>
              <div style={{ marginTop: 4 }}>
                <Button type="submit" onClick={handleSavePersonal} disabled={savingPersonal}>
                  {savingPersonal ? 'Guardando...' : isEdit ? '💾 Guardar datos personales' : '💾 Crear empleado'}
                </Button>
              </div>
            </>
          )}

          {/* ── Laboral ── */}
          {tab === 'laboral' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="Departamento" as="select" value={contrato.departamento_id} onChange={(e) => setContrato((p) => ({ ...p, departamento_id: e.target.value }))}>
                  <option value="">—</option>
                  {deptos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                </FormField>
                <FormField label="Puesto" as="select" value={contrato.puesto_id} onChange={(e) => setContrato((p) => ({ ...p, puesto_id: e.target.value }))}>
                  <option value="">—</option>
                  {puestos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </FormField>
              </div>
              <FormField label="Cargo" value={contrato.cargo} onChange={(e) => setContrato((p) => ({ ...p, cargo: e.target.value }))} placeholder="Ej: Vendedor Senior" />
              <FormField label="Tipo de contrato" as="select" value={contrato.tipo} onChange={(e) => setContrato((p) => ({ ...p, tipo: e.target.value }))}>
                <option value="indefinido">Indefinido</option>
                <option value="plazo_fijo">Plazo fijo</option>
                <option value="temporario">Temporario</option>
                <option value="obra">Por obra</option>
              </FormField>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="Salario" type="number" min="0" step="0.01" value={contrato.salario} onChange={(e) => setContrato((p) => ({ ...p, salario: e.target.value }))} />
                <FormField label="Moneda" as="select" value={contrato.moneda} onChange={(e) => setContrato((p) => ({ ...p, moneda: e.target.value }))}>
                  <option value="PYG">PYG</option>
                  <option value="USD">USD</option>
                  <option value="BRL">BRL</option>
                </FormField>
              </div>
              <FormField label="Frecuencia de pago" as="select" value={contrato.frecuencia_pago} onChange={(e) => setContrato((p) => ({ ...p, frecuencia_pago: e.target.value }))}>
                <option value="mensual">Mensual</option>
                <option value="quincenal">Quincenal</option>
                <option value="semanal">Semanal</option>
              </FormField>
              <p className="meta" style={{ fontSize: '0.78rem' }}>💡 Al guardar se cerrará el contrato anterior (vigente hasta ayer) y se creará uno nuevo con los datos actuales.</p>
              <Button type="submit" onClick={handleSaveContrato} disabled={savingContrato}>
                {savingContrato ? 'Guardando...' : '💾 Guardar contrato'}
              </Button>
            </>
          )}

          {/* ── Bancario ── */}
          {tab === 'bancario' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="Banco" value={bancario.banco} onChange={(e) => setBancario((p) => ({ ...p, banco: e.target.value }))} placeholder="Ej: Banco Itaú" />
                <FormField label="Tipo cuenta" as="select" value={bancario.tipo_cuenta} onChange={(e) => setBancario((p) => ({ ...p, tipo_cuenta: e.target.value }))}>
                  <option value="corriente">Corriente</option>
                  <option value="ahorro">Ahorro</option>
                  <option value="sueldo">Sueldo</option>
                </FormField>
              </div>
              <FormField label="N° cuenta / CBU" value={bancario.numero_cuenta} onChange={(e) => setBancario((p) => ({ ...p, numero_cuenta: e.target.value }))} />
              <FormField label="Alias" value={bancario.alias_cbu} onChange={(e) => setBancario((p) => ({ ...p, alias_cbu: e.target.value }))} />
              <p className="meta" style={{ fontSize: '0.78rem' }}>💡 Al guardar se cerrarán los datos bancarios anteriores y se crearán nuevos.</p>
              <Button type="submit" onClick={handleSaveBancario} disabled={savingBancario}>
                {savingBancario ? 'Guardando...' : '💾 Guardar datos bancarios'}
              </Button>
            </>
          )}

          {/* ── Fiscal ── */}
          {tab === 'fiscal' && (
            <>
              <FormField label="N° IPS / INSS" value={fiscal.numero_ips} onChange={(e) => setFiscal((p) => ({ ...p, numero_ips: e.target.value }))} placeholder="Ej: 12345678-0" />
              <p className="meta" style={{ fontSize: '0.78rem' }}>💡 Al guardar se cerrará el registro fiscal anterior y se creará uno nuevo.</p>
              <Button type="submit" onClick={handleSaveFiscal} disabled={savingFiscal}>
                {savingFiscal ? 'Guardando...' : '💾 Guardar datos fiscales'}
              </Button>
            </>
          )}

          {/* ── Documentos ── */}
          {tab === 'documentos' && (
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12 }}>
                <div><div className="meta" style={{ fontSize: '0.7rem', marginBottom: 2 }}>Tipo</div>
                  <select className="form-input" value={docForm.tipo} onChange={(e) => setDocForm((p) => ({ ...p, tipo: e.target.value }))} style={{ width: 110, fontSize: '0.82rem' }}>
                    <option value="CI">Cédula</option><option value="RUC">RUC</option>
                    <option value="Pasaporte">Pasaporte</option><option value="Licencia">Licencia</option><option value="Otro">Otro</option>
                  </select>
                </div>
                <div><div className="meta" style={{ fontSize: '0.7rem', marginBottom: 2 }}>N°</div>
                  <input className="form-input" value={docForm.numero} onChange={(e) => setDocForm((p) => ({ ...p, numero: e.target.value }))} style={{ width: 120, fontSize: '0.82rem' }} />
                </div>
                <div><div className="meta" style={{ fontSize: '0.7rem', marginBottom: 2 }}>Emisión</div>
                  <input className="form-input" type="date" value={docForm.fecha_emision} onChange={(e) => setDocForm((p) => ({ ...p, fecha_emision: e.target.value }))} style={{ width: 120, fontSize: '0.82rem' }} />
                </div>
                <div><div className="meta" style={{ fontSize: '0.7rem', marginBottom: 2 }}>Vencimiento</div>
                  <input className="form-input" type="date" value={docForm.fecha_vencimiento} onChange={(e) => setDocForm((p) => ({ ...p, fecha_vencimiento: e.target.value }))} style={{ width: 120, fontSize: '0.82rem' }} />
                </div>
                <Button size="sm" onClick={async () => {
                  if (!docForm.numero.trim()) { alertError('Error', 'N° requerido'); return }
                  if (!id) { alertError('Error', 'Guardá primero el empleado'); return }
                  await guardarDocumento(activeCompanyId, id, docForm)
                  setDocForm({ tipo: 'CI', numero: '', fecha_emision: '', fecha_vencimiento: '' })
                  setDocumentos(await listarDocumentos(id))
                }}>+ Agregar</Button>
              </div>
              {documentos.length === 0 ? (
                <p className="meta" style={{ padding: 12, textAlign: 'center' }}>Sin documentos</p>
              ) : (
                <div className="table-wrapper">
                  <table className="table" style={{ fontSize: '0.82rem' }}>
                    <thead><tr><th>Tipo</th><th>N°</th><th>Vigencia</th><th>Vto</th><th></th></tr></thead>
                    <tbody>
                      {documentos.map((d) => (
                        <tr key={d.id}>
                          <td style={{ fontWeight: 600 }}>{d.tipo}</td>
                          <td>{d.numero || '—'}</td>
                          <td className="meta">{d.vigencia_desde?.slice(0, 10)}</td>
                          <td className="meta">{d.fecha_vencimiento?.slice(0, 10) || '—'}</td>
                          <td><button onClick={async () => { await eliminarDocumento(d.id); setDocumentos(await listarDocumentos(id)) }} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.82rem' }}>✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
