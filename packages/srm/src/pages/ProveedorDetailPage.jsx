import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth, Button, Skeleton, FormField, formatMoney, MONEDA_POR_PAIS, getSupabase, alertError, notify } from '@saas/core'
import { obtenerProveedor, listarProductosDeProveedor, agregarProductoAProveedor, eliminarProductoDeProveedor } from '../data/proveedores'
import { listarOrdenes } from '../data/ordenesCompra'
import { enviarWhatsApp, WhatsAppTemplateModal, obtenerHistorialWhatsappProveedor } from '@saas/whatsapp'
import { obtenerScorecardDeProveedor, calcularScorecards } from '../data/scorecard'
import { listarDocumentosProveedor, guardarDocumentoProveedor, eliminarDocumentoProveedor } from '../data/documentosProveedor'
import { productosConAlternativas } from '../data/alternativas'

export function ProveedorDetailPage() {
  const { id } = useParams()
  const { pais, activeCompanyId, user, companies } = useAuth()
  const moneda = MONEDA_POR_PAIS[pais] || 'USD'
  const companyName = companies.find((c) => c.id === activeCompanyId)?.name || ''
  const [proveedor, setProveedor] = useState(null)
  const [ordenes, setOrdenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showWhatsApp, setShowWhatsApp] = useState(false)
  const [scorecard, setScorecard] = useState(null)
  const [scorecardLoading, setScorecardLoading] = useState(true)
  const [documentos, setDocumentos] = useState([])
  const [docsLoading, setDocsLoading] = useState(true)
  const [showDocForm, setShowDocForm] = useState(null)
  const [whatsappHistorial, setWhatsappHistorial] = useState([])
  const [historialLoading, setHistorialLoading] = useState(true)
  const [whatsappTemplates, setWhatsappTemplates] = useState([])
  const [alternativas, setAlternativas] = useState([])
  const [altLoading, setAltLoading] = useState(true)
  const [productosProv, setProductosProv] = useState([])
  const [productosProvLoading, setProductosProvLoading] = useState(true)
  const [catalogo, setCatalogo] = useState([])
  const [nuevoProdId, setNuevoProdId] = useState('')
  const [nuevoPrecio, setNuevoPrecio] = useState('')
  const [nuevoMoneda, setNuevoMoneda] = useState(moneda)
  const [agregando, setAgregando] = useState(false)

  useEffect(() => {
    if (!activeCompanyId) return
    Promise.all([obtenerProveedor(id), listarOrdenes(activeCompanyId)])
      .then(([p, o]) => {
        setProveedor(p)
        setOrdenes(o.filter((ord) => ord.proveedor_id === id))
      })
      .catch((err) => { alertError('Error', err.message) })
      .finally(() => setLoading(false))
  }, [id, activeCompanyId])

  useEffect(() => {
    if (!activeCompanyId || !id) return
    obtenerScorecardDeProveedor(id, activeCompanyId)
      .then((s) => setScorecard(s))
      .catch(() => {})
      .finally(() => setScorecardLoading(false))
  }, [id, activeCompanyId])

  useEffect(() => {
    if (!id) return
    listarDocumentosProveedor(id)
      .then(setDocumentos)
      .catch(() => {})
      .finally(() => setDocsLoading(false))
  }, [id])

  function loadDocs() {
    listarDocumentosProveedor(id).then(setDocumentos).catch(() => {})
  }

  async function handleGuardarDoc(doc) {
    try {
      const docId = await guardarDocumentoProveedor(activeCompanyId, { ...doc, proveedor_id: id })
      notify(doc.id ? 'Documento actualizado' : 'Documento registrado')
      setShowDocForm(null)
      loadDocs()
    } catch (err) { alertError('Error', err.message) }
  }

  async function handleEliminarDoc(docId) {
    if (!window.confirm('¿Eliminar este documento?')) return
    try {
      await eliminarDocumentoProveedor(docId)
      notify('Documento eliminado')
      loadDocs()
    } catch (err) { alertError('Error', err.message) }
  }

  useEffect(() => {
    if (!id) return
    loadProductos()
    getSupabase().from('catalogo_productos').select('id, nombre, codigo, unidad_medida')
      .eq('company_id', activeCompanyId).eq('tipo', 'producto').order('nombre')
      .then(({ data }) => setCatalogo(data || []))
      .catch(() => {})
    obtenerHistorialWhatsappProveedor(id)
      .then(setWhatsappHistorial)
      .catch(() => {})
      .finally(() => setHistorialLoading(false))
  }, [id, activeCompanyId])

  function loadProductos() {
    setProductosProvLoading(true)
    listarProductosDeProveedor(id).then(setProductosProv).catch(() => {}).finally(() => setProductosProvLoading(false))
  }

  useEffect(() => {
    if (!id || !activeCompanyId) return
    productosConAlternativas(id, activeCompanyId)
      .then(setAlternativas)
      .catch(() => {})
      .finally(() => setAltLoading(false))
  }, [id, activeCompanyId])

  async function handleRecalcularScorecard() {
    try {
      await calcularScorecards(activeCompanyId)
      const s = await obtenerScorecardDeProveedor(id, activeCompanyId)
      setScorecard(s)
    } catch (err) { alertError('Error', err.message) }
  }

  if (loading) return <Skeleton.Card />
  if (!proveedor) return <div className="card"><p className="meta">Proveedor no encontrado</p></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <h1>{proveedor.nombre}</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            {proveedor.telefono && (
              <Button size="sm" variant="ghost" onClick={() => {
                setShowWhatsApp(true)
                getSupabase().from('email_templates').select('*').eq('company_id', activeCompanyId).order('name').then(({ data }) => {
                  const whatsapp = (data || []).filter((t) => t.context === 'whatsapp')
                  if (whatsapp.length > 0) { setWhatsappTemplates(whatsapp); return }
                  const anyContext = (data || []).filter((t) => t.context && t.context !== '')
                  setWhatsappTemplates(anyContext.length > 0 ? anyContext : data || [])
                }).catch((err) => alertError('Error al cargar plantillas', err.message))
              }}>📱 WhatsApp</Button>
            )}
            <Link to={`/proveedores/${id}/editar`}><Button size="sm">Editar</Button></Link>
            <Link to="/proveedores"><Button variant="ghost" size="sm">Volver</Button></Link>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
          <DetailField label="RUC" value={proveedor.ruc} />
          <DetailField label="Email" value={proveedor.email} />
          <DetailField label="Teléfono" value={proveedor.telefono} />
          <DetailField label="Categoría" value={proveedor.categoria} />
          <DetailField label="Dirección" value={proveedor.direccion} />
          <DetailField label="Sitio web" value={proveedor.sitio_web} />
          <DetailField label="Estado" value={proveedor.estado} />
          <DetailField label="Contacto vinculado" value={proveedor.contact?.name || '—'} />
          <DetailField label="Días de crédito" value={proveedor.payment_terms_days ? `${proveedor.payment_terms_days} días` : '—'} />
        </div>
      </div>

      {ordenes.length > 0 && (
        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12 }}>📋 Órdenes de compra</h2>
          <table className="table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ordenes.map((o) => (
                <tr key={o.id}>
                  <td style={{ fontWeight: 600 }}>{o.numero}</td>
                  <td>{formatMoney(o.total, o.moneda)}</td>
                  <td><span className="badge">{o.estado}</span></td>
                  <td className="meta">{o.created_at?.slice(0, 10)}</td>
                  <td><Link to={`/ordenes-compra/${o.id}`}><Button size="xs" variant="ghost">Ver</Button></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Scorecard */}
      <div className="card">
        <div className="page-header" style={{ marginBottom: 12 }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>📊 Scorecard</h3>
          <Button size="xs" variant="ghost" onClick={handleRecalcularScorecard}>🔄 Recalcular</Button>
        </div>
        {scorecardLoading ? <div className="skeleton" style={{ width: '100%', height: 120 }} /> : !scorecard ? (
          <p className="meta" style={{ textAlign: 'center', padding: 16 }}>
            Sin scorecard. Presioná "Recalcular" para generar.
          </p>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: '1.5rem' }}>
                {'★'.repeat(Math.round(scorecard.puntaje_general))}{'☆'.repeat(5 - Math.round(scorecard.puntaje_general))}
              </span>
              <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{Number(scorecard.puntaje_general).toFixed(1)}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, fontSize: '0.82rem' }}>
              {[
                { label: '⏱ Entrega', value: scorecard.entrega_tiempo },
                { label: '📦 Cantidad', value: scorecard.precision_cantidad },
                { label: '💰 Precio', value: scorecard.precision_precio },
                { label: '👍 Calidad', value: scorecard.calidad },
                { label: '💬 Comunicación', value: scorecard.comunicacion },
              ].map((d) => {
                const pct = (d.value / 5) * 100
                const color = pct >= 80 ? '#16a34a' : pct >= 60 ? '#d97706' : '#dc2626'
                return (
                  <div key={d.label} style={{ textAlign: 'center', padding: '8px 4px', background: 'var(--bg-soft)', borderRadius: 6 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.75rem', marginBottom: 4 }}>{d.label}</div>
                    <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{Number(d.value).toFixed(1)}</div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Documentos */}
      <div className="card">
        <div className="page-header" style={{ marginBottom: 12 }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>📄 Documentos</h3>
          <Button size="xs" onClick={() => setShowDocForm({})}>+ Agregar</Button>
        </div>
        {docsLoading ? <div className="skeleton" style={{ width: '100%', height: 80 }} /> : documentos.length === 0 ? (
          <p className="meta" style={{ textAlign: 'center', padding: 16 }}>Sin documentos registrados</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {documentos.map((doc) => {
              const dias = doc.dias_restantes
              const badge = dias == null ? { bg: '#dcfce7', color: '#16a34a', label: 'Vigente' }
                : dias < 0 ? { bg: '#fef2f2', color: '#dc2626', label: 'Vencido' }
                : dias <= doc.alerta_dias_antes ? { bg: '#fffbeb', color: '#d97706', label: `${dias}d` }
                : { bg: '#dcfce7', color: '#16a34a', label: `${dias}d` }
              return (
                <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg-soft)', borderRadius: 6, fontSize: '0.82rem' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600 }}>{doc.nombre}</span>
                    <span className="meta" style={{ marginLeft: 8 }}>{doc.tipo_documento}</span>
                  </div>
                  <div className="meta">{doc.fecha_vencimiento?.slice(0, 10) || '—'}</div>
                  <span className="badge" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
                  <Button size="xs" variant="ghost" onClick={() => setShowDocForm(doc)}>Editar</Button>
                  <Button size="xs" danger onClick={() => handleEliminarDoc(doc.id)}>✕</Button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Productos que provee */}
      <div className="card">
        <div className="page-header" style={{ marginBottom: 12 }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>📦 Productos que provee</h3>
        </div>

        {/* Formulario para agregar producto */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <select value={nuevoProdId} onChange={(e) => setNuevoProdId(e.target.value)}
            style={{ flex: 1, minWidth: 180, padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: '0.85rem', background: 'var(--color-surface)' }}>
            <option value="">— Seleccionar producto —</option>
            {catalogo.filter((p) => !productosProv.find((pp) => pp.producto_id === p.id)).map((p) => (
              <option key={p.id} value={p.id}>{p.codigo ? `[${p.codigo}] ` : ''}{p.nombre} ({p.unidad_medida})</option>
            ))}
          </select>
          <input type="number" value={nuevoPrecio} onChange={(e) => setNuevoPrecio(e.target.value)} placeholder="Precio"
            style={{ width: 100, padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: '0.85rem' }} />
          <select value={nuevoMoneda} onChange={(e) => setNuevoMoneda(e.target.value)}
            style={{ width: 80, padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: '0.85rem' }}>
            <option value="PYG">PYG</option>
            <option value="USD">USD</option>
          </select>
          <Button size="sm" disabled={!nuevoProdId || agregando} onClick={async () => {
            setAgregando(true)
            try {
              await agregarProductoAProveedor(id, nuevoProdId, Number(nuevoPrecio) || 0, nuevoMoneda)
              notify('Producto agregado')
              setNuevoProdId(''); setNuevoPrecio('')
              loadProductos()
            } catch (err) { alertError('Error', err.message) }
            finally { setAgregando(false) }
          }}>+ Agregar</Button>
        </div>

        {/* Lista de productos del proveedor */}
        {productosProvLoading ? <div className="skeleton" style={{ width: '100%', height: 60 }} /> : productosProv.length === 0 ? (
          <p className="meta" style={{ textAlign: 'center', padding: 16 }}>Sin productos registrados</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {productosProv.map((pp) => (
              <div key={`${pp.proveedor_id}-${pp.producto_id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--color-surface-alt)', borderRadius: 6, fontSize: '0.85rem' }}>
                <span style={{ flex: 1, fontWeight: 600 }}>{pp.producto?.nombre || '?'}</span>
                {pp.producto?.codigo && <span className="meta">[{pp.producto.codigo}]</span>}
                <span style={{ fontWeight: 700 }}>{formatMoney(pp.precio_proveedor, pp.moneda)}</span>
                <button onClick={async () => {
                  if (!window.confirm('¿Quitar este producto?')) return
                  try { await eliminarProductoDeProveedor(id, pp.producto_id); notify('Producto quitado'); loadProductos() }
                  catch (err) { alertError('Error', err.message) }
                }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Alternativas (otros proveedores) */}
      {alternativas.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 12 }}>🔁 Alternativas más baratas</h3>
          {alternativas.map((prod) => prod.alternativas?.length > 0 && (
            <div key={prod.producto_id} style={{ padding: '6px 0', fontSize: '0.82rem' }}>
              <span style={{ fontWeight: 600 }}>{prod.producto_nombre}</span>
              <div style={{ paddingLeft: 12, borderLeft: '2px solid var(--color-border)', marginTop: 4 }}>
                {prod.alternativas.map((alt) => (
                  <div key={alt.proveedor_id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.78rem', marginBottom: 2 }}>
                    <Link to={`/proveedores/${alt.proveedor_id}`} className="link">{alt.proveedor_nombre}</Link>
                    <span style={{ fontWeight: 600 }}>{formatMoney(alt.precio, alt.moneda)}</span>
                    {alt.precio < prod.precio_actual && <span className="badge" style={{ background: '#dcfce7', color: '#16a34a', fontSize: '0.7rem' }}>Más barato</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* WhatsApp historial */}
      <div className="card">
        <div className="page-header" style={{ marginBottom: 12 }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>💬 WhatsApp</h3>
          <Button size="xs" onClick={() => {
            setShowWhatsApp(true)
            getSupabase().from('email_templates').select('*').eq('company_id', activeCompanyId).order('name').then(({ data }) => {
              const whatsapp = (data || []).filter((t) => t.context === 'whatsapp')
              if (whatsapp.length > 0) { setWhatsappTemplates(whatsapp); return }
              const anyContext = (data || []).filter((t) => t.context && t.context !== '')
              setWhatsappTemplates(anyContext.length > 0 ? anyContext : data || [])
            }).catch((err) => alertError('Error al cargar plantillas', err.message))
          }}>📤 Enviar</Button>
        </div>
        {historialLoading ? <div className="skeleton" style={{ width: '100%', height: 80 }} /> : whatsappHistorial.length === 0 ? (
          <p className="meta" style={{ textAlign: 'center', padding: 16 }}>Sin conversaciones registradas</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {whatsappHistorial.map((msg) => {
              const esEnviado = msg.estado === 'enviado'
              const fecha = new Date(msg.created_at)
              const fechaStr = fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
              return (
                <div key={msg.id} style={{
                  display: 'flex', gap: 8, padding: '8px 12px',
                  background: esEnviado ? 'var(--bg-soft)' : '#f0fdf4',
                  borderRadius: 6, fontSize: '0.82rem',
                }}>
                  <div style={{ fontSize: '1rem', lineHeight: '20px' }}>{esEnviado ? '🔵' : '🟢'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontWeight: 600 }}>{esEnviado ? 'Enviado' : 'Recibido'}</span>
                      <span className="meta" style={{ fontSize: '0.72rem' }}>{fechaStr}</span>
                    </div>
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{msg.mensaje}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal documento */}
      {showDocForm && (
        <DocumentoFormModal doc={showDocForm.id ? showDocForm : null} proveedorId={id} onSave={handleGuardarDoc} onClose={() => setShowDocForm(null)} />
      )}

      {showWhatsApp && (
        <WhatsAppTemplateModal
          contact={{ name: proveedor.nombre, phone: proveedor.telefono }}
          companyId={activeCompanyId}
          companyName={companyName}
          userName={user?.email?.split('@')[0] || ''}
          userEmail={user?.email || ''}
          userPhone={user?.user_metadata?.phone || ''}
          templates={whatsappTemplates}
          onSend={async (message) => {
            await enviarWhatsApp({ companyId: activeCompanyId, proveedorId: id, to: proveedor.telefono, body: message })
            const h = await obtenerHistorialWhatsappProveedor(id)
            setWhatsappHistorial(h)
          }}
          onClose={() => setShowWhatsApp(false)}
        />
      )}
    </div>
  )
}

function DetailField({ label, value }) {
  return (
    <div className="detail-field">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value || '—'}</span>
    </div>
  )
}

function DocumentoFormModal({ doc, proveedorId, onSave, onClose }) {
  const [nombre, setNombre] = useState(doc?.nombre || '')
  const [tipo, setTipo] = useState(doc?.tipo_documento || 'otro')
  const [fechaEmision, setFechaEmision] = useState(doc?.fecha_emision?.slice(0, 10) || '')
  const [fechaVencimiento, setFechaVencimiento] = useState(doc?.fecha_vencimiento?.slice(0, 10) || '')
  const [alertaDias, setAlertaDias] = useState(doc?.alerta_dias_antes || 30)
  const [notas, setNotas] = useState(doc?.notas || '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!nombre) return
    setSaving(true)
    try {
      await onSave({
        id: doc?.id || null,
        proveedor_id: proveedorId,
        nombre,
        tipo_documento: tipo,
        fecha_emision: fechaEmision || null,
        fecha_vencimiento: fechaVencimiento || null,
        alerta_dias_antes: alertaDias,
        notas: notas || null,
      })
    } catch (err) { /* handled by onSave */ }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="card" style={{ width: '100%', maxWidth: 440, margin: 16 }} onClick={(e) => e.stopPropagation()}>
        <div className="page-header" style={{ marginBottom: 12 }}>
          <h3 style={{ fontSize: '0.95rem', margin: 0 }}>{doc?.id ? 'Editar documento' : 'Nuevo documento'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <FormField label="Nombre *" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
            <FormField label="Tipo" as="select" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="ruc">RUC</option>
              <option value="constancia_fiscal">Constancia fiscal</option>
              <option value="seguro">Seguro</option>
              <option value="habilitacion">Habilitación</option>
              <option value="contrato">Contrato</option>
              <option value="otro">Otro</option>
            </FormField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <FormField label="Fecha emisión" type="date" value={fechaEmision} onChange={(e) => setFechaEmision(e.target.value)} />
            <FormField label="Fecha vencimiento" type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} />
          </div>
          <FormField label="Alertar días antes" type="number" min="1" max="365" value={alertaDias} onChange={(e) => setAlertaDias(Number(e.target.value))} style={{ width: 100 }} />
          <FormField label="Notas" as="textarea" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
          <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
        </form>
      </div>
    </div>
  )
}
