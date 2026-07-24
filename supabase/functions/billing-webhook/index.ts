import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

// dLocal API client (misma auth que billing EF)
const DLOCAL_API = Deno.env.get('DLOCAL_ENV') === 'production'
  ? 'https://api.dlocalgo.com/v1'
  : 'https://api-sbx.dlocalgo.com/v1'
const DLOCAL_TOKEN = `${Deno.env.get('DLOCAL_API_KEY')}:${Deno.env.get('DLOCAL_SECRET')}`

async function dlocalGet(path: string) {
  const res = await fetch(`${DLOCAL_API}${path}`, {
    headers: { Authorization: `Bearer ${DLOCAL_TOKEN}`, 'Content-Type': 'application/json' },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`dLocal error ${res.status}: ${text.slice(0, 200)}`)
  return JSON.parse(text)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  try {
    const body = await req.json()

    // === dLocal: envía { "payment_id": "DP-XXX" } ===
    if (body.payment_id) {
      const paymentId = body.payment_id

      // Consultar estado del pago a dLocal
      const payment = await dlocalGet(`/payments/${paymentId}`)

      // Determinar si es un pago de suscripción por order_id
      const orderId: string = payment.order_id || ''
      const isSubscriptionPayment = orderId.startsWith('ST-')

      if (isSubscriptionPayment) {
        // Es un cobro recurrente de suscripción
        // order_id formato: ST-{subscription_token}-{N}
        const token = orderId.split('-')[1]
        if (!token) return json({ error: 'token no encontrado' }, 200)

        // Buscar subscription por provider_plan_token
        const { data: subs } = await admin.from('subscriptions')
          .select('*').eq('provider_plan_token', token).maybeSingle()

        if (subs && payment.status === 'PAID') {
          await admin.from('billing_invoices').insert({
            company_id: subs.company_id, subscription_id: subs.id,
            provider: 'dlocal', provider_invoice_id: paymentId,
            amount: Number(payment.amount || 0), currency: payment.currency || 'USD',
            status: 'paid', paid_at: payment.approved_date || new Date().toISOString(),
          }).maybeSingle()
        }
        return json({ received: true, is_subscription: true })
      }

      // Pago único (flujo legacy) - intentar parsear order_id anterior
      const parts = orderId.split('_')
      const rawId = parts[0] || ''
      const companyId = rawId.length === 32
        ? `${rawId.slice(0,8)}-${rawId.slice(8,12)}-${rawId.slice(12,16)}-${rawId.slice(16,20)}-${rawId.slice(20)}`
        : rawId
      const plan = parts[1] || 'starter'
      const interval = parts[2] || 'month'

      if (!companyId) return json({ error: 'order_id inválido' }, 200)

      let { data: sub } = await admin.from('subscriptions')
        .select('*').eq('provider_subscription_id', paymentId).maybeSingle()

      if (!sub) {
        const { data: newSub } = await admin.from('subscriptions').insert({
          company_id: companyId, plan, status: 'active', provider: 'dlocal',
          provider_subscription_id: paymentId, interval,
        }).select('id').single()
        sub = newSub ? { id: newSub.id, company_id: companyId, plan } : null
      }

      if (sub && payment.status === 'PAID') {
        await admin.from('subscriptions').update({
          status: 'active', current_period_start: payment.approved_date || new Date().toISOString(),
        }).eq('id', sub.id)
        await admin.from('companies').update({ plan }).eq('id', companyId)
        await admin.from('companies').update({ plan }).eq('parent_company_id', companyId)
        await admin.from('billing_invoices').insert({
          company_id: companyId, subscription_id: sub.id,
          provider: 'dlocal', provider_invoice_id: paymentId,
          amount: Number(payment.amount || 0), currency: payment.currency || 'USD',
          status: 'paid', paid_at: payment.approved_date || new Date().toISOString(),
        }).maybeSingle()
      }

      return json({ received: true, status: payment.status })
    }

    // === PayPal: eventos con event_type ===
    if (body.event_type) {
      const resource = body.resource || {}
      const subId = resource.id || resource.subscription_id || body.id

      switch (body.event_type) {
        case 'PAYMENT.SALE.COMPLETED':
        case 'BILLING.SUBSCRIPTION.ACTIVATED': {
          const { data: sub } = await admin.from('subscriptions')
            .select('*').eq('provider_subscription_id', subId).maybeSingle()
          if (!sub) return json({ error: 'Suscripción no encontrada' }, 200)

          await admin.from('subscriptions').update({
            status: 'active',
            current_period_start: resource.create_time ? new Date(resource.create_time).toISOString() : new Date().toISOString(),
          }).eq('id', sub.id)

          await admin.from('companies').update({ plan: sub.plan }).eq('id', sub.company_id)
          await admin.from('companies').update({ plan: sub.plan }).eq('parent_company_id', sub.company_id)

          await admin.from('billing_invoices').insert({
            company_id: sub.company_id, subscription_id: sub.id,
            provider: 'paypal',
            provider_invoice_id: resource.id || resource.billing_agreement_id,
            amount: Number(resource.amount?.total || resource.amount?.value || 0),
            currency: resource.amount?.currency || 'USD',
            status: 'paid', paid_at: new Date().toISOString(),
          }).maybeSingle()
          break
        }

        case 'BILLING.SUBSCRIPTION.CANCELLED': {
          const { data: sub } = await admin.from('subscriptions').select('company_id').eq('provider_subscription_id', subId).single()
          if (sub) {
            await admin.from('subscriptions').update({ status: 'canceled', canceled_at: new Date().toISOString() }).eq('id', sub.id)
            await admin.from('companies').update({ plan: 'free' }).eq('id', sub.company_id)
            await admin.from('companies').update({ plan: 'free' }).eq('parent_company_id', sub.company_id)
          }
          break
        }

        case 'PAYMENT.SALE.DENIED':
        case 'PAYMENT.SALE.REFUNDED': {
          await admin.from('subscriptions').update({ status: 'past_due' }).eq('provider_subscription_id', subId)
          break
        }
      }

      return json({ received: true })
    }

    return json({ error: 'Formato de evento no reconocido' }, 200)
  } catch (err) {
    console.error('Webhook error:', err.message)
    return json({ error: err.message }, 500)
  }
})
