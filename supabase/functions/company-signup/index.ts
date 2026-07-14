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

async function crearPipeline(admin: any, companyId: string): Promise<boolean> {
  const { data: pipeline, error: pipeError } = await admin
    .from('pipelines')
    .insert({ company_id: companyId, name: 'Pipeline por defecto', description: 'Pipeline principal de ventas' })
    .select('id')
    .single()
  if (pipeError || !pipeline) return false

  const stages = [
    { pipeline_id: pipeline.id, name: 'Nuevo', position: 0, probability: 10, color: '#6366f1' },
    { pipeline_id: pipeline.id, name: 'Contactado', position: 1, probability: 25, color: '#3b82f6' },
    { pipeline_id: pipeline.id, name: 'Propuesta', position: 2, probability: 50, color: '#f59e0b' },
    { pipeline_id: pipeline.id, name: 'Negociacion', position: 3, probability: 75, color: '#f97316' },
    { pipeline_id: pipeline.id, name: 'Cerrado ganado', position: 4, probability: 100, color: '#22c55e' },
    { pipeline_id: pipeline.id, name: 'Cerrado perdido', position: 5, probability: 0, color: '#ef4444' },
  ]

  const { error: stagesError } = await admin.from('stages').insert(stages)
  return !stagesError
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

  // 5. Crear el usuario (auto-confirmado)
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
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

  // 7. Crear configuración de empresa
  await admin.from('company_config').insert({ company_id: company.id, app_name: companyName }).maybeSingle()

  // 8. Crear pipeline por defecto + etapas
  const pipelineOk = await crearPipeline(admin, company.id)

  // 9. Seed industrias por defecto (best-effort)
  await admin.rpc('seed_default_industries', { p_company_id: company.id }).maybeSingle()

  // 10. Webhook token
  await admin.from('webhook_tokens').insert({ company_id: company.id, token: crypto.randomUUID() }).maybeSingle()

  return json({
    company: { id: company.id, name: company.name, rif: company.rif },
    user: { id: created.user.id, email: created.user.email },
    email_confirmed: true,
    pipeline_created: pipelineOk,
  })
})
