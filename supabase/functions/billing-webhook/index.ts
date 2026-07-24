import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  try {
    const payload = await req.json()
    const event = payload.event || payload.event_type || ''
    const isDlocal = event.startsWith('EVT_')
    const isPaypal = !!payload.resource?.id || !!payload.create_time

    if (isDlocal) {
      // Webhook de dLocal
      console.log('dLocal event:', event, JSON.stringify(payload).slice(0, 500))

      const subId = payload.subscription_id || payload.id
      const companyId = payload.company_id // lo enviamos como metadata personalizada

      switch (event) {
        case 'EVT_PAYMENT_SUCCEEDED':
        case 'EVT_SUBSCRIPTION_CREATED': {
          // Buscar la suscripción por provider_subscription_id
          const { data: sub } = await admin.from('subscriptions')
            .select('*, company:company_id(plan)')
            .eq('provider_subscription_id', subId)
            .maybeSingle()
          if (!sub) return json({ error: 'Suscripción no encontrada' }, 404)

          // Actualizar suscripción
          await admin.from('subscriptions').update({
            status: 'active',
            plan: sub.plan,
            current_period_start: payload.created_at ? new Date(payload.created_at).toISOString() : new Date().toISOString(),
          }).eq('id', sub.id)

          // Actualizar plan de la compañía
          await admin.from('companies').update({ plan: sub.plan }).eq('id', sub.company_id)

          // Registrar factura
          await admin.from('billing_invoices').insert({
            company_id: sub.company_id,
            subscription_id: sub.id,
            provider: 'dlocal',
            provider_invoice_id: payload.id || payload.payment_id,
            amount: payload.amount?.total || payload.amount || 0,
            currency: payload.currency || 'USD',
            status: 'paid',
            paid_at: new Date().toISOString(),
          }).maybeSingle()
          break
        }

        case 'EVT_SUBSCRIPTION_CANCELLED': {
          await admin.from('subscriptions').update({
            status: 'canceled', canceled_at: new Date().toISOString(),
          }).eq('provider_subscription_id', subId)

          const { data: sub } = await admin.from('subscriptions').select('company_id').eq('provider_subscription_id', subId).single()
          if (sub) await admin.from('companies').update({ plan: 'free' }).eq('id', sub.company_id)
          break
        }

        case 'EVT_PAYMENT_FAILED': {
          await admin.from('subscriptions').update({ status: 'past_due' }).eq('provider_subscription_id', subId)
          break
        }
      }

      return json({ received: true })
    }

    if (isPaypal) {
      // Webhook de PayPal
      console.log('PayPal event:', event, JSON.stringify(payload).slice(0, 500))

      const resource = payload.resource || {}
      const subId = resource.id || resource.subscription_id || payload.id

      switch (payload.event_type) {
        case 'PAYMENT.SALE.COMPLETED':
        case 'BILLING.SUBSCRIPTION.ACTIVATED': {
          const { data: sub } = await admin.from('subscriptions')
            .select('*').eq('provider_subscription_id', subId).maybeSingle()
          if (!sub) return json({ error: 'Suscripción no encontrada' }, 404)

          await admin.from('subscriptions').update({
            status: 'active',
            plan: sub.plan,
            current_period_start: resource.create_time ? new Date(resource.create_time).toISOString() : new Date().toISOString(),
          }).eq('id', sub.id)

          await admin.from('companies').update({ plan: sub.plan }).eq('id', sub.company_id)

          await admin.from('billing_invoices').insert({
            company_id: sub.company_id,
            subscription_id: sub.id,
            provider: 'paypal',
            provider_invoice_id: resource.id || resource.billing_agreement_id,
            amount: Number(resource.amount?.total || resource.amount?.value || 0),
            currency: resource.amount?.currency || 'USD',
            status: 'paid',
            paid_at: new Date().toISOString(),
          }).maybeSingle()
          break
        }

        case 'BILLING.SUBSCRIPTION.CANCELLED': {
          await admin.from('subscriptions').update({
            status: 'canceled', canceled_at: new Date().toISOString(),
          }).eq('provider_subscription_id', subId)

          const { data: sub } = await admin.from('subscriptions').select('company_id').eq('provider_subscription_id', subId).single()
          if (sub) await admin.from('companies').update({ plan: 'free' }).eq('id', sub.company_id)
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

    return json({ error: 'Evento desconocido' }, 400)
  } catch (err) {
    console.error('Webhook error:', err.message)
    return json({ error: err.message }, 500)
  }
})
