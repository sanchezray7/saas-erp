import { useState, useMemo } from 'react'

export default function PaymentModal({ total, onConfirm, onClose }) {
  const [forma, setForma] = useState('efectivo')
  const [montoEfectivo, setMontoEfectivo] = useState(total)
  const [montoTarjeta, setMontoTarjeta] = useState(0)
  const [montoTransf, setMontoTransf] = useState(0)
  const [descuento, setDescuento] = useState(0)

  const restante = useMemo(() => {
    if (forma === 'efectivo') return 0
    if (forma === 'tarjeta') return 0
    if (forma === 'transferencia') return 0
    // mixto: efectivo + tarjeta + transferencia deben cubrir el total
    return total - montoEfectivo - montoTarjeta - montoTransf
  }, [forma, total, montoEfectivo, montoTarjeta, montoTransf])

  const cambio = forma === 'efectivo' ? Math.max(0, montoEfectivo - total) : 0
  const puedePagar = (forma !== 'mixto') || (restante <= 0 && (montoEfectivo + montoTarjeta + montoTransf) > 0)

  function handleConfirm() {
    const totals = { formaPago: forma, descuento }
    if (forma === 'efectivo') {
      totals.montoEfectivo = montoEfectivo
      totals.montoRecibido = montoEfectivo
      totals.montoCambio = cambio
    } else if (forma === 'tarjeta') {
      totals.montoTarjeta = total
      totals.montoRecibido = total
    } else if (forma === 'transferencia') {
      totals.montoTransferencia = total
      totals.montoRecibido = total
    } else {
      totals.montoEfectivo = montoEfectivo
      totals.montoTarjeta = montoTarjeta
      totals.montoTransferencia = montoTransf
      totals.montoRecibido = montoEfectivo + montoTarjeta + montoTransf
    }
    totals.totalConDescuento = total - descuento
    onConfirm(totals)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: 16 }}>Cobrar — Total: <strong>{total.toLocaleString()} Gs.</strong></h3>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 6 }}>Forma de pago</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {['efectivo', 'tarjeta', 'transferencia', 'mixto'].map((f) => (
              <button key={f} className={`btn ${forma === f ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setForma(f)} style={{ fontSize: '0.8rem', padding: '8px', justifyContent: 'center' }}>
                {f === 'efectivo' ? '💵 Efectivo' : f === 'tarjeta' ? '💳 Tarjeta' : f === 'transferencia' ? '🏦 Transferencia' : '🔀 Mixto'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 6 }}>Descuento</label>
          <input type="number" className="form-input" value={descuento} onChange={(e) => setDescuento(Number(e.target.value) || 0)} min="0" />
        </div>

        {forma === 'efectivo' && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 6 }}>Monto recibido</label>
            <input type="number" className="form-input" value={montoEfectivo} onChange={(e) => setMontoEfectivo(Number(e.target.value) || 0)} min={total} autoFocus />
            {cambio > 0 && <p style={{ color: '#16a34a', fontWeight: 700, marginTop: 4 }}>Vuelto: {cambio.toLocaleString()} Gs.</p>}
          </div>
        )}

        {forma === 'mixto' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            <div><label style={{ fontSize: '0.8rem' }}>Efectivo:</label><input type="number" className="form-input" value={montoEfectivo} onChange={(e) => setMontoEfectivo(Number(e.target.value) || 0)} /></div>
            <div><label style={{ fontSize: '0.8rem' }}>Tarjeta:</label><input type="number" className="form-input" value={montoTarjeta} onChange={(e) => setMontoTarjeta(Number(e.target.value) || 0)} /></div>
            <div><label style={{ fontSize: '0.8rem' }}>Transferencia:</label><input type="number" className="form-input" value={montoTransf} onChange={(e) => setMontoTransf(Number(e.target.value) || 0)} /></div>
            {restante > 0 && <p style={{ color: '#dc2626', fontSize: '0.85rem' }}>Faltan {restante.toLocaleString()} Gs.</p>}
            {restante <= 0 && <p style={{ color: '#16a34a', fontSize: '0.85rem' }}>Completo ✓</p>}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>Cancelar</button>
          <button className="btn btn-primary" disabled={!puedePagar} onClick={handleConfirm} style={{ flex: 1, justifyContent: 'center', fontSize: '1rem' }}>
            💵 Cobrar {(total - descuento).toLocaleString()} Gs.
          </button>
        </div>
      </div>
    </div>
  )
}
