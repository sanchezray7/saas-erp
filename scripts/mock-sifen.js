// Mock SIFEN/e-kuatia — servidor de pruebas local
// Simula los Web Services de la DNIT para desarrollo offline.
//
// Uso: node scripts/mock-sifen.js
// Endpoints:
//   POST /sifen/recepcion   { xml } → { estado, cdc, errores? }
//   GET  /sifen/consulta/:cdc       → DTE guardado
//   GET  /sifen/estado               → estadísticas del mock

import http from 'node:http'

const PORT = process.env.MOCK_SIFEN_PORT || 3001

const dteDB = []
let contador = 0

function json(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  })
  res.end(JSON.stringify(data, null, 2))
}

function leerBody(req) {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (chunk) => { data += chunk })
    req.on('end', () => {
      try { resolve(JSON.parse(data)) }
      catch { resolve({}) }
    })
  })
}

function validarXML(xml) {
  const errores = []
  if (!xml || xml.length < 100) {
    errores.push({ codigo: 1001, descripcion: 'XML inválido o demasiado corto' })
    return errores
  }

  // Simular errores según palabras clave en el XML
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

function simularCDC(prefijo = 'MOCK-CDC') {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefijo}-${timestamp}${random}`
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const path = url.pathname
  const method = req.method

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // ── POST /sifen/recepcion ──
  if (method === 'POST' && path === '/sifen/recepcion') {
    const body = await leerBody(req)
    const { xml } = body

    const errores = validarXML(xml)
    if (errores.length > 0) {
      return json(res, {
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

    return json(res, {
      estado: 'APROBADO',
      cdc,
      numero_dte: contador,
      timestamp: new Date().toISOString(),
    })
  }

  // ── GET /sifen/consulta/:cdc ──
  if (method === 'GET' && path.startsWith('/sifen/consulta/')) {
    const cdc = path.replace('/sifen/consulta/', '')
    const dte = dteDB.find((d) => d.cdc === cdc)

    if (!dte) {
      return json(res, { error: 'DTE no encontrado' }, 404)
    }

    return json(res, dte)
  }

  // ── GET /sifen/estado ──
  if (method === 'GET' && path === '/sifen/estado') {
    return json(res, {
      ambiente: 'MOCK',
      version: '150',
      schema: 'siRecepDE_v150',
      dte_recibidos: dteDB.length,
      server: 'e-kuatia Mock',
      timestamp: new Date().toISOString(),
    })
  }

  // 404
  json(res, { error: 'Endpoint no encontrado' }, 404)
})

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║     Mock SIFEN / e-kuatia               ║
║     Puerto: ${String(PORT).padEnd(33)}║
║     Endpoints:                           ║
║       POST /sifen/recepcion              ║
║       GET  /sifen/consulta/:cdc          ║
║       GET  /sifen/estado                 ║
╚══════════════════════════════════════════╝
`)
})
