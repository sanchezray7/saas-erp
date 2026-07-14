import { getSupabase } from '@saas/core'
import { guardarOrden } from './ordenesCompra'

export async function obtenerSugerencias(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('productos_stock_bajo_con_proveedores', {
    p_company_id: companyId,
  })
  if (error) throw error
  return data || []
}

function sugerirCantidad(stockTotal, stockMinimo) {
  const faltante = Math.max(0, stockMinimo - stockTotal)
  return Math.max(faltante, stockMinimo)
}

function agruparPorProveedor(productos, asignaciones) {
  const grupos = {}
  for (const p of productos) {
    const provId = asignaciones[p.producto_id]
    if (!provId) continue
    if (!grupos[provId]) grupos[provId] = { proveedor_id: provId, proveedor_nombre: '', items: [] }
    const selProv = p.proveedores?.find((pr) => pr.proveedor_id === provId)
    if (selProv) {
      grupos[provId].proveedor_nombre = selProv.proveedor_nombre
      grupos[provId].items.push({
        producto_id: p.producto_id,
        producto_nombre: p.producto_nombre,
        cantidad: sugerirCantidad(p.stock_total, p.stock_minimo),
        precio_unitario: Number(selProv.precio),
        moneda: selProv.moneda,
      })
    }
  }
  return Object.values(grupos)
}

export async function generarOCs(companyId, productos, asignaciones) {
  const grupos = agruparPorProveedor(productos, asignaciones)
  const creadas = []
  for (const grupo of grupos) {
    const orden = {
      proveedor_id: grupo.proveedor_id,
      numero: 'OC-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 5).toUpperCase(),
      estado: 'borrador',
      moneda: grupo.items[0]?.moneda || 'PYG',
    }
    const items = grupo.items.map((i) => ({
      producto_id: i.producto_id,
      descripcion: i.producto_nombre,
      cantidad: i.cantidad,
      precio_unitario: i.precio_unitario,
    }))
    const id = await guardarOrden(companyId, orden, items)
    creadas.push({ id, numero: orden.numero, proveedor_nombre: grupo.proveedor_nombre, items: items.length })
  }
  return creadas
}
