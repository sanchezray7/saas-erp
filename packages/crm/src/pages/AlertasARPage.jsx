import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, Button, Skeleton, formatMoney, alertError, notify } from '@saas/core'
import { obtenerAlertasAR, marcarRecordatorioEnviado } from '../data/alertasAR'
import { enviarWhatsApp } from '@saas/whatsapp'

function badgeDias(dias) {
  if (dias == null) return { bg: '#f5f5f5', color: '#6b7280', label: '—' }
  if (dias < 0) return { bg: '#fef2f2', color: '#dc2626', label: `Vencido ${Math.abs(dias)}d` }
  if (dias === 0) return { bg: '#fef3c7', color: '#d97706', label: 'Hoy' }
  if (dias <= 7) return { bg: '#fffbeb', color: '#d97706', label: `${dias}d` }
  return { bg: '#ecfdf5', color: '#059669', label: `${dias}d` }
}

export function AlertasARPage() {
  const { activeCompanyId } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [verificando, setVerificando] = useState(false)
  const [enviando, setEnviando] = useState(null)

  const load = useCallback(async () => {
    try {
      const d = await obtenerAlertasAR(activeCompanyId)
      setData(d)
    } catch (err) { alertError('Error', err.message) }
    finally { setLoading(false) }
  }, [activeCompanyId])

  useEffect(() => { load() }, [load])

  const vencidos = data.filter((d) => (d.dias_restantes ?? 999) < 0)
  const porVencer = data.filter((d) => (d.dias_restantes ?? 999) >= 0)

  async function handleEnviarWhatsApp(factura) {
    if (!factura.contact_telefono) { alertError('Error', 'El contacto no tiene teléfono'); return }
    setEnviando(factura.id)
    try {
      const saldo = formatMoney(factura.saldo, factura.moneda)
      const msg = factura.dias_restantes < 0
        ? `Estimado/a ${factura.contact_nombre}, le recordamos que su factura N° ${factura.numero} por ${saldo} está vencida desde hace ${Math.abs(factura.dias_restantes)} días. Por favor regularice su situación a la brevedad. Gracias.`
        : `Estimado/a ${factura.contact_nombre}, le recordamos que su factura N° ${factura.numero} por ${saldo} vence en ${factura.dias_restantes} días. Puede realizar el pago a través de transferencia bancaria. Gracias.`
      await enviarWhatsApp({
        companyId: activeCompanyId,
        contactId: factura.contact_id,
        to: factura.contact_telefono,
        body: msg,
      })
      await marcarRecordatorioEnviado(factura.id)
      notify(`WhatsApp enviado a ${factura.contact_nombre}`)
      load()
    } catch (err) { alertError('Error al enviar WhatsApp', err.message) }
    finally { setEnviando(null) }
  }

  async function handleVerificarTodo() {
    setVerificando(true)
    try {
      let count = 0
      for (const f of data) {
        if (f.ultimo_recordatorio) continue
        if (!f.contact_telefono) continue
        await handleEnviarWhatsApp(f)
        count++
      }
      if (count === 0) notify('Sin novedades — todas las facturas ya fueron notificadas')
      load()
    } catch (err) { alertError('Error', err.message) }
    finally { setVerificando(false) }
  }

  function renderTable(list) {
    if (list.length === 0) return <p className="meta" style={{ textAlign: 'center', padding: 16 }}>Sin facturas</p>
    return (
      <div className="table-wrapper">
        <table className="table" style={{ fontSize: '0.85rem' }}>
          <thead>
            <tr>
              <th>Factura</th>
              <th>Cliente</th>
              <th>Saldo</th>
              <th>Vencimiento</th>
              <th>Estado</th>
              <th>WhatsApp</th>
            </tr>
          </thead>
          <tbody>
            {list.map((f) => {
              const badge = badgeDias(f.dias_restantes)
              const yaEnviado = f.ultimo_recordatorio
              const enviados = f.recordatorios_enviados || 0
              return (
                <tr key={f.id}>
                  <td style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.82rem' }}>{f.numero || f.id.slice(0, 8)}</td>
                  <td>
                    <Link to={`/contacts/${f.contact_id}`} className="link">{f.contact_nombre}</Link>
                  </td>
                  <td style={{ fontWeight: 600 }}>{formatMoney(f.saldo, f.moneda)}</td>
                  <td className="meta">{f.fecha_vencimiento?.slice(0, 10)}</td>
                  <td><span className="badge" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span></td>
                  <td>
                    {f.contact_telefono ? (
                      yaEnviado ? (
                        <span className="meta" style={{ fontSize: '0.75rem' }}>✅ Enviado ({enviados})</span>
                      ) : (
                        <Button size="xs" variant="ghost" onClick={() => handleEnviarWhatsApp(f)} disabled={enviando === f.id}>
                          {enviando === f.id ? '...' : '📤 WhatsApp'}
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
      </div>
    )
  }

  if (loading) return <Skeleton.Card />

  const totalVencido = vencidos.reduce((s, f) => s + Number(f.saldo), 0)
  const totalPorVencer = porVencer.reduce((s, f) => s + Number(f.saldo), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <h1>🚨 Alertas de vencimiento — Clientes</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="sm" variant="ghost" onClick={load}>🔄 Recargar</Button>
            <Button size="sm" onClick={handleVerificarTodo} disabled={verificando}>
              {verificando ? 'Enviando...' : '📤 Verificar y notificar todo'}
            </Button>
          </div>
        </div>

        {/* Resumen cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <div style={{ background: '#fef2f2', borderRadius: 'var(--radius)', padding: '16px 20px', border: '1px solid #fecaca' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#dc2626', marginBottom: 4 }}>🔴 Vencidas ({vencidos.length})</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#dc2626' }}>{formatMoney(totalVencido)}</div>
          </div>
          <div style={{ background: '#fffbeb', borderRadius: 'var(--radius)', padding: '16px 20px', border: '1px solid #fde68a' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#d97706', marginBottom: 4 }}>🟡 Próximas ({porVencer.length})</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#d97706' }}>{formatMoney(totalPorVencer)}</div>
          </div>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="card">
          <p className="meta" style={{ textAlign: 'center', padding: 32 }}>
            No hay facturas pendientes con vencimiento. Facturá una cotización para ver alertas aquí.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {vencidos.length > 0 && (
            <div className="card">
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#dc2626', marginBottom: 12 }}>🔴 Vencidas ({vencidos.length})</h3>
              {renderTable(vencidos)}
            </div>
          )}
          {porVencer.length > 0 && (
            <div className="card">
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#d97706', marginBottom: 12 }}>🟡 Próximas ({porVencer.length})</h3>
              {renderTable(porVencer)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
