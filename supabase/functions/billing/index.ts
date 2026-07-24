import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const DLOCAL_API = Deno.env.get('DLOCAL_ENV') === 'production'
  ? 'https://api.dlocal.com'
  : 'https://sandbox.dlocal.com'

const DLOCAL_API_KEY = Deno.env.get('DLOCAL_API_KEY')!
const DLOCAL_SECRET = Deno.env.get('DLOCAL_SECRET')!
const _btoa = (s: string) => {
  const chars = new TextEncoder().encode(s)
  let bin = ''
  for (let i = 0; i < chars.length; i++) bin += String.fromCharCode(chars[i])
  return btoa(bin)
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

async function dlocalRequest(path: string, method = 'GET', body?: unknown) {
  const res = await fetch(`${DLOCAL_API}${path}`, {
    method,
    headers: {
      'Authorization': `Basic ${_btoa(`${DLOCAL_API_KEY}:${DLOCAL_SECRET}`)}`,
      'Content-Type': 'application/json',
      'X-Date': new Date().toISOString(),
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
  const auth = _btoa(`${clientId}:${secret}`)
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
        const successUrl = `${baseUrl}/settings/billing?success=true`
        const cancelUrl = `${baseUrl}/settings/billing?canceled=true`

        if (provider === 'dlocal') {
          // Crear pago único con redirect
          const dlocalBody: any = {
            amount: Number(price.amount),
            currency: price.currency || 'USD',
            country: 'PY',
            payment_method_flow: 'REDIRECT',
            redirect_url: successUrl,
            cancel_url: cancelUrl,
            description: `Saas Empresarial - Plan ${plan}${interval === 'year' ? ' anual' : ''}`,
            notification_url: `${baseUrl}/functions/v1/billing-webhook`,
            order_id: `${company_id.slice(0, 8)}-${Date.now()}`,
          }

          const result = await dlocalRequest('/payments', 'POST', dlocalBody)

          // Guardar referencia en DB
          await admin.from('subscriptions').insert({
            company_id, plan, status: 'trialing', provider: 'dlocal',
            provider_subscription_id: result.id,
            interval: interval || 'month',
          }).maybeSingle()

          return json({ checkout_url: result.redirect_url, id: result.id })
        }

        if (provider === 'paypal') {
          const base = Deno.env.get('PAYPAL_ENV') === 'production'
            ? 'https://api-m.paypal.com'
            : 'https://api-m.sandbox.paypal.com'

          const planObj = {
            name: `Saas Empresarial - ${plan}${interval === 'year' ? ' Anual' : ''}`,
            description: `Plan ${plan} - $${Number(price.amount)}/${interval === 'year' ? 'año' : 'mes'}`,
            billing_cycles: [{
              frequency: { interval_unit: interval === 'year' ? 'YEAR' : 'MONTH', interval_count: 1 },
              tenure_type: 'REGULAR',
              sequence: 1,
              pricing_scheme: { fixed_price: { value: String(Number(price.amount).toFixed(2)), currency_code: 'USD' } },
            }],
            payment_preferences: {
              auto_bill_outstanding: true,
              setup_fee: { value: '0', currency_code: 'USD' },
              setup_fee_failure_action: 'CANCEL',
              payment_failure_threshold: 3,
            },
          }

          // PayPal no tiene "11 meses" nativo, cobramos el total anual upfront
          if (interval === 'year') {
            planObj.billing_cycles = [{
              frequency: { interval_unit: 'YEAR', interval_count: 1 },
              tenure_type: 'REGULAR',
              sequence: 1,
              total_cycles: 1,
              pricing_scheme: { fixed_price: { value: String(Number(price.amount).toFixed(2)), currency_code: 'USD' } },
            }]
          }

          const planResult = await paypalRequest('/v1/billing/plans', 'POST', planObj)

          // Crear suscripción
          const subResult = await paypalRequest('/v1/billing/subscriptions', 'POST', {
            plan_id: planResult.id,
            application_context: {
              brand_name: 'Saas Empresarial',
              locale: 'es-PY',
              shipping_preference: 'NO_SHIPPING',
              user_action: 'SUBSCRIBE_NOW',
              return_url: successUrl,
              cancel_url: cancelUrl,
            },
          })

          await admin.from('subscriptions').insert({
            company_id, plan, status: 'trialing', provider: 'paypal',
            provider_subscription_id: subResult.id,
            interval: interval || 'month',
          }).maybeSingle()

          const approveUrl = subResult.links?.find((l: any) => l.rel === 'approve')?.href
          return json({ checkout_url: approveUrl, id: subResult.id })
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

      default:
        return json({ error: 'Acción no válida' }, 400)
    }
  } catch (err) {
    return json({ error: err.message }, 500)
  }
})
