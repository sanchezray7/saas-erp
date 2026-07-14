import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, Button, Skeleton, formatMoney, alertError, notify } from '@saas/core'
import { alertasVencimiento, marcarAlertaEnviada, actualizarEstadoDocumento } from '../data/documentosProveedor'
import { enviarWhatsApp } from '@saas/whatsapp'

function estadoBadge(dias, estado) {
  if (estado === 'anulado') return { bg: '#f5f5f5', color: '#9ca3af', label: 'Anulado' }
  if (dias == null) return { bg: '#dcfce7', color: '#16a34a', label: 'Vigente' }
  if (dias < 0) return { bg: '#fef2f2', color: '#dc2626', label: `Vencido (${Math.abs(dias)}d)` }
  if (dias <= 7) return { bg: '#fef2f2', color: '#dc2626', label: `${dias}d` }
  if (dias <= 15) return { bg: '#fffbeb', color: '#d97706', label: `${dias}d` }
  return { bg: '#fef3c7', color: '#d97706', label: `${dias}d` }
}

export function AlertasVencimientoPage() {
  const { activeCompanyId } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [verificando, setVerificando] = useState(false)
  const [enviando, setEnviando] = useState(null)

  const load = useCallback(async () => {
    try {
      const d = await alertasVencimiento(activeCompanyId)
      setData(d)
    } catch (err) { alertError('Error', err.message) }
    finally { setLoading(false) }
  }, [activeCompanyId])

  useEffect(() => { load() }, [load])

  const vencidos = data.filter((d) => (d.dias_restantes ?? 999) < 0)
  const porVencer = data.filter((d) => (d.dias_restantes ?? 999) >= 0)

  async function handleEnviarWhatsApp(doc) {
    setEnviando(doc.id)
    try {
      const msg = `Hola ${doc.proveedor_nombre}, le recordamos que su documento "${doc.nombre}" (${doc.tipo_documento}) ${doc.dias_restantes < 0 ? 'está vencido desde hace ' + Math.abs(doc.dias_restantes) + ' días' : 'vence en ' + doc.dias_restantes + ' días'}. Por favor actualícelo a la brevedad. Gracias.`
      await enviarWhatsApp({
        companyId: activeCompanyId,
        to: doc.proveedor_telefono,
        body: msg,
      })
      await marcarAlertaEnviada(doc.id)
      await actualizarEstadoDocumento(doc.id, doc.dias_restantes < 0 ? 'vencido' : 'por_vencer')
      notify(`WhatsApp enviado a ${doc.proveedor_nombre}`)
      load()
    } catch (err) { alertError('Error al enviar WhatsApp', err.message) }
    finally { setEnviando(null) }
  }

  async function handleVerificarTodo() {
    setVerificando(true)
    try {
      let count = 0
      for (const doc of data) {
        if (doc.ultima_alerta_enviada) continue
        if (!doc.proveedor_telefono) continue
        await handleEnviarWhatsApp(doc)
        count++
      }
      if (count === 0) notify('Sin novedades - todos los documentos ya fueron notificados')
      load()
    } catch (err) { alertError('Error', err.message) }
    finally { setVerificando(false) }
  }

  function renderTable(list) {
    if (list.length === 0) return <p className="meta" style={{ textAlign: 'center', padding: 16 }}>Sin documentos</p>
    return (
      <table className="table" style={{ fontSize: '0.85rem' }}>
        <thead>
          <tr>
            <th>Documento</th>
            <th>Tipo</th>
            <th>Proveedor</th>
            <th>Vencimiento</th>
            <th>Estado</th>
            <th>WhatsApp</th>
          </tr>
        </thead>
        <tbody>
          {list.map((doc) => {
            const badge = estadoBadge(doc.dias_restantes, doc.estado)
            const yaEnviado = doc.ultima_alerta_enviada
            return (
              <tr key={doc.id}>
                <td style={{ fontWeight: 600 }}>{doc.nombre}</td>
                <td><span className="badge">{doc.tipo_documento}</span></td>
                <td>
                  <Link to={`/proveedores/${doc.proveedor_id}`} className="link">{doc.proveedor_nombre}</Link>
                </td>
                <td className="meta">{doc.fecha_vencimiento?.slice(0, 10)}</td>
                <td><span className="badge" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span></td>
                <td>
                  {doc.proveedor_telefono ? (
                    yaEnviado ? (
                      <span className="meta" style={{ fontSize: '0.75rem' }}>✅ Enviado</span>
                    ) : (
                      <Button size="xs" variant="ghost" onClick={() => handleEnviarWhatsApp(doc)} disabled={enviando === doc.id}>
                        {enviando === doc.id ? '...' : '📤 WhatsApp'}
                      </Button>
                    )
                  ) : (
                    <span className="meta" style={{ fontSize: '0.75rem' }}>Sin teléfono</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  if (loading) return <Skeleton.Card />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <h1>🚨 Alertas de vencimiento</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="sm" variant="ghost" onClick={load}>🔄 Recargar</Button>
            <Button size="sm" onClick={handleVerificarTodo} disabled={verificando}>
              {verificando ? 'Enviando...' : '📤 Verificar y notificar todo'}
            </Button>
          </div>
        </div>

        {data.length === 0 ? (
          <p className="meta" style={{ textAlign: 'center', padding: 32 }}>
            No hay documentos próximos a vencer. Registrá documentos en el detalle de cada proveedor.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {vencidos.length > 0 && (
              <div>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>
                  🔴 Vencidos ({vencidos.length})
                </h3>
                {renderTable(vencidos)}
              </div>
            )}
            {porVencer.length > 0 && (
              <div>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#d97706', marginBottom: 8 }}>
                  🟡 Por vencer ({porVencer.length})
                </h3>
                {renderTable(porVencer)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
