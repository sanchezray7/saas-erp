// Edge Function: get-user-permissions
// Retorna los permisos efectivos del usuario autenticado en una empresa.
// Busca el rol en company_members y los permisos en role_permissions.
//
// Body esperado: { company_id: uuid }
// Retorna: { roles: string[], permissions: string[] }
//
// Despliegue:
//   supabase functions deploy get-user-permissions
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // 1. Identificar al llamante.
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) {
    return json({ error: 'Falta el token de autorización' }, 401)
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user: caller },
    error: callerError,
  } = await callerClient.auth.getUser()

  if (callerError || !caller) {
    return json({ error: 'No autenticado' }, 401)
  }

  // 2. Cliente admin (service_role).
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 3. Validar payload.
  let payload: { company_id?: string }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }

  const companyId = payload.company_id ?? ''
  if (!companyId) {
    return json({ error: 'company_id es obligatorio' }, 400)
  }

  // 4. Obtener roles del usuario en la empresa (company_members)
  const { data: userRoles, error: rolesError } = await admin
    .from('company_members')
    .select('role')
    .eq('user_id', caller.id)
    .eq('company_id', companyId)

  if (rolesError) {
    return json({ error: 'Error al obtener roles' }, 500)
  }

  const roles = [...new Set((userRoles ?? []).map((r: any) => r.role))]

  if (roles.length === 0) {
    return json({ roles: [], permissions: [] })
  }

  // 5. Obtener permisos para todos los roles.
  const { data: perms, error: permsError } = await admin
    .from('role_permissions')
    .select('permission')
    .in('role', roles)

  if (permsError) {
    return json({ error: 'Error al obtener permisos' }, 500)
  }

  const permissions = [...new Set((perms ?? []).map((p: any) => p.permission))]

  return json({ roles, permissions })
})
