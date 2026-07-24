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
    const body = payload // dLocal envía el payment object directamente o como { event, ... }

    // Detectar origen: dLocal vs PayPal
    const isDlocal = body.id && typeof body.id === 'string' && body.id.startsWith('T-')
    const isPaypal = !!body.event_type || body.resource?.id

    if (isDlocal) {
      // Webhook de dLocal — recibe el payment object directamente
      const paymentId = body.id
      const metadata = body.x_metadata ? JSON.parse(body.x_metadata) : {}
      const companyId = metadata.company_id || body.company_id
      const plan = metadata.plan || body.plan || 'starter'
      const interval = metadata.interval || body.interval || 'month'

      // Buscar suscripción por payment_id
      let { data: sub } = await admin.from('subscriptions')
        .select('*').eq('provider_subscription_id', paymentId).maybeSingle()

      if (!sub && companyId) {
        // Si no existe, la creamos (pago sin checkout previo)
        const { data: newSub } = await admin.from('subscriptions').insert({
          company_id: companyId, plan, status: 'active', provider: 'dlocal',
          provider_subscription_id: paymentId, interval,
        }).select('id').single()
        sub = newSub ? { ...newSub, company_id: companyId, plan } : null
      }

      if (!sub) return json({ error: 'Suscripción no encontrada' }, 200)

      // Actualizar suscripción
      await admin.from('subscriptions').update({ status: 'active' }).eq('id', sub.id)

      // Actualizar plan de la compañía
      if (sub.company_id) {
        await admin.from('companies').update({ plan: sub.plan || plan }).eq('id', sub.company_id)
      }

      // Registrar factura
      await admin.from('billing_invoices').insert({
        company_id: sub.company_id,
        subscription_id: sub.id,
        provider: 'dlocal',
        provider_invoice_id: paymentId,
        amount: Number(body.amount || body.total_amount || 0),
        currency: body.currency || 'USD',
        status: 'paid',
        paid_at: new Date().toISOString(),
      }).maybeSingle()

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
