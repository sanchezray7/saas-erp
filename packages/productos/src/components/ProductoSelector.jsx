import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@saas/core'
import { listarProductos } from '../data/productos'

export function ProductoSelector({ companyId, onSelect, onClose }) {
  const { t } = useTranslation()
  const [productos, setProductos] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listarProductos(companyId)
      .then(setProductos)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [companyId])

  const filtered = productos.filter((p) => {
    if (!search) return true
    const q = search.toLowerCase()
    return p.nombre?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q)
  })

  function handleConfirm() {
    if (!selected) return
    onSelect({
      descripcion: selected.nombre,
      cantidad: 1,
      precio_unitario: Number(selected.precio_venta),
      codigoInterno: selected.codigo || undefined,
      unidadMedida: selected.unidad_medida,
      account_venta_id: selected.account_venta_id || '',
      iva_id: selected.iva_id || '',
      producto_id: selected.id || '',
    })
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.4)',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--color-surface)', borderRadius: 12,
        padding: 24, width: '100%', maxWidth: 480,
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>📦 {t('productos.seleccionar')}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--color-text-muted)' }}>✕</button>
        </div>

        <input type="search" placeholder={t('common.buscar')} className="form-input" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%', marginBottom: 12 }} autoFocus />

        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {loading ? (
            <p className="meta" style={{ textAlign: 'center', padding: 20 }}>{t('common.cargando')}</p>
          ) : filtered.length === 0 ? (
            <p className="meta" style={{ textAlign: 'center', padding: 20 }}>{t('common.sinDatos')}</p>
          ) : filtered.map((p) => (
            <div
              key={p.id}
              onClick={() => setSelected(p)}
              style={{
                padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${selected?.id === p.id ? 'var(--color-accent)' : 'var(--color-border)'}`,
                background: selected?.id === p.id ? 'var(--color-accent-soft)' : 'var(--color-surface)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                transition: 'all 0.15s',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="badge" style={{ fontSize: '0.65rem', background: p.tipo === 'servicio' ? '#ede9fe' : '#dbeafe', color: p.tipo === 'servicio' ? '#7c3aed' : '#1d4ed8' }}>{p.tipo === 'servicio' ? 'SER' : 'PRO'}</span>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{p.nombre}</span>
                </div>
                {p.descripcion && <div className="meta" style={{ fontSize: '0.75rem' }}>{p.descripcion}</div>}
                {p.codigo && <div className="meta" style={{ fontSize: '0.72rem' }}>{p.codigo}</div>}
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', whiteSpace: 'nowrap', marginLeft: 12 }}>
                {Number(p.precio_unitario).toLocaleString()} {p.moneda || 'PYG'}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16, borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
          <Button variant="ghost" size="sm" onClick={onClose}>{t('common.cancelar')}</Button>
          <Button size="sm" onClick={handleConfirm} disabled={!selected}>
            {t('productos.agregarACotizacion')}
          </Button>
        </div>
      </div>
    </div>
  )
}
