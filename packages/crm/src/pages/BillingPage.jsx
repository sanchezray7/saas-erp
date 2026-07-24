import { useState, useEffect } from 'react'
import { useAuth, Button, Skeleton, getSupabase, alertError, notify } from '@saas/core'

async function billingFetch(action, params = {}) {
  const { data, error } = await getSupabase().functions.invoke('billing', { body: { action, ...params } })
  if (error) throw new Error(error.message)
  return data
}

export function BillingPage() {
  const { activeCompanyId, user } = useAuth()
  const [plans, setPlans] = useState([])
  const [subscription, setSubscription] = useState(null)
  const [companyPlan, setCompanyPlan] = useState('free')
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState('')
  const [selectedInterval, setSelectedInterval] = useState('month')
  const [selectedProvider, setSelectedProvider] = useState('dlocal')
  const [creando, setCreando] = useState(false)

  useEffect(() => {
    if (!activeCompanyId) return
    setLoading(true)

    let verifyingTimer

    function loadData() {
      Promise.all([
        billingFetch('get-plans'),
        billingFetch('subscription-status', { company_id: activeCompanyId }),
        billingFetch('invoices', { company_id: activeCompanyId }),
        getSupabase().from('companies').select('plan').eq('id', activeCompanyId).single().then(({ data }) => data?.plan || 'free'),
      ]).then(([p, sub, inv, dbPlan]) => {
        setPlans(p || [])
        setSubscription(sub)
        setInvoices(inv || [])
        setCompanyPlan(dbPlan || 'free')
      }).catch(() => {}).finally(() => setLoading(false))
    }

    loadData()

    // Escuchar mensaje de la ventana de pago
    function handleMessage(e) {
      if (e.data === 'payment-success') {
        setVerifying(true)
        billingFetch('verify-payment', { company_id: activeCompanyId }).then((result) => {
          if (result?.status === 'activated') {
            notify(`✅ Plan ${result.plan} activado correctamente`)
            setTimeout(() => window.location.reload(), 1500)
          } else if (result?.status === 'PAID') {
            notify('Pago confirmado, activando plan...')
            setTimeout(() => window.location.reload(), 2000)
          } else if (result?.status === 'PENDING') {
            setVerifying(false)
            notify('⏳ Pago recibido, esperando confirmación')
          } else {
            setVerifying(false)
            notify('⚠️ Recargá la página para ver el estado del pago')
          }
        }).catch(() => {
          setVerifying(false)
          notify('⚠️ Error al verificar. Recargá la página.')
        })
      }
    }
    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
      clearTimeout(verifyingTimer)
    }
  }, [activeCompanyId])

  async function handleCreateCheckout() {
    if (!selectedPlan) return
    setCreando(true)
    try {
      const result = await billingFetch('create-checkout', {
        company_id: activeCompanyId, plan: selectedPlan,
        interval: selectedInterval, provider: selectedProvider,
      })
      if (result?.checkout_url) {
        // Abrir en popup centrado para mejor UX
        const w = 500, h = 700
        const left = (screen.width - w) / 2
        const top = (screen.height - h) / 2
        window.open(result.checkout_url, 'pago-dlocal',
          `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`)
      }
    } catch (err) { alertError('Error', err.message) }
    finally { setCreando(false) }
  }

  if (loading) return <Skeleton.Card />

  if (verifying) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
        <h2>Verificando tu pago...</h2>
        <p className="meta">Estamos confirmando el pago con dLocal. Esto puede tomar unos segundos.</p>
        <button onClick={() => { setVerifying(false); window.location.reload() }}
          style={{ marginTop: 16, padding: '8px 16px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', background: 'var(--color-surface)', cursor: 'pointer', fontSize: '0.85rem' }}>
          ↻ Reintentar
        </button>
      </div>
    )
  }

  const currentPlan = subscription?.plan || companyPlan

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Plan actual */}
      <div className="card">
        <div className="page-header">
          <h1>💳 Facturación</h1>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 12 }}>
          <div style={{ background: 'var(--color-surface-alt)', borderRadius: 'var(--radius)', padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>Plan actual</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 900, textTransform: 'capitalize' }}>{currentPlan}</div>
            {subscription && <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 4 }}>via {subscription.provider}</div>}
          </div>
          {subscription && (
            <>
              <div style={{ background: 'var(--color-surface-alt)', borderRadius: 'var(--radius)', padding: 16, textAlign: 'center' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>Estado</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: subscription.status === 'active' ? '#16a34a' : '#dc2626' }}>
                  {subscription.status === 'active' ? '✅ Activo' : subscription.status === 'past_due' ? '⚠️ Vencido' : '❌ ' + subscription.status}
                </div>
              </div>
              <div style={{ background: 'var(--color-surface-alt)', borderRadius: 'var(--radius)', padding: 16, textAlign: 'center' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>Próximo pago</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                  {subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : '—'}
                </div>
              </div>
            </>
          )}
          {!subscription && (
            <div style={{ gridColumn: 'span 2', ...styles.center }}>
              {companyPlan === 'free'
                ? <span className="meta">Sin suscripción activa</span>
                : <span style={{ fontSize: '0.9rem' }}>Plan <strong style={{ textTransform: 'capitalize' }}>{companyPlan}</strong> · Sin suscripción recurrente</span>
              }
            </div>
          )}
        </div>

        {subscription?.status === 'active' && (
          <div style={{ marginTop: 16 }}>
            <Button variant="ghost" onClick={async () => {
              if (!window.confirm('¿Cancelar la suscripción? Volverás al plan Free.')) return
              try {
                await billingFetch('cancel', {
                  company_id: activeCompanyId,
                  subscription_id: subscription.provider_subscription_id,
                  provider: subscription.provider,
                })
                notify('Suscripción cancelada')
                window.location.reload()
              } catch (err) { alertError('Error', err.message) }
            }} style={{ color: '#dc2626' }}>Cancelar suscripción</Button>
          </div>
        )}
      </div>

      {/* Planes disponibles (siempre visibles) */}
      <div className="card">
        <h3 style={{ marginBottom: 16 }}>
          {subscription?.status === 'active' ? '📊 Cambiar de plan' : '📊 Elegí tu plan'}
        </h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="radio" checked={selectedInterval === 'month'} onChange={() => setSelectedInterval('month')} /> Mensual
          </label>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="radio" checked={selectedInterval === 'year'} onChange={() => setSelectedInterval('year')} /> Anual (11 meses)
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {['starter', 'business'].map((planKey) => {
            const price = plans.find((p) => p.plan === planKey && p.interval === selectedInterval)
            const monthly = plans.find((p) => p.plan === planKey && p.interval === 'month')
            const isSelected = selectedPlan === planKey
            const isCurrent = (subscription?.plan === planKey && subscription?.status === 'active') || (!subscription && companyPlan === planKey)
            const ahorro = selectedInterval === 'year' && monthly ? Math.round((monthly.amount * 12) - price?.amount) : 0
            return (
              <div key={planKey} onClick={() => !isCurrent && setSelectedPlan(planKey)}
                style={{
                  border: `2px solid ${isCurrent ? '#16a34a' : isSelected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  borderRadius: 'var(--radius-lg)', padding: 20, cursor: isCurrent ? 'default' : 'pointer',
                  background: isCurrent ? '#f0fdf4' : isSelected ? 'var(--color-accent-soft)' : 'var(--color-surface)',
                  transition: 'border-color 0.15s', opacity: isCurrent ? 0.7 : 1,
                }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, textTransform: 'capitalize', marginBottom: 4 }}>
                  {planKey} {isCurrent && '✅'}
                </div>
                {price && (
                  <div>
                    <span style={{ fontSize: '1.4rem', fontWeight: 900 }}>${Number(price.amount).toLocaleString()}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>/{selectedInterval === 'year' ? 'año' : 'mes'}</span>
                  </div>
                )}
                {ahorro > 0 && <div style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 600, marginTop: 4 }}>Ahorrás ${ahorro}</div>}
                {isCurrent && <div style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: 4 }}>Plan actual</div>}
              </div>
            )
          })}
        </div>

        {selectedPlan && selectedPlan !== subscription?.plan && (
          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 8, display: 'block' }}>Método de pago</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <label style={{ ...styles.radioBtn, borderColor: selectedProvider === 'dlocal' ? 'var(--color-accent)' : 'var(--color-border)' }}>
                <input type="radio" checked={selectedProvider === 'dlocal'} onChange={() => setSelectedProvider('dlocal')} style={{ marginRight: 6 }} /> 💳 Tarjeta (dLocal)
              </label>
              <label style={{ ...styles.radioBtn, borderColor: selectedProvider === 'paypal' ? 'var(--color-accent)' : 'var(--color-border)' }}>
                <input type="radio" checked={selectedProvider === 'paypal'} onChange={() => setSelectedProvider('paypal')} style={{ marginRight: 6 }} /> 🅿️ PayPal
              </label>
            </div>
            <Button onClick={handleCreateCheckout} disabled={creando} className="w-full">
              {creando ? 'Preparando pago...' : subscription?.status === 'active' ? '⬆️ Cambiar a este plan' : '💳 Ir a pagar'}
            </Button>
          </div>
        )}
      </div>

      {/* Historial de facturas */}
      {invoices.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>📄 Historial de pagos</h3>
          <table className="table" style={{ fontSize: '0.82rem' }}>
            <thead><tr><th>Fecha</th><th>Plan</th><th>Monto</th><th>Estado</th><th>Proveedor</th></tr></thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="meta">{new Date(inv.paid_at).toLocaleDateString()}</td>
                  <td style={{ textTransform: 'capitalize' }}>{inv.plan || '—'}</td>
                  <td style={{ fontWeight: 700 }}>${Number(inv.amount).toLocaleString()} {inv.currency}</td>
                  <td>{inv.status === 'paid' ? '✅ Pagado' : inv.status === 'refunded' ? '🔄 Reembolsado' : '❌ ' + inv.status}</td>
                  <td className="meta">{inv.provider === 'dlocal' ? '💳 dLocal' : '🅿️ PayPal'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const styles = {
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
  radioBtn: {
    display: 'flex', alignItems: 'center', padding: '8px 14px',
    border: '2px solid var(--color-border)', borderRadius: 'var(--radius)',
    cursor: 'pointer', fontSize: '0.85rem',
  },
}
