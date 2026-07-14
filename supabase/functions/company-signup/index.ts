// Edge Function: company-signup (pública)
// Crea empresa + usuario + rol admin en un solo paso.
// No requiere JWT — punto de entrada público para registro.
//
// Body: { company_name, rif, email, password, pais }
// Retorna: { company: { id, name, rif }, user: { id, email } }
//
// Despliegue:
//   supabase functions deploy company-signup
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PAISES_VALIDOS = ['PY', 'AR', 'CL', 'CO', 'PE', 'UY', 'BO', 'EC', 'VE', 'MX', 'BR']

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
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  // Cliente admin (service_role)
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 1. Validar payload
  let payload: {
    company_name?: string
    rif?: string
    email?: string
    password?: string
    pais?: string
  }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }

  const companyName = (payload.company_name ?? '').trim()
  const rif = (payload.rif ?? '').trim()
  const email = (payload.email ?? '').trim().toLowerCase()
  const password = payload.password ?? ''
  const pais = (payload.pais ?? 'PY').trim()

  if (!companyName) {
    return json({ error: 'El nombre de la empresa es obligatorio' }, 400)
  }
  if (!rif) {
    return json({ error: 'El RIF/NIT es obligatorio' }, 400)
  }
  if (!EMAIL_RE.test(email)) {
    return json({ error: 'Correo electrónico inválido' }, 400)
  }
  if (password.length < 6) {
    return json({ error: 'La contraseña debe tener al menos 6 caracteres' }, 400)
  }
  if (!PAISES_VALIDOS.includes(pais)) {
    return json({ error: 'País no soportado' }, 400)
  }

  // 2. Verificar que el RIF no exista ya en companies
  const { data: companyConRif, error: rifError } = await admin
    .from('companies')
    .select('id')
    .eq('rif', rif)
    .maybeSingle()

  if (rifError) {
    return json({ error: 'Error al verificar el RIF/NIT' }, 500)
  }
  if (companyConRif) {
    return json(
      { error: 'Ya existe una empresa registrada con ese RIF/NIT.', code: 'rif_exists' },
      409,
    )
  }

  // 3. Verificar que el email no exista ya en auth.users
  const { data: existingUsers, error: listError } = await admin.auth.admin.listUsers()
  if (listError) {
    return json({ error: 'Error al verificar el correo' }, 500)
  }

  const yaExiste = (existingUsers?.users ?? []).some(
    (u: any) => u.email?.toLowerCase() === email,
  )
  if (yaExiste) {
    return json(
      { error: 'Ya existe una cuenta con ese correo.', code: 'email_exists' },
      409,
    )
  }

  // 4. Crear la compañía
  const { data: company, error: companyError } = await admin
    .from('companies')
    .insert({ name: companyName, rif, pais, plan: 'free', status: 'active' })
    .select('id, name, rif')
    .single()

  if (companyError || !company) {
    return json({ error: `Error al crear la empresa: ${companyError?.message}` }, 500)
  }

  // 5. Crear el usuario (requiere verificación de email)
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
  })

  if (createError || !created?.user) {
    await admin.from('companies').delete().eq('id', company.id)
    return json({ error: `Error al crear el usuario: ${createError?.message}` }, 500)
  }

  // 6. Asignar rol admin en company_members
  const { error: roleError } = await admin
    .from('company_members')
    .insert({ user_id: created.user.id, company_id: company.id, role: 'admin' })

  if (roleError) {
    await admin.auth.admin.deleteUser(created.user.id)
    await admin.from('companies').delete().eq('id', company.id)
    return json({ error: `Error al asignar rol: ${roleError.message}` }, 500)
  }

  // 7. Disparar el email de verificación
  try {
    await fetch(`${supabaseUrl}/auth/v1/resend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ type: 'signup', email }),
    })
  } catch {
    // Si falla, el usuario puede reenviar desde la pantalla de verificación
  }

  return json({
    company: { id: company.id, name: company.name, rif: company.rif },
    user: { id: created.user.id, email: created.user.email },
    email_confirmed: false,
  })
})
