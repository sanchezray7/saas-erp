import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth, Button, FormField, Skeleton, alertError, notify } from '@saas/core'
import { listarAccounts } from '../data/accounts'
import { crearConciliacion } from '../data/conciliacion'

export function ConciliacionNuevaPage() {
  const navigate = useNavigate()
  const { activeCompanyId } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    account_id: '', periodo_inicio: '', periodo_fin: '',
    saldo_inicial: '', saldo_final: '',
    saldo_inicial_libro: '',
  })

  useEffect(() => {
    listarAccounts(activeCompanyId).then((a) => {
      setAccounts(a.filter((acc) => acc.code?.startsWith('1.1.1') || acc.code?.startsWith('1.1.2')))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [activeCompanyId])

  async function handleSubmit() {
    if (!form.account_id) { alertError('Error', 'Seleccioná una cuenta bancaria'); return }
    if (!form.periodo_inicio || !form.periodo_fin) { alertError('Error', 'Completá el período'); return }
    setSubmitting(true)
    try {
      const id = await crearConciliacion(activeCompanyId, form)
      notify('Conciliación creada. Cargá el extracto bancario.')
      navigate(`/conciliacion/${id}`)
    } catch (err) { alertError('Error', err.message) }
    finally { setSubmitting(false) }
  }

  if (loading) return <Skeleton.Card />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <h1>🏦 Nueva conciliación</h1>
          <Link to="/conciliacion"><Button variant="ghost" size="sm">Volver</Button></Link>
        </div>
        <form onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16, maxWidth: 500 }}>
          <FormField label="Cuenta bancaria" as="select" value={form.account_id} onChange={(e) => setForm((prev) => ({ ...prev, account_id: e.target.value }))}>
            <option value="">— Seleccionar —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} - {a.banco_nombre || a.name} {a.numero_cuenta ? `(${a.numero_cuenta})` : ''}
              </option>
            ))}
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Período inicio" type="date" value={form.periodo_inicio} onChange={(e) => setForm((prev) => ({ ...prev, periodo_inicio: e.target.value }))} required />
            <FormField label="Período fin" type="date" value={form.periodo_fin} onChange={(e) => setForm((prev) => ({ ...prev, periodo_fin: e.target.value }))} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Saldo inicial (extracto)" type="number" step="0.01" value={form.saldo_inicial} onChange={(e) => setForm((prev) => ({ ...prev, saldo_inicial: e.target.value }))} hint="Saldo inicial según el extracto del banco" />
            <FormField label="Saldo final (extracto)" type="number" step="0.01" value={form.saldo_final} onChange={(e) => setForm((prev) => ({ ...prev, saldo_final: e.target.value }))} hint="Saldo final según el extracto del banco" />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="submit" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Creando...' : '💾 Crear conciliación'}
            </Button>
            <Link to="/conciliacion"><Button variant="ghost">Cancelar</Button></Link>
          </div>
        </form>
      </div>
    </div>
  )
}
