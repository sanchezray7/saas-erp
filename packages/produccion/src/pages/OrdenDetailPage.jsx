import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth, Button, Skeleton, notify, alertError, FormField, getSupabase } from '@saas/core'
import { getOrden, getConsumos, getObtenciones, iniciarOrden, completarOrden, cancelarOrden, registrarConsumo, registrarObtencion } from '../data/ordenes'
import { listarIngredientes } from '../data/recetas'

const ESTADOS = { programada: '🟡 Programada', en_proceso: '🔵 En proceso', completada: '✅ Completada', cancelada: '❌ Cancelada' }

export function OrdenDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const { activeCompanyId, user } = useAuth()
  const [orden, setOrden] = useState(null)
  const [consumos, setConsumos] = useState([])
  const [obtenciones, setObtenciones] = useState([])
  const [ingredientesReceta, setIngredientesReceta] = useState([])
  const [loading, setLoading] = useState(true)
  const [almacenes, setAlmacenes] = useState([])
  const [almacenId, setAlmacenId] = useState('')
  const [loteProduccion, setLoteProduccion] = useState('')
  const [cantidadFinal, setCantidadFinal] = useState(0)
  const [completando, setCompletando] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const o = await getOrden(id)
      setOrden(o)
      setCantidadFinal(o.cantidad_planeada)
      const [cs, obs, ings] = await Promise.all([
        getConsumos(id),
        getObtenciones(id),
        listarIngredientes(o.receta_id),
      ])
      setConsumos(cs)
      setObtenciones(obs)
      setIngredientesReceta(ings)

      if (activeCompanyId) {
        getSupabase().from('almacenes').select('id, nombre').eq('company_id', activeCompanyId).order('nombre').then(({ data }) => {
          setAlmacenes(data || [])
          if (data?.length === 1) setAlmacenId(data[0].id)
        })
      }
    } catch (err) { alertError('Error', err.message) }
    finally { setLoading(false) }
  }, [id, activeCompanyId])

  useEffect(() => { load() }, [load])

  async function handleIniciar() {
    try {
      await iniciarOrden(id)
      notify('Orden iniciada')
      load()
    } catch (err) { alertError('Error', err.message) }
  }

  async function handleCancelar() {
    if (!window.confirm('¿Cancelar esta orden de producción?')) return
    try {
      await cancelarOrden(id)
      notify('Orden cancelada')
      load()
    } catch (err) { alertError('Error', err.message) }
  }

  async function handleCompletar() {
    if (!almacenId) { alertError('Error', 'Seleccioná un almacén de destino'); return }
    if (!loteProduccion.trim()) { alertError('Error', 'Ingresá un número de lote'); return }
    if (cantidadFinal <= 0) { alertError('Error', 'La cantidad producida debe ser mayor a 0'); return }

    setCompletando(true)
    try {
      await completarOrden(activeCompanyId, user?.id, id, almacenId, cantidadFinal, loteProduccion.trim())
      notify('Orden completada exitosamente')
      load()
    } catch (err) { alertError('Error', err.message) }
    finally { setCompletando(false) }
  }

  if (loading) return <Skeleton.Card />
  if (!orden) return <p className="meta" style={{ textAlign: 'center', padding: 32 }}>Orden no encontrada</p>

  const ingredientes = ingredientesReceta.filter((i) => !i.es_subproducto)
  const subproductos = ingredientesReceta.filter((i) => i.es_subproducto)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <div>
            <h1>⚙️ Orden #{orden.numero}</h1>
            <p className="meta" style={{ marginTop: 4 }}>{ESTADOS[orden.estado]} · {orden.receta?.nombre}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {orden.estado === 'programada' && (
              <>
                <Button onClick={handleIniciar}>▶️ Iniciar producción</Button>
                <Button onClick={handleCancelar} style={{ background: '#ef4444', color: 'white' }}>Cancelar</Button>
              </>
            )}
            {orden.estado === 'en_proceso' && (
              <Button onClick={handleCancelar} style={{ background: '#ef4444', color: 'white' }}>Cancelar</Button>
            )}
            <Link to="/ordenes-produccion" style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.85rem' }}>← Volver</Link>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 12, fontSize: '0.85rem' }}>
          <div><strong>Lote:</strong> {orden.lote || '—'}</div>
          <div><strong>Cantidad planeada:</strong> {Number(orden.cantidad_planeada).toLocaleString()}</div>
          <div><strong>Cantidad producida:</strong> {orden.cantidad_producida ? Number(orden.cantidad_producida).toLocaleString() : '—'}</div>
          {orden.fecha_inicio_real && <div><strong>Inicio real:</strong> {new Date(orden.fecha_inicio_real).toLocaleString()}</div>}
          {orden.fecha_fin && <div><strong>Fin:</strong> {new Date(orden.fecha_fin).toLocaleString()}</div>}
          <div><strong>Costo total:</strong> {orden.costo_total ? `$${Number(orden.costo_total).toLocaleString()}` : '—'}</div>
        </div>
        {orden.notas && <p style={{ marginTop: 12, fontSize: '0.85rem', color: 'var(--text-muted)' }}>📝 {orden.notas}</p>}
      </div>

      {/* Completar orden */}
      {orden.estado === 'en_proceso' && (
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>✅ Completar orden</h3>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <FormField label="Almacén destino" as="select" value={almacenId} onChange={(e) => setAlmacenId(e.target.value)} required>
              <option value="">Seleccionar...</option>
              {almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </FormField>
            <FormField label="Lote" value={loteProduccion} onChange={(e) => setLoteProduccion(e.target.value)} placeholder="Ej: QSO-2026-001" required />
            <FormField label="Cantidad producida" type="number" value={cantidadFinal} onChange={(e) => setCantidadFinal(Number(e.target.value))} required />
            <Button onClick={handleCompletar} disabled={completando} style={{ marginBottom: 4 }}>
              {completando ? 'Completando...' : '✅ Completar'}
            </Button>
          </div>
        </div>
      )}

      {/* Ingredientes de la receta */}
      <div className="card">
        <h3 style={{ marginBottom: 12 }}>📋 Receta: {orden.receta?.nombre}</h3>
        {ingredientes.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>⬇️ Materia prima (por unidad)</h4>
            <table className="table" style={{ fontSize: '0.8rem' }}>
              <thead><tr><th>Producto</th><th>Cantidad</th><th>Unidad</th><th>Merma</th></tr></thead>
              <tbody>
                {ingredientes.map((ing) => (
                  <tr key={ing.id}>
                    <td>{ing.producto?.nombre}</td>
                    <td>{Number(ing.cantidad).toLocaleString()}</td>
                    <td>{ing.unidad_medida}</td>
                    <td>{ing.merma_porcentaje > 0 ? `${ing.merma_porcentaje}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {subproductos.length > 0 && (
          <div>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>🔄 Subproductos generados (por unidad)</h4>
            <table className="table" style={{ fontSize: '0.8rem' }}>
              <thead><tr><th>Producto</th><th>Cantidad</th><th>Unidad</th></tr></thead>
              <tbody>
                {subproductos.map((ing) => (
                  <tr key={ing.id}>
                    <td>{ing.producto?.nombre}</td>
                    <td>{Number(ing.cantidad).toLocaleString()}</td>
                    <td>{ing.unidad_medida}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Consumos registrados */}
      {consumos.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>📦 Consumos registrados</h3>
          <table className="table" style={{ fontSize: '0.8rem' }}>
            <thead><tr><th>Producto</th><th>Cantidad</th><th>Lote</th><th>Costo unit.</th></tr></thead>
            <tbody>
              {consumos.map((c) => (
                <tr key={c.id}>
                  <td>{c.producto?.nombre}</td>
                  <td>{Number(c.cantidad).toLocaleString()}</td>
                  <td className="meta">{c.lote || '—'}</td>
                  <td>{c.costo_unitario ? `$${Number(c.costo_unitario).toLocaleString()}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Obtenciones registradas */}
      {obtenciones.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>✅ Productos obtenidos</h3>
          <table className="table" style={{ fontSize: '0.8rem' }}>
            <thead><tr><th>Producto</th><th>Cantidad</th><th>Lote</th><th>Costo unit.</th></tr></thead>
            <tbody>
              {obtenciones.map((o) => (
                <tr key={o.id}>
                  <td>{o.producto?.nombre}</td>
                  <td>{Number(o.cantidad).toLocaleString()}</td>
                  <td className="meta">{o.lote || '—'}</td>
                  <td>{o.costo_unitario ? `$${Number(o.costo_unitario).toLocaleString()}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
