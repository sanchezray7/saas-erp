import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth, Button, Skeleton, alertError, notify } from '@saas/core'
import { getPresupuesto, getPresupuestoItems } from '../data/presupuestos'
import { convertirPresupuestoAOT } from '../data/ordenes'

const ESTADOS = {
  borrador: '📄 Borrador', enviado: '📨 Enviado', aprobado: '✅ Aprobado', rechazado: '❌ Rechazado',
}

export function PresupuestoDetailPage() {
  const { id } = useParams()
  const { activeCompanyId, user } = useAuth()
  const navigate = useNavigate()
  const [presupuesto, setPresupuesto] = useState<any>(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [convirtiendo, setConvirtiendo] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [p, its] = await Promise.all([getPresupuesto(id), getPresupuestoItems(id)])
      setPresupuesto(p); setItems(its || [])
    } catch (err) { alertError('Error', err.message) }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  async function handleConvertir() {
    if (!window.confirm('Convertir este presupuesto en orden de trabajo?')) return
    setConvirtiendo(true)
    try {
      const otId = await convertirPresupuestoAOT(activeCompanyId, user?.id, id)
      notify('Orden de trabajo creada')
      navigate(`/ordenes-trabajo/${otId}`)
    } catch (err) { alertError('Error', err.message) }
    finally { setConvirtiendo(false) }
  }

  if (loading) return <Skeleton.Card />
  if (!presupuesto) return <p className="meta" style={{ textAlign: 'center', padding: 32 }}>Presupuesto no encontrado</p>

  const total = items.reduce((s, i) => s + (Number(i.cantidad) || 0) * (Number(i.precio_unitario) || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <div>
            <h1>📋 Presupuesto #{presupuesto.numero}</h1>
            <p className="meta" style={{ marginTop: 4 }}>{ESTADOS[presupuesto.estado]} · {presupuesto.fecha_emision}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {presupuesto.estado === 'borrador' && (
              <Button onClick={handleConvertir} disabled={convirtiendo}>
                {convirtiendo ? 'Convirtiendo...' : '⬆️ Convertir a OT'}
              </Button>
            )}
            <Link to="/presupuestos" style={{ padding: '8px 16px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: '0.85rem' }}>← Volver</Link>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12, fontSize: '0.85rem' }}>
          <div><strong>Cliente:</strong> {presupuesto.contacto || '—'}</div>
          <div><strong>Dirección:</strong> {presupuesto.direccion || '—'}</div>
          {presupuesto.fecha_validez && <div><strong>Validez:</strong> {presupuesto.fecha_validez}</div>}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 12 }}>Items</h3>
        <table className="table" style={{ fontSize: '0.82rem' }}>
          <thead><tr><th>Tipo</th><th>Descripción</th><th style={{ textAlign: 'right' }}>Cant.</th><th style={{ textAlign: 'right' }}>Precio</th><th style={{ textAlign: 'right' }}>Subtotal</th></tr></thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>{i.tipo === 'servicio' ? '🔧' : i.tipo === 'repuesto' ? '🔩' : '📦'}</td>
                <td>{i.descripcion}</td>
                <td style={{ textAlign: 'right' }}>{Number(i.cantidad).toLocaleString()}</td>
                <td style={{ textAlign: 'right' }}>${Number(i.precio_unitario).toLocaleString()}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>${(Number(i.cantidad) * Number(i.precio_unitario)).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700, borderTop: '2px solid var(--color-border)' }}>
              <td colSpan={4} style={{ textAlign: 'right' }}>Total:</td>
              <td style={{ textAlign: 'right' }}>${total.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {presupuesto.notas && (
        <div className="card">
          <h3 style={{ marginBottom: 8 }}>Notas</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{presupuesto.notas}</p>
        </div>
      )}
    </div>
  )
}
