import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, Button, Skeleton, alertError, notify } from '@saas/core'
import { listarAlmacenes, transferirStock } from '../data/inventario'
import { listarProductos } from '@saas/productos'

export function TransferenciasPage() {
  const { activeCompanyId, user } = useAuth()
  const [almacenes, setAlmacenes] = useState([])
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ origen_id: '', destino_id: '', producto_id: '', cantidad: '', motivo: '' })

  useEffect(() => {
    Promise.all([
      listarAlmacenes(activeCompanyId),
      listarProductos(activeCompanyId),
    ]).then(([a, p]) => {
      setAlmacenes(a)
      setProductos(p)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [activeCompanyId])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.origen_id || !form.destino_id || !form.producto_id || !form.cantidad) return
    if (form.origen_id === form.destino_id) { alertError('Error', 'El origen y destino deben ser diferentes'); return }
    setSubmitting(true)
    try {
      await transferirStock(activeCompanyId, user?.id, form.origen_id, form.destino_id, form.producto_id, Number(form.cantidad), form.motivo || 'Transferencia manual')
      notify('Transferencia realizada')
      setForm({ origen_id: '', destino_id: '', producto_id: '', cantidad: '', motivo: '' })
    } catch (err) { alertError('Error', err.message) }
    finally { setSubmitting(false) }
  }

  if (loading) return <Skeleton.Card />

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <div className="page-header">
        <h1>🔄 Transferencia entre almacenes</h1>
        <Link to="/inventario"><Button variant="ghost" size="sm">Volver</Button></Link>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
        <select className="form-input" value={form.origen_id} onChange={(e) => setForm((p) => ({ ...p, origen_id: e.target.value }))}>
          <option value="">— Almacén de origen —</option>
          {almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </select>
        <select className="form-input" value={form.destino_id} onChange={(e) => setForm((p) => ({ ...p, destino_id: e.target.value }))}>
          <option value="">— Almacén de destino —</option>
          {almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </select>
        <select className="form-input" value={form.producto_id} onChange={(e) => setForm((p) => ({ ...p, producto_id: e.target.value }))}>
          <option value="">— Producto —</option>
          {productos.filter((p) => p.activo).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <input className="form-input" type="number" min="0.01" step="0.01" placeholder="Cantidad" value={form.cantidad} onChange={(e) => setForm((p) => ({ ...p, cantidad: e.target.value }))} />
        <input className="form-input" placeholder="Motivo (opcional)" value={form.motivo} onChange={(e) => setForm((p) => ({ ...p, motivo: e.target.value }))} />
        <Button type="submit" disabled={submitting || !form.origen_id || !form.destino_id || !form.producto_id || !form.cantidad || form.origen_id === form.destino_id}>
          {submitting ? 'Transfiriendo...' : '✅ Realizar transferencia'}
        </Button>
      </form>
    </div>
  )
}
