import { getSupabase } from '@saas/core'

const LOOKUP_POR_PAIS = {
  PY: { nombre: 'Paraguay', api: 'rucparaguay.info', activo: true },
  PE: { nombre: 'Perú', api: 'SUNAT', activo: false },
  CL: { nombre: 'Chile', api: 'SII', activo: false },
  CO: { nombre: 'Colombia', api: 'DIAN', activo: false },
  AR: { nombre: 'Argentina', api: 'AFIP', activo: false },
  BR: { nombre: 'Brasil', api: 'Receita Federal', activo: false },
  MX: { nombre: 'México', api: 'SAT', activo: false },
  UY: { nombre: 'Uruguay', api: 'DGI', activo: false },
  BO: { nombre: 'Bolivia', api: 'SIN', activo: false },
  EC: { nombre: 'Ecuador', api: 'SRI', activo: false },
  VE: { nombre: 'Venezuela', api: 'SENIAT', activo: false },
}

export async function consultarRuc(ruc, pais = 'PY') {
  const cfg = LOOKUP_POR_PAIS[pais]
  if (!cfg || !cfg.activo) {
    throw new Error(
      cfg
        ? `Búsqueda de ${cfg.nombre} aún no disponible (API ${cfg.api})`
        : `País no soportado para búsqueda de RUC`
    )
  }

  if (import.meta.env.DEV) {
    return _consultarViaProxy(ruc)
  }
  return _consultarViaEdgeFunction(ruc)
}

async function _consultarViaProxy(ruc) {
  const token = import.meta.env.VITE_RUC_API_KEY
  if (!token) throw new Error('API key no configurada (VITE_RUC_API_KEY)')

  const res = await fetch(`/api/ruc-proxy/${ruc}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json()
  return _procesarRespuesta(json)
}

async function _consultarViaEdgeFunction(ruc) {
  const supabase = getSupabase()
  const { data, error } = await supabase.functions.invoke('consultar-ruc', {
    body: { ruc },
  })
  if (error) throw new Error(error.message)
  return _procesarRespuesta(data)
}

function _procesarRespuesta(json) {
  if (json.message === 'Token no enviado.') throw new Error('Token API no configurado')
  if (json.message === 'Token inválido o no autorizado.') throw new Error('Token API inválido')
  if (json.message === 'No se encontró un contribuyente con ese RUC.') throw new Error('RUC no encontrado')
  if (json.message) throw new Error(json.message)
  if (!json.data || Object.keys(json.data).length === 0) throw new Error('RUC no encontrado')
  return json.data
}
