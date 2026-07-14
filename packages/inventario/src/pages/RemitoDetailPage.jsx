import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth, Button, Skeleton, formatMoney, alertError } from '@saas/core'
import { obtenerRemito } from '../data/remitos'

export function RemitoDetailPage() {
  const { id } = useParams()
  const { companies, activeCompanyId } = useAuth()
  const [remito, setRemito] = useState(null)
  const [loading, setLoading] = useState(true)
  const companyName = companies.find((c) => c.id === activeCompanyId)?.name || ''

  useEffect(() => {
    obtenerRemito(id).then(setRemito).catch(() => {}).finally(() => setLoading(false))
  }, [id])

  if (loading) return <Skeleton.Card />
  if (!remito) return <div className="card"><p className="meta">Remito no encontrado</p></div>

  const items = remito.picking?.items || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="no-print" style={{ display: 'flex', gap: 8 }}>
        <Link to="/remitos"><Button variant="ghost" size="sm">Volver</Button></Link>
        <Button size="sm" variant="ghost" onClick={() => window.print()}>🖨 Imprimir</Button>
      </div>

      <div className="card" id="remito-print" style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: '1.2rem', margin: 0 }}>{companyName}</h1>
          <h2 style={{ fontSize: '1.5rem', margin: '8px 0', letterSpacing: 2 }}>REMITO</h2>
          <div style={{ fontFamily: 'monospace', fontSize: '0.9rem', fontWeight: 700 }}>N° {remito.numero}</div>
          <div className="meta">Fecha: {remito.fecha?.slice(0, 10)}</div>
        </div>

        {remito.transportista && (
          <div style={{ marginBottom: 24, padding: 12, background: 'var(--bg-soft)', borderRadius: 6, fontSize: '0.85rem' }}>
            <div><strong>Transportista:</strong> {remito.transportista.nombre}</div>
            {remito.chofer && <div><strong>Chofer:</strong> {remito.chofer}</div>}
            {remito.patente && <div><strong>Patente:</strong> {remito.patente}</div>}
            {remito.destino && <div><strong>Destino:</strong> {remito.destino}</div>}
          </div>
        )}

        <table className="table" style={{ fontSize: '0.85rem' }}>
          <thead>
            <tr>
              <th style={{ width: 80 }}>Cant.</th>
              <th>Producto</th>
              <th style={{ textAlign: 'right', width: 120 }}>Código</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.id || i}>
                <td style={{ textAlign: 'center', fontWeight: 600 }}>{Number(item.cantidad_preparada || item.cantidad_solicitada).toLocaleString()}</td>
                <td>{item.producto?.nombre || '—'}</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '0.78rem' }}>{item.producto?.codigo || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between' }}>
          <div>_________________________<br />Firma y sello</div>
          <div>_________________________<br />Recibí conforme</div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          #remito-print { box-shadow: none !important; border: none !important; padding: 0 !important; }
        }
      `}</style>
    </div>
  )
}
