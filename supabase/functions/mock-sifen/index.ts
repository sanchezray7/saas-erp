// Edge Function: mock-sifen
// Simula los Web Services de la DNIT/e-kuatia para pruebas en staging.
// Reemplazo del mock local `node scripts/mock-sifen.js`
//
// Endpoints:
//   POST /sifen/recepcion   { xml } → { estado, cdc, errores? }
//   GET  /sifen/consulta/:cdc       → DTE guardado
//   GET  /sifen/estado               → estadísticas del mock
//
// Despliegue:
//   supabase functions deploy mock-sifen
// Luego configurar VITE_SIFEN_URL=https://<ref>.supabase.co/functions/v1/mock-sifen
//
// deno-lint-ignore-file no-explicit-any

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

interface DTE {
  cdc: string
  numero_dte: number
  xml: string
  estado: string
  timestamp: string
}

// Nota: dteDB vive en memoria mientras el worker esté vivo.
// En Edge Functions no es garantizado entre invocaciones, pero alcanza para testing.
const dteDB: DTE[] = []
let contador = 0

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function validarXML(xml: string): Array<{ codigo: number; descripcion: string }> {
  const errores: Array<{ codigo: number; descripcion: string }> = []
  if (!xml || xml.length < 100) {
    errores.push({ codigo: 1001, descripcion: 'XML inválido o demasiado corto' })
    return errores
  }
  if (xml.includes('RUC_INVALIDO')) {
    errores.push({ codigo: 1002, descripcion: 'RUC del emisor no existe en la base de datos de la DNIT' })
  }
  if (xml.includes('TIMBRADO_INVALIDO')) {
    errores.push({ codigo: 2001, descripcion: 'Número de timbrado no válido o vencido' })
  }
  if (xml.includes('ERROR_SERVIDOR')) {
    errores.push({ codigo: 9999, descripcion: 'Error interno del servidor SIFEN (simulado)' })
  }
  return errores
}

function simularCDC(prefijo = 'MOCK-CDC'): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefijo}-${timestamp}${random}`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const path = url.pathname

  // ── POST /sifen/recepcion ──
  if (req.method === 'POST' && path === '/sifen/recepcion') {
    let body: { xml?: string } = {}
    try { body = await req.json() } catch { return json({ error: 'JSON inválido' }, 400) }

    const xml = body.xml ?? ''
    const errores = validarXML(xml)
    if (errores.length > 0) {
      return json({
        estado: 'RECHAZADO',
        cdc: null,
        errores,
        timestamp: new Date().toISOString(),
      })
    }

    contador++
    const esNC = xml.includes('gTipoDE') && xml.includes('<iDTE>05</iDTE>')
    const esND = xml.includes('gTipoDE') && xml.includes('<iDTE>06</iDTE>')
    const prefijo = esNC ? 'MOCK-NC' : esND ? 'MOCK-ND' : 'MOCK-CDC'
    const cdc = simularCDC(prefijo)

    dteDB.push({
      cdc,
      numero_dte: contador,
      xml,
      estado: 'APROBADO',
      timestamp: new Date().toISOString(),
    })

    console.log(`[SIFEN Mock] ${esNC ? 'NC' : esND ? 'ND' : 'DTE'} #${contador} APROBADO — CDC: ${cdc}`)

    return json({
      estado: 'APROBADO',
      cdc,
      numero_dte: contador,
      timestamp: new Date().toISOString(),
    })
  }

  // ── GET /sifen/consulta/:cdc ──
  if (req.method === 'GET' && path.startsWith('/sifen/consulta/')) {
    const cdc = path.replace('/sifen/consulta/', '')
    const dte = dteDB.find((d) => d.cdc === cdc)
    if (!dte) return json({ error: 'DTE no encontrado' }, 404)
    return json(dte)
  }

  // ── GET /sifen/estado ──
  if (req.method === 'GET' && path === '/sifen/estado') {
    return json({
      ambiente: 'MOCK',
      version: '150',
      schema: 'siRecepDE_v150',
      dte_recibidos: dteDB.length,
      server: 'e-kuatia Mock (Edge Function)',
      timestamp: new Date().toISOString(),
    })
  }

  return json({ error: 'Endpoint no encontrado' }, 404)
})
