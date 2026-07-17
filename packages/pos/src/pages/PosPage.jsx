import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useAuth, alertError, notify, getSupabase } from '@saas/core'
import { listarProductosPos, listarCajas, abrirCaja, registrarVentaPos, seedConsumidorFinal } from '../data/pos'
import { listarCategorias } from '@saas/productos'
import Cart from '../components/Cart'
import PaymentModal from '../components/PaymentModal'
import { imprimirTicket } from '../components/TicketPrint'

export function PosPage() {
  const { activeCompanyId, user } = useAuth()
  const [productos, setProductos] = useState([])
  const [cajas, setCajas] = useState([])
  const [cajaActiva, setCajaActiva] = useState(null)
  const [almacenId, setAlmacenId] = useState(null)
  const [categorias, setCategorias] = useState([])
  const [search, setSearch] = useState('')
  const [catSeleccionada, setCatSeleccionada] = useState(null)
  const [items, setItems] = useState([])
  const [showPayment, setShowPayment] = useState(false)
  const [saldoApertura, setSaldoApertura] = useState(0)
  const [showApertura, setShowApertura] = useState(false)
  const [clienteId, setClienteId] = useState(null)
  const searchRef = useRef(null)
  const supabase = getSupabase()

  const load = useCallback(async () => {
    try {
      const [prods, caj, almacenes, cats] = await Promise.all([
        listarProductosPos(activeCompanyId),
        listarCajas(activeCompanyId),
        supabase.from('almacenes').select('id').eq('company_id', activeCompanyId).limit(1),
        listarCategorias(activeCompanyId, 'producto'),
      ])
      setProductos(prods)
      setCajas(caj)
      setCategorias(cats)
      if (almacenes?.data?.length > 0) setAlmacenId(almacenes.data[0].id)
      const activa = caj.find((c) => c.estado === 'abierta')
      setCajaActiva(activa || null)
      if (!activa && caj.length > 0) setShowApertura(true)

      const cid = await seedConsumidorFinal(activeCompanyId)
      setClienteId(cid)
    } catch (err) { alertError('Error', err.message) }
  }, [activeCompanyId])

  useEffect(() => { load() }, [load])

  // IDs de categoría + todas sus subcategorías
  function expandirCategoria(catId) {
    const ids = [catId]
    const subs = categorias.filter((c) => c.parent_id === catId)
    for (const sub of subs) {
      ids.push(sub.id)
      const nested = categorias.filter((c) => c.parent_id === sub.id)
      ids.push(...nested.map((n) => n.id))
    }
    return ids
  }

  const filtered = useMemo(() => {
    let res = productos
    if (catSeleccionada) {
      const ids = expandirCategoria(catSeleccionada)
      res = res.filter((p) => p.categoria && ids.includes(p.categoria.id))
    }
    if (search) {
      const s = search.toLowerCase()
      res = res.filter((p) =>
        p.nombre.toLowerCase().includes(s) ||
        p.codigo?.toLowerCase().includes(s) ||
        p.codigo_barras?.toLowerCase().includes(s)
      )
    }
    return res
  }, [productos, search, catSeleccionada, categorias])

  const categoriasPadre = useMemo(() => categorias.filter((c) => !c.parent_id), [categorias])

  function agregarProducto(p) {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.producto_id === p.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], cantidad: next[idx].cantidad + 1 }
        return next
      }
      return [...prev, { producto_id: p.id, nombre: p.nombre, cantidad: 1, precio: Number(p.precio_venta), moneda: p.moneda || 'PYG' }]
    })
    searchRef.current?.focus()
  }

  function cambiarCantidad(idx, cant) {
    setItems((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], cantidad: cant }
      return next
    })
  }

  function eliminarItem(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const total = useMemo(() => items.reduce((s, i) => s + i.cantidad * i.precio, 0), [items])

  async function handleAbrirCaja() {
    if (!saldoApertura || saldoApertura < 0) { alertError('Error', 'Ingresá un saldo inicial válido'); return }
    try {
      await abrirCaja(cajas[0].id, saldoApertura)
      notify('Caja abierta')
      setShowApertura(false)
      load()
    } catch (err) { alertError('Error', err.message) }
  }

  async function handlePagar(datos) {
    if (!cajaActiva) { alertError('Error', 'No hay caja abierta'); return }
    try {
      const res = await registrarVentaPos(activeCompanyId, {
        cajaId: cajaActiva.id, clienteId,
        items: items.map((i) => ({ producto_id: i.producto_id, nombre: i.nombre, cantidad: i.cantidad, precio: i.precio, almacen_id: almacenId })),
        subtotal: total, descuento: datos.descuento || 0, total: total - (datos.descuento || 0),
        formaPago: datos.formaPago, montoEfectivo: datos.montoEfectivo || 0,
        montoTarjeta: datos.montoTarjeta || 0, montoTransferencia: datos.montoTransferencia || 0,
        montoRecibido: datos.montoRecibido || 0, montoCambio: datos.montoCambio || 0,
      })
      notify(`Venta #${res.numero} registrada`)
      setShowPayment(false)
      const { data: ventaCompleta } = await supabase.from('ventas_pos').select('*').eq('id', res.venta_id).single()
      if (ventaCompleta) imprimirTicket(ventaCompleta, 'Saas Empresarial')
      setItems([])
      load()
    } catch (err) { alertError('Error', err.message) }
  }

  return (
    <div className="card" style={{ padding: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-alt)' }}>
        <h2 style={{ margin: 0, fontSize: '1rem' }}>🛒 POS</h2>
        <input ref={searchRef} type="search" placeholder="🔍 Buscar por nombre, código o barras..." className="form-input"
          style={{ flex: 1, maxWidth: 400 }} value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Caja: <strong>{cajaActiva?.nombre || 'Sin caja abierta'}</strong>
        </span>
        {!cajaActiva && <button className="btn btn-primary btn-sm" onClick={() => setShowApertura(true)}>Abrir caja</button>}
      </div>

      <div style={{ display: 'flex', height: 'calc(100vh - 260px)', minHeight: 400 }}>
        {/* Categorías */}
        <div style={{ width: 160, borderRight: '1px solid var(--border)', overflowY: 'auto', padding: 8 }}>
          <button className={`btn ${!catSeleccionada ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setCatSeleccionada(null)} style={{ width: '100%', justifyContent: 'center', marginBottom: 4, fontSize: '0.75rem', padding: '6px' }}>
            📦 Todas
          </button>
          {categoriasPadre.map((cat) => (
            <div key={cat.id}>
              <button className={`btn ${catSeleccionada === cat.id ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setCatSeleccionada(catSeleccionada === cat.id ? null : cat.id)}
                style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 2, fontSize: '0.75rem', padding: '6px 8px' }}>
                {cat.icono || '📦'} {cat.nombre}
              </button>
              {categorias.filter((s) => s.parent_id === cat.id).map((sub) => (
                <button key={sub.id} className={`btn ${catSeleccionada === sub.id ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setCatSeleccionada(catSeleccionada === sub.id ? null : sub.id)}
                  style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 2, fontSize: '0.7rem', padding: '4px 8px 4px 24px' }}>
                  {sub.icono || '•'} {sub.nombre}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Productos */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8, alignContent: 'start' }}>
          {filtered.length === 0 ? (
            <p className="meta" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '2rem' }}>Sin productos</p>
          ) : filtered.slice(0, 50).map((p) => (
            <button key={p.id} onClick={() => agregarProducto(p)}
              style={{ padding: '12px 8px', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', background: 'white', textAlign: 'center', transition: 'all 0.15s', display: 'flex', flexDirection: 'column', gap: 4 }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{p.nombre}</span>
              <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.9rem' }}>
                {Number(p.precio_venta).toLocaleString()} {p.moneda || 'PYG'}
              </span>
            </button>
          ))}
        </div>

        {/* Carrito */}
        <div style={{ width: 320, borderLeft: '1px solid var(--border)' }}>
          <Cart items={items} onCantidad={cambiarCantidad} onEliminar={eliminarItem} onPagar={() => setShowPayment(true)} />
        </div>
      </div>

      {showApertura && (
        <div className="modal-overlay" onClick={() => setShowApertura(false)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
            <h3>Abrir caja</h3>
            <p className="meta" style={{ marginBottom: 12 }}>Caja: {cajas[0]?.nombre || 'Principal'}</p>
            <div className="form-field">
              <label>Saldo inicial</label>
              <input type="number" className="form-input" value={saldoApertura} onChange={(e) => setSaldoApertura(Number(e.target.value) || 0)} min="0" autoFocus />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }} onClick={handleAbrirCaja}>Abrir caja</button>
          </div>
        </div>
      )}

      {showPayment && <PaymentModal total={total} onConfirm={handlePagar} onClose={() => setShowPayment(false)} />}
    </div>
  )
}
