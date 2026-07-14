// Edge Function: form-webhook (pública)
// Recibe leads desde formularios externos y los guarda como contactos.
// No requiere JWT — cualquier sitio puede POSTear con un token válido.
//
// Body: { token, name, email, phone, message }
// Retorna: { ok: true, contact_id } | { error: string }
//
// Despliegue:
//   supabase functions deploy form-webhook
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SERVICE_ROLE_KEY')!

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 1. Validar payload
  let payload: { token?: string; name?: string; email?: string; phone?: string; message?: string }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }

  const token = (payload.token ?? '').trim()
  const name = (payload.name ?? '').trim()
  const email = (payload.email ?? '').trim().toLowerCase()
  const phone = (payload.phone ?? '').trim()
  const message = (payload.message ?? '').trim()

  if (!token) {
    return json({ error: 'Token es obligatorio' }, 400)
  }
  if (!name) {
    return json({ error: 'Nombre es obligatorio' }, 400)
  }
  if (!email || !EMAIL_RE.test(email)) {
    return json({ error: 'Correo electrónico inválido' }, 400)
  }

  // 2. Validar token
  const { data: wt, error: wtError } = await admin
    .from('webhook_tokens')
    .select('company_id, is_active')
    .eq('token', token)
    .maybeSingle()

  if (wtError) {
    return json({ error: 'Error al validar token' }, 500)
  }
  if (!wt) {
    return json({ error: 'Token inválido' }, 401)
  }
  if (!wt.is_active) {
    return json({ error: 'Webhook desactivado' }, 403)
  }

  // 3. Verificar que la empresa exista
  const { data: company, error: companyError } = await admin
    .from('companies')
    .select('id')
    .eq('id', wt.company_id)
    .single()

  if (companyError || !company) {
    return json({ error: 'Empresa no encontrada' }, 404)
  }

  // 4. Buscar si ya existe un contacto con ese email en la misma empresa
  const { data: existing } = await admin
    .from('contacts')
    .select('id')
    .eq('company_id', wt.company_id)
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    return json({
      ok: true,
      contact_id: existing.id,
      already_exists: true,
    })
  }

  // 5. Crear contacto
  const { data: contact, error: contactError } = await admin
    .from('contacts')
    .insert({
      company_id: wt.company_id,
      name,
      email,
      phone: phone || null,
      notes: message || null,
      source: 'webhook',
    })
    .select('id')
    .single()

  if (contactError) {
    return json({ error: `Error al guardar contacto: ${contactError.message}` }, 500)
  }

  return json({
    ok: true,
    contact_id: contact.id,
    already_exists: false,
  })
})
