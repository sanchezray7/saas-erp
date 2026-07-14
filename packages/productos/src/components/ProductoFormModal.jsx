import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth, Button, FormField, alertError, notify, MONEDA_POR_PAIS } from '@saas/core'
import { guardarProducto } from '../data/productos'
import { listarUnidadesMedida } from '../data/unidades'
import { listarAccounts } from '@saas/accounting'

function generarCodigo(tipo, items) {
  const prefix = tipo === 'servicio' ? 'SER' : 'PRO'
  const existentes = items.filter(p => p.tipo === tipo && p.codigo?.startsWith(prefix))
  const numeros = existentes.map(p => parseInt(p.codigo.replace(prefix + '-', ''), 10)).filter(n => !isNaN(n))
  const next = numeros.length > 0 ? Math.max(...numeros) + 1 : 1
  return `${prefix}-${String(next).padStart(4, '0')}`
}

export function ProductoFormModal({ producto, companyId, productos, onClose, onSaved }) {
  const { t } = useTranslation()
  const { pais } = useAuth()
  const isEdit = Boolean(producto?.id)
  const [submitting, setSubmitting] = useState(false)
  const [unidades, setUnidades] = useState([])
  const [accounts, setAccounts] = useState([])
  const [form, setForm] = useState({
    nombre: '',
    codigo: '',
    tipo: 'producto',
    descripcion: '',
    precio_unitario: '',
    moneda: MONEDA_POR_PAIS[pais] || 'PYG',
    unidad_medida: 'UNI',
    account_compra_id: '',
    account_venta_id: '',
    stock_minimo: '',
    codigo_barras: '',
  })

  useEffect(() => {
    Promise.all([listarUnidadesMedida(), listarAccounts(companyId)]).then(([u, a]) => {
      setUnidades(u)
      setAccounts(a)
    }).catch(() => {})
    if (producto) {
      setForm({
        nombre: producto.nombre || '',
        codigo: producto.codigo || '',
        tipo: producto.tipo || 'producto',
        descripcion: producto.descripcion || '',
        precio_unitario: producto.precio_unitario?.toString() || '',
        moneda: producto.moneda || MONEDA_POR_PAIS[pais] || 'PYG',
        unidad_medida: producto.unidad_medida || 'UNI',
        account_compra_id: producto.account_compra_id || '',
        account_venta_id: producto.account_venta_id || '',
        stock_minimo: producto.stock_minimo?.toString() || '',
        codigo_barras: producto.codigo_barras || '',
      })
    } else {
      setForm((prev) => ({
        ...prev,
        codigo: generarCodigo('producto', productos),
      }))
    }
  }, [producto, productos, companyId])

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleTipoChange(tipo) {
    setForm((prev) => ({
      ...prev,
      tipo,
      codigo: !isEdit ? generarCodigo(tipo, productos) : prev.codigo,
    }))
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.nombre.trim()) return
    setSubmitting(true)
    try {
      await guardarProducto(companyId, {
        id: isEdit ? producto.id : null,
        nombre: form.nombre.trim(),
        codigo: form.codigo.trim() || null,
        tipo: form.tipo,
        descripcion: form.descripcion.trim() || null,
        precio_unitario: Number(form.precio_unitario) || 0,
        moneda: form.moneda || 'PYG',
        unidad_medida: form.unidad_medida || 'UNI',
        cod_unidad: (unidades.find((u) => u.sigla === form.unidad_medida)?.codigo) || 77,
        account_compra_id: form.account_compra_id || null,
        account_venta_id: form.account_venta_id || null,
        stock_minimo: Number(form.stock_minimo) || 0,
        codigo_barras: form.codigo_barras?.trim() || null,
      })
      notify(isEdit ? t('common.actualizado') : t('common.guardado'))
      onSaved()
      onClose()
    } catch (err) {
      alertError('Error', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.4)',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--color-surface)', borderRadius: 12,
        padding: 24, width: '100%', maxWidth: 520,
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        maxHeight: '90vh', overflow: 'auto',
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>
            {isEdit ? t('productos.editar') : t('productos.nuevo')}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--color-text-muted)' }}>✕</button>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label={t('productos.tipo')} as="select" value={form.tipo} onChange={(e) => handleTipoChange(e.target.value)}>
              <option value="producto">📦 {t('productos.producto')}</option>
              <option value="servicio">🔧 {t('productos.servicio')}</option>
            </FormField>
            <FormField label={t('productos.codigo')} value={form.codigo} onChange={(e) => set('codigo', e.target.value)} />
          </div>
          <FormField label={t('productos.nombre')} required value={form.nombre} onChange={(e) => set('nombre', e.target.value)} autoFocus />
          <FormField label={t('productos.descripcion')} as="textarea" rows={2} value={form.descripcion} onChange={(e) => set('descripcion', e.target.value)} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label={t('productos.precioUnitario')} type="number" min="0" step="1" value={form.precio_unitario} onChange={(e) => set('precio_unitario', e.target.value)} />
            <FormField label={t('productos.moneda')} as="select" value={form.moneda} onChange={(e) => set('moneda', e.target.value)}>
              <option value="PYG">Gs. (PYG)</option>
              <option value="USD">$ (USD)</option>
              <option value="ARS">$ (ARS)</option>
              <option value="BRL">R$ (BRL)</option>
              <option value="CLP">$ (CLP)</option>
              <option value="COP">$ (COP)</option>
              <option value="PEN">S/ (PEN)</option>
              <option value="MXN">$ (MXN)</option>
            </FormField>
          </div>
          <FormField label={t('productos.unidadMedida')} as="select" value={form.unidad_medida} onChange={(e) => set('unidad_medida', e.target.value)}>
            {unidades.map((u) => <option key={u.codigo} value={u.sigla}>{u.sigla} — {u.nombre}</option>)}
          </FormField>

          {/* Cuentas contables */}
          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: '0 0 8px' }}>📒 Cuentas contables</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label="Cuenta de compra (gasto)" as="select" value={form.account_compra_id} onChange={(e) => set('account_compra_id', e.target.value)}>
                <option value="">— Por defecto —</option>
                {accounts.filter((a) => a.type === 'gasto' || a.type === 'activo').map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
              </FormField>
              <FormField label="Cuenta de venta (ingreso)" as="select" value={form.account_venta_id} onChange={(e) => set('account_venta_id', e.target.value)}>
                <option value="">— Por defecto —</option>
                {accounts.filter((a) => a.type === 'ingreso').map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
              </FormField>
            </div>
          </div>

          {/* Stock */}
          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: '0 0 8px' }}>📦 Stock</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label="Stock mínimo de alerta" type="number" min="0" value={form.stock_minimo} onChange={(e) => set('stock_minimo', e.target.value)} placeholder="0" hint="Cuando el stock baje de este valor, aparecerá una alerta en el inventario" />
              <FormField label="Código de barras" value={form.codigo_barras} onChange={(e) => set('codigo_barras', e.target.value)} placeholder="Ej: 5901234567890" hint="Escaneá con lector o ingresá manualmente" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Button variant="ghost" size="sm" onClick={onClose}>{t('common.cancelar')}</Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? t('common.guardando') : (isEdit ? t('common.guardar') : t('productos.crear'))}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
