import { useMemo } from 'react'

export default function Cart({ items, onCantidad, onEliminar, onPagar }) {
  const subtotal = useMemo(() => items.reduce((s, i) => s + i.cantidad * i.precio, 0), [items])
  const totalItems = items.reduce((s, i) => s + i.cantidad, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Carrito vacío
          </div>
        ) : items.map((item, i) => (
          <div key={item.producto_id + i} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nombre}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {(item.precio).toLocaleString()} {item.moneda || 'PYG'} c/u
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button className="btn-icon" onClick={() => onCantidad(i, Math.max(1, item.cantidad - 1))} style={{ width: 28, height: 28, fontSize: '0.8rem' }}>−</button>
              <span style={{ width: 32, textAlign: 'center', fontWeight: 700, fontSize: '0.9rem' }}>{item.cantidad}</span>
              <button className="btn-icon" onClick={() => onCantidad(i, item.cantidad + 1)} style={{ width: 28, height: 28, fontSize: '0.8rem' }}>+</button>
            </div>
            <div style={{ textAlign: 'right', minWidth: 70, fontWeight: 600, fontSize: '0.85rem' }}>
              {(item.cantidad * item.precio).toLocaleString()}
            </div>
            <button className="btn-icon" onClick={() => onEliminar(i)} style={{ width: 28, height: 28, color: '#ef4444', fontSize: '0.8rem' }}>✕</button>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '2px solid var(--text)', padding: '12px', background: 'var(--bg-alt)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.85rem' }}>
          <span>Items</span><span>{totalItems}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.1rem' }}>
          <span>TOTAL</span><span>{subtotal.toLocaleString()} Gs.</span>
        </div>
        <button
          className="btn btn-primary btn-lg"
          disabled={items.length === 0}
          onClick={onPagar}
          style={{ width: '100%', justifyContent: 'center', marginTop: 12, fontSize: '1rem', padding: '12px' }}
        >
          💵 Cobrar ({items.length} items)
        </button>
      </div>
    </div>
  )
}
