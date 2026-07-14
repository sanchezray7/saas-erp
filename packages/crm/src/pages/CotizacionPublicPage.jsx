import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { formatMoney } from '@saas/core'
import { obtenerCotizacionPublica } from '../data/cotizaciones'

export function CotizacionPublicPage() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!token) return
    obtenerCotizacionPublica(token)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div style={{ maxWidth: 800, margin: '40px auto', padding: 20, textAlign: 'center' }}>
        <p style={{ color: '#6b7280' }}>Cargando cotización...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ maxWidth: 800, margin: '40px auto', padding: 20, textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: 8 }}>📄</div>
        <h1 style={{ fontSize: '1.2rem', margin: '0 0 8px' }}>Cotización no disponible</h1>
        <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>{error}</p>
      </div>
    )
  }

  if (!data) return null

  return (
    <div style={{
      maxWidth: 800, margin: '0 auto', padding: 24,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* Encabezado */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', marginBottom: 32,
        paddingBottom: 20, borderBottom: '2px solid #e5e7eb',
      }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', margin: 0, color: '#111827' }}>COTIZACIÓN</h1>
          <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '4px 0 0' }}>
            N° {data.numero}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#111827' }}>
            {data.empresa?.name || 'Tu Empresa'}
          </div>
          {data.empresa?.rif && (
            <div style={{ color: '#6b7280', fontSize: '0.78rem' }}>
              {data.empresa.pais === 'PY' ? 'RUC' : 'RIF'}: {data.empresa.rif}
            </div>
          )}
        </div>
      </div>

      {/* Cliente */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', marginBottom: 24,
        background: '#f9fafb', padding: 16, borderRadius: 8,
      }}>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4, color: '#374151', fontSize: '0.85rem' }}>Cliente</div>
          <div style={{ color: '#111827', fontWeight: 500 }}>{data.contacto?.name || '-'}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 600, marginBottom: 4, color: '#374151', fontSize: '0.85rem' }}>Fecha</div>
          <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>{data.created_at?.slice(0, 10)}</div>
          <div style={{
            marginTop: 4, fontSize: '0.72rem', fontWeight: 600,
            color: data.estado === 'aceptada' ? '#16a34a' : data.estado === 'rechazada' ? '#dc2626' : '#d97706',
            textTransform: 'capitalize',
          }}>
            {data.estado}
          </div>
        </div>
      </div>

      {/* Items */}
      <table style={{
        width: '100%', borderCollapse: 'collapse', marginBottom: 24, fontSize: '0.85rem',
      }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: '#374151', fontWeight: 600 }}>Descripción</th>
            <th style={{ textAlign: 'right', padding: '8px 12px', color: '#374151', fontWeight: 600, width: 80 }}>Cant.</th>
            <th style={{ textAlign: 'right', padding: '8px 12px', color: '#374151', fontWeight: 600, width: 120 }}>Precio unit.</th>
            <th style={{ textAlign: 'right', padding: '8px 12px', color: '#374151', fontWeight: 600, width: 120 }}>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {(data.items || []).map((item, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '10px 12px', color: '#111827' }}>{item.descripcion}</td>
              <td style={{ textAlign: 'right', padding: '10px 12px', color: '#111827' }}>{Number(item.cantidad).toLocaleString()}</td>
              <td style={{ textAlign: 'right', padding: '10px 12px', color: '#111827' }}>{formatMoney(item.precio_unitario, data.moneda)}</td>
              <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 600, color: '#111827' }}>{formatMoney(item.subtotal, data.moneda)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Total */}
      <div style={{ textAlign: 'right', fontSize: '1.2rem', fontWeight: 700, color: '#111827', padding: '12px 0', borderTop: '2px solid #e5e7eb' }}>
        Total: {formatMoney(data.total, data.moneda)}
      </div>

      {/* Notas */}
      {data.notas && (
        <div style={{ marginTop: 24, padding: 16, background: '#f9fafb', borderRadius: 8, fontSize: '0.82rem', color: '#6b7280', whiteSpace: 'pre-wrap' }}>
          <div style={{ fontWeight: 600, marginBottom: 4, color: '#374151' }}>Notas</div>
          {data.notas}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 40, textAlign: 'center', color: '#9ca3af', fontSize: '0.75rem', borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
        Cotización generada por <strong style={{ color: '#6b7280' }}>{data.empresa?.name || 'Sistema'}</strong>
      </div>
    </div>
  )
}
