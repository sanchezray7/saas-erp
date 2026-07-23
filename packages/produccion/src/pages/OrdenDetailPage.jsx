import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth, Button, Skeleton, notify, alertError, FormField, getSupabase } from '@saas/core'
import { getOrden, getConsumos, getObtenciones, iniciarOrden, completarOrden, cancelarOrden } from '../data/ordenes'
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
  const [consumosReales, setConsumosReales] = useState({})
  const [prodPrecioVenta, setProdPrecioVenta] = useState(0)

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

      // Pre-cargar consumos reales con valores planeados
      const reales = {}
      ings.filter((i) => !i.es_subproducto).forEach((ing) => {
        reales[ing.id] = (ing.cantidad / (o.receta?.cantidad_producida || 1)) * (o.cantidad_planeada || 0)
      })
      setConsumosReales(reales)

      // Cargar precio de venta del producto final
      if (o.receta?.producto_final_id && activeCompanyId) {
        getSupabase().from('catalogo_productos').select('precio_venta').eq('id', o.receta.producto_final_id).single()
          .then(({ data }) => setProdPrecioVenta(Number(data?.precio_venta || 0)))
          .catch(() => {})
      }

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

    // Calcular planeados para comparar
    const planeados = {}
    ingredientes.filter((i) => !i.es_subproducto).forEach((ing) => {
      planeados[ing.id] = (ing.cantidad / (orden.receta?.cantidad_producida || 1)) * cantidadFinal
    })

    // Verificar si hay mermas
    const mermas = Object.entries(consumosReales).filter(([id, real]) => {
      return real > (planeados[id] || 0)
    })
    if (mermas.length > 0) {
      const msgs = mermas.map(([id, real]) => {
        const ing = ingredientes.find((i) => i.id === id)
        const plan = planeados[id] || 0
        return `${ing?.producto?.nombre || '?'}: planeado ${Number(plan).toLocaleString()}, real ${Number(real).toLocaleString()} (merma: ${(Number(real) - Number(plan)).toLocaleString()})`
      })
      if (!window.confirm(`⚠️ Se detectaron mermas:\n${msgs.join('\n')}\n\n¿Continuar de todas formas?`)) return
    }

    setCompletando(true)
    try {
      await completarOrden(activeCompanyId, user?.id, id, almacenId, cantidadFinal, loteProduccion.trim(), consumosReales)
      notify('Orden completada exitosamente')
      load()
    } catch (err) { alertError('Error', err.message) }
    finally { setCompletando(false) }
  }

  if (loading) return <Skeleton.Card />
  if (!orden) return <p className="meta" style={{ textAlign: 'center', padding: 32 }}>Orden no encontrada</p>

  const ingredientes = ingredientesReceta.filter((i) => !i.es_subproducto)
  const subproductos = ingredientesReceta.filter((i) => i.es_subproducto)

  // Costos
  const ganancia = (Number(orden?.cantidad_producida || 0) * prodPrecioVenta) - Number(orden?.costo_total || 0)
  const porcentajeGanancia = Number(orden?.costo_total) > 0 ? (ganancia / Number(orden.costo_total)) * 100 : 0

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
            <Link to="/ordenes-produccion" style={{ padding: '8px 16px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: '0.85rem' }}>← Volver</Link>
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
        {orden.notas && <p style={{ marginTop: 12, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>📝 {orden.notas}</p>}
      </div>

      {/* Costos y rentabilidad */}
      {orden.estado !== 'programada' && Number(orden.costo_total) > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>💰 Costos y rentabilidad</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, fontSize: '0.85rem' }}>
            <div style={{ background: 'var(--color-surface-alt)', borderRadius: 'var(--radius)', padding: 12 }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>Costo total</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>${Number(orden.costo_total || 0).toLocaleString()}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                ${(Number(orden.costo_total || 0) / (orden.cantidad_producida || 1)).toLocaleString()} / unidad
              </div>
            </div>
            <div style={{ background: 'var(--color-surface-alt)', borderRadius: 'var(--radius)', padding: 12 }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>Valor producido</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                ${(Number(orden.cantidad_producida || 0) * prodPrecioVenta).toLocaleString()}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                ${prodPrecioVenta.toLocaleString()} / unidad (precio venta)
              </div>
            </div>
            <div style={{ background: 'var(--color-surface-alt)', borderRadius: 'var(--radius)', padding: 12 }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>Rentabilidad</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: ganancia >= 0 ? '#16a34a' : '#dc2626' }}>
                {ganancia >= 0 ? '+' : ''}${Number(ganancia).toLocaleString()}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                {porcentajeGanancia >= 0 ? '+' : ''}{porcentajeGanancia.toFixed(1)}% margen
              </div>
            </div>
          </div>
        </div>
      )}

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
            <FormField label="Cantidad producida" type="number" value={cantidadFinal} onChange={(e) => {
              setCantidadFinal(Number(e.target.value))
              // Recalcular consumos planeados
              const factor = (Number(e.target.value) || 0) / (orden.receta?.cantidad_producida || 1)
              const updated = {}
              ingredientes.filter((i) => !i.es_subproducto).forEach((ing) => {
                updated[ing.id] = ing.cantidad * factor
              })
              setConsumosReales(updated)
            }} required />
          </div>

          {ingredientes.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 8 }}>⬇️ Consumo real de materia prima</h4>
              {ingredientes.map((ing) => {
                const plan = ing.cantidad / (orden.receta?.cantidad_producida || 1) * cantidadFinal
                const real = consumosReales[ing.id] || plan
                const merma = real - plan
                return (
                  <div key={ing.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ flex: 1, fontSize: '0.85rem' }}>{ing.producto?.nombre || '?'}</span>
                    <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', width: 90, textAlign: 'right' }}>Plan: {Number(plan).toLocaleString()} {ing.unidad_medida}</span>
                    <input type="number" step="any" value={real} onChange={(e) => setConsumosReales({ ...consumosReales, [ing.id]: Number(e.target.value) })}
                      style={{ width: 90, padding: '5px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: '0.85rem', textAlign: 'right' }} />
                    {merma > 0.001 && <span style={{ fontSize: '0.78rem', color: '#ef4444', width: 80 }}>⚠️ +{Number(merma).toLocaleString()}</span>}
                  </div>
                )
              })}
            </div>
          )}

          <Button onClick={handleCompletar} disabled={completando} style={{ marginTop: 12 }}>
            {completando ? 'Completando...' : '✅ Completar'}
          </Button>
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
