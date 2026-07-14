// Edge Function: crear-usuario (requiere JWT + ser admin)
// Crea un usuario en Auth y lo asigna como miembro de la empresa activa.
//
// Body: { company_id, email, password, role, full_name, phone }
// Retorna: { user: { id, email }, member: { role } }
//
// Despliegue:
//   supabase functions deploy crear-usuario
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Falta SERVICE_ROLE_KEY en secrets' }, 500)
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Validar JWT del usuario logueado
  const authHeader = req.headers.get('Authorization') ?? ''
  const jwt = authHeader.replace('Bearer ', '')

  const { data: authData, error: authError } = await admin.auth.getUser(jwt)
  if (authError || !authData?.user) {
    return json({ error: 'Token inválido o expirado' }, 401)
  }
  const userId = authData.user.id

  let payload: {
    company_id?: string
    email?: string
    password?: string
    role?: string
    full_name?: string
    phone?: string
  }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }

  const companyId = payload.company_id ?? ''
  const email = (payload.email ?? '').trim().toLowerCase()
  const password = payload.password ?? ''
  const role = payload.role ?? 'vendedor'
  const fullName = (payload.full_name ?? '').trim()
  const phone = (payload.phone ?? '').trim()

  if (!companyId) {
    return json({ error: 'company_id es requerido' }, 400)
  }
  if (!EMAIL_RE.test(email)) {
    return json({ error: 'Correo electrónico inválido' }, 400)
  }
  if (password.length < 6) {
    return json({ error: 'La contraseña debe tener al menos 6 caracteres' }, 400)
  }

  // Verificar que el solicitante sea admin de la empresa
  const { data: member, error: memberError } = await admin
    .from('company_members')
    .select('role')
    .eq('company_id', companyId)
    .eq('user_id', userId)
    .maybeSingle()

  if (memberError) {
    return json({ error: 'Error al verificar permisos' }, 500)
  }
  if (!member || member.role !== 'admin') {
    return json({ error: 'Solo un admin puede invitar usuarios' }, 403)
  }

  // Verificar que el email no exista
  const { data: existingUsers, error: listError } = await admin.auth.admin.listUsers()
  if (listError) {
    return json({ error: 'Error al verificar el correo' }, 500)
  }

  const yaExiste = (existingUsers?.users ?? []).some(
    (u: any) => u.email?.toLowerCase() === email,
  )
  if (yaExiste) {
    return json(
      { error: 'Ya existe un usuario con ese correo.', code: 'email_exists' },
      409,
    )
  }

  // Crear usuario en Auth (signUp en vez de admin.createUser)
  const anon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!)
  const { data: signUpResult, error: signUpError } = await anon.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName || null,
        phone: phone || null,
      },
    },
  })

  if (signUpError || !signUpResult?.user) {
    return json({ error: `Error al crear usuario: ${signUpError?.message}` }, 500)
  }

  const newUserId = signUpResult.user.id

  // Confirmar email automáticamente
  const { error: confirmError } = await admin.auth.admin.updateUserById(newUserId, {
    email_confirm: true,
  })
  if (confirmError) {
    await admin.auth.admin.deleteUser(newUserId)
    return json({ error: 'Error al confirmar el usuario' }, 500)
  }

  // Asignar a company_members
  const { error: insertError } = await admin
    .from('company_members')
    .insert({ user_id: newUserId, company_id: companyId, role })

  if (insertError) {
    await admin.auth.admin.deleteUser(newUserId)
    return json({ error: `Error al asignar miembro: ${insertError.message}` }, 500)
  }

  return json({
    user: { id: newUserId, email },
    member: { company_id: companyId, role },
  })
})
