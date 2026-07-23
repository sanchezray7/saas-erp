import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  let body: any
  try { body = await req.json() } catch { return new Response(JSON.stringify({ error: 'JSON inválido' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }

  try {
    let data: any
    const { action, company_id, id, receta_id, orden_id } = body

    switch (action) {
      // === LECTURAS ===
      case 'listarRecetas': {
        const { data: r } = await admin.from('recetas').select('*, producto_final:catalogo_productos(id,nombre,codigo)').eq('company_id', company_id).order('nombre')
        data = r || []
        break
      }
      case 'getReceta': {
        const { data: r } = await admin.from('recetas').select('*, producto_final:catalogo_productos(id,nombre,codigo)').eq('id', id).single()
        data = r
        break
      }
      case 'listarIngredientes': {
        const { data: r } = await admin.from('receta_ingredientes').select('*, producto:catalogo_productos(id,nombre,codigo,tipo)').eq('receta_id', receta_id).order('orden')
        data = r || []
        break
      }
      case 'listarOrdenes': {
        const { data: r } = await admin.from('ordenes_produccion').select('*, receta:recetas(id,codigo,nombre)').eq('company_id', company_id).order('created_at', { ascending: false })
        data = r || []
        break
      }
      case 'getOrden': {
        const { data: r } = await admin.from('ordenes_produccion').select('*, receta:recetas(id,codigo,nombre,cantidad_producida,unidad_medida,instrucciones)').eq('id', id).single()
        data = r
        break
      }
      case 'getConsumos': {
        const { data: r } = await admin.from('orden_consumos').select('*, producto:catalogo_productos(id,nombre,codigo)').eq('orden_id', orden_id).order('created_at')
        data = r || []
        break
      }
      case 'getObtenciones': {
        const { data: r } = await admin.from('orden_obtenciones').select('*, producto:catalogo_productos(id,nombre,codigo)').eq('orden_id', orden_id).order('created_at')
        data = r || []
        break
      }

      // === ESCRITURAS ===
      case 'guardarReceta': {
        const receta = body.receta
        const payload = {
          company_id, codigo: receta.codigo, nombre: receta.nombre,
          producto_final_id: receta.producto_final_id || null,
          cantidad_producida: receta.cantidad_producida || 1,
          unidad_medida: receta.unidad_medida || 'UNI',
          instrucciones: receta.instrucciones || null,
          activo: receta.activo !== false,
        }
        if (receta.id) {
          const { error } = await admin.from('recetas').update(payload).eq('id', receta.id)
          if (error) throw error
          data = receta.id
        } else {
          const { data: d, error } = await admin.from('recetas').insert(payload).select('id').single()
          if (error) throw error
          data = d.id
        }
        break
      }
      case 'eliminarReceta': {
        const { error } = await admin.from('recetas').delete().eq('id', id)
        if (error) throw error
        data = true
        break
      }
      case 'guardarIngredientes': {
        await admin.from('receta_ingredientes').delete().eq('receta_id', receta_id)
        if (body.ingredientes?.length > 0) {
          const rows = body.ingredientes.map((ing: any, i: number) => ({
            receta_id, producto_id: ing.producto_id, cantidad: ing.cantidad,
            unidad_medida: ing.unidad_medida || 'UNI',
            es_subproducto: ing.es_subproducto || false,
            merma_porcentaje: ing.merma_porcentaje || 0, orden: i,
          }))
          const { error } = await admin.from('receta_ingredientes').insert(rows)
          if (error) throw error
        }
        data = true
        break
      }
      case 'guardarOrden': {
        const payload = {
          company_id, receta_id, lote: body.orden?.lote || null,
          cantidad_planeada: body.orden?.cantidad_planeada,
          fecha_inicio_planeada: body.orden?.fecha_inicio_planeada || null,
          notas: body.orden?.notas || null, created_by: body.user_id || null,
        }
        const { data: d, error } = await admin.from('ordenes_produccion').insert(payload).select('id').single()
        if (error) throw error
        data = d.id
        break
      }
      case 'iniciarOrden': {
        const { error } = await admin.from('ordenes_produccion').update({
          estado: 'en_proceso', fecha_inicio_real: new Date().toISOString(),
        }).eq('id', id)
        if (error) throw error
        data = true
        break
      }
      case 'cancelarOrden': {
        const { error } = await admin.from('ordenes_produccion').update({ estado: 'cancelada' }).eq('id', id)
        if (error) throw error
        data = true
        break
      }
      case 'completarOrden': {
        const ordenId = orden_id
        const almacenId = body.almacen_id
        const cantidadProducida = body.cantidad_producida
        const lote = body.lote

        const orden = await admin.from('ordenes_produccion').select('*, receta:recetas(id,codigo,nombre,cantidad_producida,unidad_medida,instrucciones,producto_final_id)').eq('id', ordenId).single()
        if (orden.error || !orden.data || orden.data.estado !== 'en_proceso') throw new Error('La orden no está en proceso')

        const { data: ingredientes } = await admin.from('receta_ingredientes').select('*, producto:catalogo_productos(id,nombre,codigo,tipo)').eq('receta_id', orden.data.receta_id).order('orden')

        let costoTotal = 0

        for (const ing of (ingredientes || [])) {
          if (ing.es_subproducto) continue
          const cantidadConsumir = (ing.cantidad / orden.data.receta.cantidad_producida) * cantidadProducida

          const { data: stock } = await admin.from('producto_stock').select('costo_promedio').match({ company_id, producto_id: ing.producto_id, almacen_id: almacenId }).maybeSingle()
          const costoUnit = stock?.costo_promedio || 0

          await admin.from('movimientos_stock').insert({
            company_id, producto_id: ing.producto_id, almacen_id: almacenId,
            tipo: 'salida', cantidad: cantidadConsumir, lote: lote || null,
            costo_unitario: costoUnit,
            referencia_type: 'produccion', referencia_id: ordenId,
            motivo: `Consumo OP #${orden.data.numero}`, created_by: body.user_id || null,
          })

          await admin.from('orden_consumos').insert({
            orden_id: ordenId, producto_id: ing.producto_id,
            cantidad: cantidadConsumir, lote: lote || null, costo_unitario: costoUnit,
          })

          costoTotal += costoUnit * cantidadConsumir
        }

        const costoFinal = cantidadProducida > 0 ? costoTotal / cantidadProducida : 0

        await admin.from('movimientos_stock').insert({
          company_id, producto_id: orden.data.receta.producto_final_id, almacen_id: almacenId,
          tipo: 'entrada', cantidad: cantidadProducida, lote: lote || null,
          costo_unitario: costoFinal,
          referencia_type: 'produccion', referencia_id: ordenId,
          motivo: `Producción OP #${orden.data.numero}`, created_by: body.user_id || null,
        })

        await admin.from('orden_obtenciones').insert({
          orden_id: ordenId, producto_id: orden.data.receta.producto_final_id,
          cantidad: cantidadProducida, lote: lote || null, costo_unitario: costoFinal,
        })

        for (const ing of (ingredientes || [])) {
          if (!ing.es_subproducto) continue
          const cantidadSub = (ing.cantidad / orden.data.receta.cantidad_producida) * cantidadProducida

          await admin.from('movimientos_stock').insert({
            company_id, producto_id: ing.producto_id, almacen_id: almacenId,
            tipo: 'entrada', cantidad: cantidadSub, lote: lote || null,
            costo_unitario: 0,
            referencia_type: 'produccion', referencia_id: ordenId,
            motivo: `Subproducto OP #${orden.data.numero}`, created_by: body.user_id || null,
          })

          await admin.from('orden_obtenciones').insert({
            orden_id: ordenId, producto_id: ing.producto_id,
            cantidad: cantidadSub, lote: lote || null, costo_unitario: 0,
          })
        }

        const { error } = await admin.from('ordenes_produccion').update({
          estado: 'completada', cantidad_producida: cantidadProducida,
          fecha_fin: new Date().toISOString(), costo_total: costoTotal,
        }).eq('id', ordenId)
        if (error) throw error
        data = true
        break
      }
      default:
        return new Response(JSON.stringify({ error: 'Acción no válida' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
