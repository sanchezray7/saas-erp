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

  // 5. Crear el usuario (requiere confirmación de email vía SMTP)
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

  // 7. Disparar email de confirmación (SMTP debe estar configurado)
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
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

  // 8. Crear configuración de empresa
  await admin.from('company_config').insert({ company_id: company.id, app_name: companyName }).maybeSingle()

  // 9. Crear pipeline por defecto + etapas
  const pipelineOk = await crearPipeline(admin, company.id)

  // 10. Seed industrias por defecto (best-effort)
  await admin.rpc('seed_default_industries', { p_company_id: company.id }).maybeSingle()

  // 11. Seed específico por país
  if (pais === 'CL') {
    // Plan de cuentas chileno
    const CL_ACCOUNTS = [
      { code: '1', name: 'Activo', type: 'activo' },
      { code: '11', name: 'Activo Corriente', type: 'activo' },
      { code: '111', name: 'Caja', type: 'activo' },
      { code: '112', name: 'Banco', type: 'activo' },
      { code: '113', name: 'Clientes', type: 'activo' },
      { code: '114', name: 'IVA Crédito Fiscal', type: 'activo' },
      { code: '115', name: 'Existencias', type: 'activo' },
      { code: '12', name: 'Activo No Corriente', type: 'activo' },
      { code: '121', name: 'Propiedades, Planta y Equipo', type: 'activo' },
      { code: '2', name: 'Pasivo', type: 'pasivo' },
      { code: '21', name: 'Pasivo Corriente', type: 'pasivo' },
      { code: '211', name: 'Proveedores', type: 'pasivo' },
      { code: '212', name: 'IVA Débito Fiscal', type: 'pasivo' },
      { code: '213', name: 'Remuneraciones por Pagar', type: 'pasivo' },
      { code: '214', name: 'AFP por Pagar', type: 'pasivo' },
      { code: '215', name: 'ISAPRE por Pagar', type: 'pasivo' },
      { code: '216', name: 'Impuesto a la Renta por Pagar', type: 'pasivo' },
      { code: '22', name: 'Pasivo No Corriente', type: 'pasivo' },
      { code: '221', name: 'Préstamos Bancarios', type: 'pasivo' },
      { code: '3', name: 'Patrimonio', type: 'patrimonio' },
      { code: '31', name: 'Capital', type: 'patrimonio' },
      { code: '32', name: 'Utilidades Retenidas', type: 'patrimonio' },
      { code: '4', name: 'Ingresos', type: 'ingreso' },
      { code: '41', name: 'Ingresos por Ventas', type: 'ingreso' },
      { code: '42', name: 'Otros Ingresos', type: 'ingreso' },
      { code: '5', name: 'Costos', type: 'costo' },
      { code: '51', name: 'Costo de Ventas', type: 'costo' },
      { code: '6', name: 'Gastos', type: 'gasto' },
      { code: '61', name: 'Gastos de Administración', type: 'gasto' },
      { code: '62', name: 'Gastos de Ventas', type: 'gasto' },
      { code: '63', name: 'Gastos Financieros', type: 'gasto' },
    ]
    const codeMap: Record<string, string> = {}
    for (const a of CL_ACCOUNTS) {
      const parentId = a.code.length > 1 ? codeMap[a.code.slice(0, -1)] : null
      const { data: acc } = await admin.from('accounts').upsert({
        company_id: company.id, parent_id: parentId || null,
        code: a.code, name: a.name, type: a.type,
      }, { onConflict: 'company_id,code' }).select('id').single()
      if (acc) codeMap[a.code] = acc.id
    }

    // Grupos de impuestos chilenos
    const { data: debitoG } = await admin.from('tax_groups').upsert({
      company_id: company.id, name: 'IVA Débito Fiscal', type: 'debito_fiscal',
    }, { onConflict: 'company_id,name' }).select('id').single()
    const { data: creditoG } = await admin.from('tax_groups').upsert({
      company_id: company.id, name: 'IVA Crédito Fiscal', type: 'credito_fiscal',
    }, { onConflict: 'company_id,name' }).select('id').single()
    const { data: retG } = await admin.from('tax_groups').upsert({
      company_id: company.id, name: 'Retenciones', type: 'retencion_venta',
    }, { onConflict: 'company_id,name' }).select('id').single()

    // Tasas chilenas
    const CL_TAXES = [
      { tax_group_id: debitoG?.id, name: 'IVA 19%', percentage: 19 },
      { tax_group_id: creditoG?.id, name: 'IVA 19%', percentage: 19 },
      { tax_group_id: retG?.id, name: 'Retención Renta 10%', percentage: 10, is_withholding: true },
      { tax_group_id: retG?.id, name: 'Retención Renta 0.5%', percentage: 0.5, is_withholding: true },
    ]
    for (const t of CL_TAXES) {
      await admin.from('taxes').upsert({
        company_id: company.id, tax_group_id: t.tax_group_id,
        name: t.name, percentage: t.percentage, is_withholding: t.is_withholding || false,
      }, { onConflict: 'company_id,name' })
    }
  }

  // 12. Webhook token
  await admin.from('webhook_tokens').insert({ company_id: company.id, token: crypto.randomUUID() }).maybeSingle()

  return json({
    company: { id: company.id, name: company.name, rif: company.rif },
    user: { id: created.user.id, email: created.user.email },
    email_confirmed: false,
    pipeline_created: pipelineOk,
  })
})
