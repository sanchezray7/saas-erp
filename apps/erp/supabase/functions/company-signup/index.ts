// Edge Function: company-signup (publica)
// Crea empresa + usuario + rol admin + pipeline por defecto en un solo paso.
// No requiere JWT -- punto de entrada publico para registro.
//
// Body: { company_name, rif, email, password, pais }
// Retorna: { company: { id, name, rif, pais }, user: { id, email }, email_sent }
//
// Despliegue:
//   supabase functions deploy company-signup
//   supabase secrets set SERVICE_ROLE_KEY=<value>
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
    return json({ error: 'Metodo no permitido' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let payload: {
    company_name?: string
    rif?: string
    email?: string
    password?: string
    pais?: string
    full_name?: string
    phone?: string
  }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'JSON invalido' }, 400)
  }

  const companyName = (payload.company_name ?? '').trim()
  const rif = (payload.rif ?? '').trim()
  const email = (payload.email ?? '').trim().toLowerCase()
  const password = payload.password ?? ''
  const pais = (payload.pais ?? 'PY').toUpperCase().trim()
  const fullName = (payload.full_name ?? '').trim()
  const phone = (payload.phone ?? '').trim()

  if (!companyName) {
    return json({ error: 'El nombre de la empresa es obligatorio' }, 400)
  }
  if (!rif) {
    return json({ error: 'El RIF/NIT es obligatorio' }, 400)
  }
  if (!EMAIL_RE.test(email)) {
    return json({ error: 'Correo electronico invalido' }, 400)
  }
  if (password.length < 6) {
    return json({ error: 'La contrasena debe tener al menos 6 caracteres' }, 400)
  }
  if (!PAISES_VALIDOS.includes(pais)) {
    return json({ error: `Pais no soportado. Usar uno de: ${PAISES_VALIDOS.join(', ')}` }, 400)
  }

  // Verificar que el RIF no exista
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
      { error: 'Ya existe una cuenta con ese correo.', code: 'email_exists' },
      409,
    )
  }

  // 1. Crear la compania (admin - sin RLS)
  const { data: company, error: companyError } = await admin
    .from('companies')
    .insert({ name: companyName, rif, pais, plan: 'free', status: 'active' })
    .select('id, name, rif, pais')
    .single()

  if (companyError || !company) {
    return json({ error: `Error al crear la empresa: ${companyError?.message}` }, 500)
  }

  // 2. Crear el usuario via signUp() - esto envia el email de confirmacion automaticamente
  const anon = createClient(supabaseUrl, anonKey)
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
    await admin.from('companies').delete().eq('id', company.id)
    return json({ error: `Error al crear el usuario: ${signUpError?.message}` }, 500)
  }

  const userId = signUpResult.user.id
  const emailSent = !!(signUpResult.user?.email_confirmed_at === null)

  // 3. Asignar rol admin en company_members (admin)
  const { error: memberError } = await admin
    .from('company_members')
    .insert({ user_id: userId, company_id: company.id, role: 'admin' })

  if (memberError) {
    await admin.auth.admin.deleteUser(userId)
    await admin.from('companies').delete().eq('id', company.id)
    return json({ error: `Error al asignar miembro: ${memberError.message}` }, 500)
  }

  // 4. Crear config white-label por defecto (admin)
  const { error: configError } = await admin
    .from('company_config')
    .insert({ company_id: company.id, app_name: companyName })

  if (configError) {
    await admin.from('company_members').delete().eq('company_id', company.id)
    await admin.auth.admin.deleteUser(userId)
    await admin.from('companies').delete().eq('id', company.id)
    return json({ error: `Error al crear configuracion: ${configError.message}` }, 500)
  }

  // 5. Crear pipeline por defecto (admin)
  const { data: pipeline, error: pipelineError } = await admin
    .from('pipelines')
    .insert({ company_id: company.id, name: 'Pipeline por defecto', description: 'Pipeline principal de ventas' })
    .select('id')
    .single()

  if (pipelineError || !pipeline) {
    await admin.from('company_config').delete().eq('company_id', company.id)
    await admin.from('company_members').delete().eq('company_id', company.id)
    await admin.auth.admin.deleteUser(userId)
    await admin.from('companies').delete().eq('id', company.id)
    return json({ error: `Error al crear pipeline: ${pipelineError?.message}` }, 500)
  }

  // 6. Crear etapas por defecto (admin)
  const { error: stagesError } = await admin
    .from('stages')
    .insert([
      { pipeline_id: pipeline.id, name: 'Nuevo', position: 0, probability: 10, color: '#6366f1' },
      { pipeline_id: pipeline.id, name: 'Contactado', position: 1, probability: 25, color: '#3b82f6' },
      { pipeline_id: pipeline.id, name: 'Propuesta', position: 2, probability: 50, color: '#f59e0b' },
      { pipeline_id: pipeline.id, name: 'Negociacion', position: 3, probability: 75, color: '#f97316' },
      { pipeline_id: pipeline.id, name: 'Cerrado ganado', position: 4, probability: 100, color: '#22c55e' },
      { pipeline_id: pipeline.id, name: 'Cerrado perdido', position: 5, probability: 0, color: '#ef4444' },
    ])

  if (stagesError) {
    await admin.from('pipelines').delete().eq('id', pipeline.id)
    await admin.from('company_config').delete().eq('company_id', company.id)
    await admin.from('company_members').delete().eq('company_id', company.id)
    await admin.auth.admin.deleteUser(userId)
    await admin.from('companies').delete().eq('id', company.id)
    return json({ error: `Error al crear etapas: ${stagesError.message}` }, 500)
  }

  // 7. Sembrar industrias por defecto (best-effort, sin rollback si falla)
  await admin.rpc('seed_default_industries', { p_company_id: company.id }).catch(() => {})

  return json({
    company: { id: company.id, name: company.name, rif: company.rif, pais: company.pais },
    user: { id: userId, email, email_confirmed: false },
    email_sent: emailSent,
  })
})
