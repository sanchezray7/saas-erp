import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const DLOCAL_API = Deno.env.get('DLOCAL_ENV') === 'production'
  ? 'https://api.dlocalgo.com/v1'
  : 'https://api-sbx.dlocalgo.com/v1'

const DLOCAL_API_KEY = Deno.env.get('DLOCAL_API_KEY')!
const DLOCAL_SECRET = Deno.env.get('DLOCAL_SECRET')!

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

async function dlocalRequest(path: string, method = 'GET', body?: unknown) {
  const res = await fetch(`${DLOCAL_API}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${DLOCAL_API_KEY}:${DLOCAL_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`dLocal error ${res.status}: ${text.slice(0, 300)}`)
  try { return JSON.parse(text) } catch { return text }
}

async function getPayPalAccessToken(): Promise<string> {
  const clientId = Deno.env.get('PAYPAL_CLIENT_ID')!
  const secret = Deno.env.get('PAYPAL_SECRET')!
  const base = Deno.env.get('PAYPAL_ENV') === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com'
  const auth = btoa(String.fromCharCode(...new TextEncoder().encode(`${clientId}:${secret}`)))
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || 'PayPal auth error')
  return data.access_token
}

async function paypalRequest(path: string, method = 'GET', body?: unknown) {
  const token = await getPayPalAccessToken()
  const base = Deno.env.get('PAYPAL_ENV') === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com'
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || data.error_description || `PayPal error: ${res.status}`)
  return data
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  let body: any
  try { body = await req.json() } catch { return json({ error: 'JSON inválido' }, 400) }

  try {
    const { action, provider, company_id, plan, interval, subscription_id } = body

    switch (action) {
      // === OBTENER PLANES CON PRECIOS ===
      case 'get-plans': {
        const { data } = await admin.from('plan_prices').select('*').eq('active', true).order('amount')
        return json(data || [])
      }

      // === CREAR CHECKOUT (dLocal o PayPal) ===
      case 'create-checkout': {
        if (!company_id || !plan || !provider) return json({ error: 'Faltan datos' }, 400)

        const { data: price } = await admin.from('plan_prices').select('*')
          .match({ plan, interval: interval || 'month', active: true }).single()
        if (!price) return json({ error: 'Plan no encontrado' }, 404)

        const baseUrl = Deno.env.get('PUBLIC_APP_URL') || 'http://localhost:5173'
        const webhookUrl = `${supabaseUrl}/functions/v1/billing-webhook`
        const successUrl = `${baseUrl}/payment/success`
        const cancelUrl = `${baseUrl}/settings/billing?canceled=true`
        const description = `Saas Empresarial - ${plan}${interval === 'year' ? ' Anual' : ''}`

        if (provider === 'dlocal') {
          // Crear un plan de suscripción en dLocal (cobro recurrente automático)
          const planBody = {
            name: description.slice(0, 50),
            description: description.slice(0, 100),
            currency: price.currency || 'USD',
            amount: Number(price.amount),
            frequency_type: interval === 'year' ? 'YEARLY' : 'MONTHLY',
            frequency_value: 1,
            notification_url: webhookUrl,
            success_url: successUrl,
            back_url: cancelUrl,
          }

          const planResult = await dlocalRequest('/subscription/plan', 'POST', planBody)

          // Guardar el plan de dLocal en nuestra BD
          await admin.from('subscriptions').insert({
            company_id, plan, status: 'trialing', provider: 'dlocal',
            provider_subscription_id: String(planResult.id),
            interval: interval || 'month',
          }).maybeSingle()

          return json({ checkout_url: planResult.subscribe_url, id: String(planResult.id) })
        }

        if (provider === 'paypal') {
          // Crear una orden de pago única vía PayPal Orders API
          const orderPayload = {
            intent: 'CAPTURE',
            purchase_units: [{
              reference_id: `${company_id.slice(0, 8)}-${Date.now()}`,
              description: `Saas Empresarial - Plan ${plan}${interval === 'year' ? ' Anual' : ''}`,
              amount: {
                currency_code: 'USD',
                value: String(Number(price.amount).toFixed(2)),
                breakdown: { item_total: { currency_code: 'USD', value: String(Number(price.amount).toFixed(2)) } },
              },
              items: [{
                name: `Plan ${plan}${interval === 'year' ? ' Anual' : ''}`,
                description: `Saas Empresarial - ${plan}`,
                unit_amount: { currency_code: 'USD', value: String(Number(price.amount).toFixed(2)) },
                quantity: '1',
                category: 'DIGITAL_GOODS',
              }],
            }],
            application_context: {
              brand_name: 'Saas Empresarial',
              landing_page: 'LOGIN',
              user_action: 'PAY_NOW',
              return_url: successUrl,
              cancel_url: cancelUrl,
              shipping_preference: 'NO_SHIPPING',
            },
          }

          const orderResult = await paypalRequest('/v2/checkout/orders', 'POST', orderPayload)

          // Guardar referencia en DB
          await admin.from('subscriptions').insert({
            company_id, plan, status: 'trialing', provider: 'paypal',
            provider_subscription_id: orderResult.id,
            interval: interval || 'month',
          }).maybeSingle()

          const approveUrl = orderResult.links?.find((l: any) => l.rel === 'approve')?.href
          return json({ checkout_url: approveUrl, id: orderResult.id })
        }

        return json({ error: 'Proveedor no soportado' }, 400)
      }

      // === ESTADO DE SUSCRIPCIÓN ===
      case 'subscription-status': {
        if (!company_id) return json({ error: 'Falta company_id' }, 400)
        const { data } = await admin.from('subscriptions')
          .select('*').eq('company_id', company_id).eq('status', 'active').maybeSingle()
        return json(data)
      }

      // === HISTORIAL DE FACTURAS ===
      case 'invoices': {
        if (!company_id) return json({ error: 'Falta company_id' }, 400)
        const { data } = await admin.from('billing_invoices')
          .select('*').eq('company_id', company_id).order('paid_at', { ascending: false }).limit(12)
        return json(data || [])
      }

      // === CANCELAR SUSCRIPCIÓN ===
      case 'cancel': {
        if (!subscription_id || !provider) return json({ error: 'Faltan datos' }, 400)
        try {
          if (provider === 'dlocal') await dlocalRequest(`/subscriptions/${subscription_id}/cancel`, 'POST')
          if (provider === 'paypal') await paypalRequest(`/v1/billing/subscriptions/${subscription_id}/cancel`, 'POST')
        } catch { /* el proveedor puede ya haber cancelado */ }

        await admin.from('subscriptions').update({
          status: 'canceled', canceled_at: new Date().toISOString(),
        }).eq('provider_subscription_id', subscription_id)

        // Si es la suscripción activa, volver a free
        if (company_id) {
          const { data: sub } = await admin.from('subscriptions')
            .select('company_id').eq('provider_subscription_id', subscription_id).single()
          if (sub) {
            await admin.from('companies').update({ plan: 'free' }).eq('id', sub.company_id)
          }
        }
        return json({ success: true })
      }

      // === VERIFICAR ESTADO DE UN PAGO (después de redirect) ===
      case 'verify-payment': {
        if (!company_id) return json({ error: 'Falta company_id' }, 400)

        // Buscar la suscripción más reciente en estado trialing
        const { data: sub } = await admin.from('subscriptions')
          .select('*').eq('company_id', company_id).eq('status', 'trialing')
          .order('created_at', { ascending: false }).limit(1).maybeSingle()

        if (!sub) return json({ status: 'no_trialing' })

        if (sub.provider === 'dlocal' && sub.provider_subscription_id) {
          try {
            // Para suscripciones dLocal: consultar las subscriptiones del plan
            const subsResult = await dlocalRequest(
              `/subscription/plan/${sub.provider_subscription_id}/subscription/all`, 'GET'
            )
            const dlocalSubs = subsResult?.data || []
            const confirmed = dlocalSubs.find((s: any) => s.status === 'CONFIRMED' || s.active === true)

            if (confirmed) {
              // Primer pago realizado, activar
              await admin.from('subscriptions').update({
                status: 'active',
                provider_plan_token: confirmed.subscription_token,
                current_period_start: confirmed.created_at ? new Date(confirmed.created_at).toISOString() : new Date().toISOString(),
              }).eq('id', sub.id)
              await admin.from('companies').update({ plan: sub.plan }).eq('id', company_id)
              await admin.from('companies').update({ plan: sub.plan }).eq('parent_company_id', company_id)
              // Registrar primera factura
              await admin.from('billing_invoices').insert({
                company_id, subscription_id: sub.id,
                provider: 'dlocal', provider_invoice_id: confirmed.id ? String(confirmed.id) : sub.provider_subscription_id,
                amount: Number(confirmed.amount_paid || confirmed.plan?.amount || 0),
                currency: confirmed.currency || 'USD',
                status: 'paid',
              }).maybeSingle()
              return json({ status: 'activated', plan: sub.plan })
            }
            return json({ status: dlocalSubs.length > 0 ? (dlocalSubs[0].status || 'PENDING') : 'PENDING' })
          } catch (err) {
            return json({ status: 'error', error: err.message })
          }
        }

        return json({ status: 'unknown' })
      }

      default:
        return json({ error: 'Acción no válida' }, 400)
    }
  } catch (err) {
    return json({ error: err.message }, 500)
  }
})
