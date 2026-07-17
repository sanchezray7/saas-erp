import { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth, Button, Skeleton, ConfirmModal, alertError, notify, MONEDA_POR_PAIS } from '@saas/core'
import { listarProductos, eliminarProducto, importarProductos } from '../data/productos'
import { ProductoFormModal } from '../components/ProductoFormModal'
import { listarStockGeneral } from '@saas/inventario'

export function CatalogPage() {
  const { t } = useTranslation()
  const { activeCompanyId } = useAuth()
  const [productos, setProductos] = useState([])
  const [stockMap, setStockMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const [data, stock] = await Promise.all([
        listarProductos(activeCompanyId, false),
        listarStockGeneral(activeCompanyId).catch(() => []),
      ])
      setProductos(data)
      const map = {}
      stock.forEach((s) => {
        const pid = s.producto_id
        if (!map[pid]) map[pid] = { total: 0, minimo: Number(s.stock_minimo) || Number(s.producto?.stock_minimo) || 0 }
        map[pid].total += Number(s.cantidad)
      })
      setStockMap(map)
    } catch (err) {
      alertError('Error', err.message)
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId])

  useEffect(() => { load() }, [load])

  async function handleDelete(id) {
    try {
      await eliminarProducto(id)
      notify(t('common.eliminado'))
      setDeleting(null)
      load()
    } catch (err) {
      alertError('Error', err.message)
    }
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const text = await file.text()
      const Papa = (await import('papaparse')).default
      const { data, errors } = Papa.parse(text, { header: true, skipEmptyLines: true })
      if (errors.length > 0) throw new Error(errors[0].message)
      if (data.length === 0) throw new Error('El archivo está vacío')
      await importarProductos(activeCompanyId, data)
      notify(`${data.length} producto(s) importado(s)`)
      load()
    } catch (err) {
      alertError('Error al importar', err.message)
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleExport() {
    const Papa = (await import('papaparse')).default
    const data = productos.map((p) => ({
      nombre: p.nombre,
      codigo: p.codigo || '',
      tipo: p.tipo || 'producto',
      descripcion: p.descripcion || '',
                precio_venta: p.precio_venta,
      moneda: p.moneda || 'PYG',
      unidad_medida: p.unidad_medida || 'UNI',
    }))
    const csv = Papa.unparse(data)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'productos.csv'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const filtered = productos.filter((p) => {
    if (!search) return true
    const q = search.toLowerCase()
    return p.nombre?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q) || p.codigo_barras?.toLowerCase().includes(q)
  })

  if (loading) return <Skeleton.Card />

  return (
    <div className="card">
      <div className="page-header">
        <h1>{t('productos.titulo')}</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <input type="file" accept=".csv,.xlsx,.xls" ref={fileRef} onChange={handleImportFile} style={{ display: 'none' }} />
          <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()} disabled={importing}>{importing ? 'Importando...' : t('common.importar')}</Button>
          <Button size="sm" variant="ghost" onClick={handleExport}>{t('common.exportar')}</Button>
          <Button size="sm" onClick={() => setModal({})}>+ {t('productos.nuevo')}</Button>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input type="search" placeholder={t('productos.buscar')} className="form-input" style={{ width: '100%', maxWidth: 320 }} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div style={{ overflowX: 'auto' }}>
      <table className="table">
        <thead>
          <tr>
            <th>{t('productos.codigo')}</th>
            <th>{t('productos.tipo')}</th>
            <th>{t('productos.nombre')}</th>
            <th>{t('productos.descripcion')}</th>
            <th style={{ textAlign: 'right' }}>Precio Venta</th>
            <th style={{ textAlign: 'right' }}>Precio Compra</th>
            <th>Cód. Barras</th>
            <th>{t('productos.unidad')}</th>
            <th style={{ width: 80, textAlign: 'right' }}>Stock</th>
            <th>{t('productos.estado')}</th>
            <th style={{ width: 120 }}>{t('common.acciones')}</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={11} className="meta" style={{ textAlign: 'center', padding: 32 }}>
                {t('common.sinDatos')}
              </td>
            </tr>
          ) : filtered.map((p) => (
            <tr key={p.id} style={{ opacity: p.activo ? 1 : 0.5 }}>
              <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{p.codigo || '—'}</td>
              <td><span className="badge" style={{ fontSize: '0.7rem', background: p.tipo === 'servicio' ? '#ede9fe' : '#dbeafe', color: p.tipo === 'servicio' ? '#7c3aed' : '#1d4ed8' }}>{p.tipo === 'servicio' ? 'SER' : 'PRO'}</span></td>
              <td style={{ fontWeight: 600 }}>{p.nombre}</td>
              <td className="meta">{p.descripcion || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{Number(p.precio_venta).toLocaleString()} {p.moneda || 'PYG'}</td>
                    <td style={{ textAlign: 'right' }}>{Number(p.precio_compra).toLocaleString()} {p.moneda || 'PYG'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{p.codigo_barras || '—'}</td>
                    <td>{p.unidad_medida || 'UNI'}</td>
              <td style={{ textAlign: 'right', fontWeight: 700 }}>
                {(() => {
                  const s = stockMap[p.id]
                  if (!s || s.total === 0) return <span className="meta" style={{ fontSize: '0.78rem' }}>—</span>
                  const pct = s.minimo > 0 ? (s.total / s.minimo) * 100 : 100
                  const color = pct >= 100 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626'
                  return <span style={{ color }}>{Math.round(s.total)}</span>
                })()}
              </td>
              <td>{p.activo ? <span className="badge">{t('productos.activo')}</span> : <span className="badge" style={{ background: 'var(--color-border)', color: 'var(--color-text-muted)' }}>{t('productos.inactivo')}</span>}</td>
              <td>
                <div style={{ display: 'flex', gap: 4 }}>
                  <Button size="xs" variant="ghost" onClick={() => setModal(p)}>{t('common.editar')}</Button>
                  {p.activo && <Button size="xs" danger onClick={() => setDeleting(p.id)}>{t('common.eliminar')}</Button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {modal && (
        <ProductoFormModal
          producto={modal?.id ? modal : null}
          companyId={activeCompanyId}
          productos={productos}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}

      {deleting && (
        <ConfirmModal
          title={t('productos.eliminar')}
          onConfirm={() => handleDelete(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
