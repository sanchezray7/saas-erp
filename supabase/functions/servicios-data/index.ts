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
    const { action, company_id, id, user_id, presupuesto_id, orden_id } = body

    switch (action) {
      // === PRESUPUESTOS ===
      case 'listarPresupuestos': {
        const { data: r } = await admin.from('presupuestos').select('*').eq('company_id', company_id).order('created_at', { ascending: false })
        data = r || []
        break
      }
      case 'getPresupuesto': {
        const { data: r } = await admin.from('presupuestos').select('*').eq('id', id).single()
        data = r
        break
      }
      case 'guardarPresupuesto': {
        const p = body.presupuesto
        const subtotal = p.items?.reduce((s: number, it: any) => s + (Number(it.cantidad) || 0) * (Number(it.precio_unitario) || 0), 0) || 0
        const payload = {
          company_id, cliente_id: p.cliente_id || null, contacto: p.contacto || null,
          direccion: p.direccion || null, fecha_emision: p.fecha_emision || new Date().toISOString().split('T')[0],
          fecha_validez: p.fecha_validez || null, estado: p.estado || 'borrador',
          subtotal, impuestos: subtotal * 0, total: subtotal,
          notas: p.notas || null, created_by: user_id || null,
        }
        if (p.id) {
          const { error } = await admin.from('presupuestos').update(payload).eq('id', p.id)
          if (error) throw error
          if (p.items) { await saveItems(admin, 'presupuesto_items', 'presupuesto_id', p.id, p.items) }
          data = p.id
        } else {
          const { data: d, error } = await admin.from('presupuestos').insert(payload).select('id').single()
          if (error) throw error
          if (p.items) { await saveItems(admin, 'presupuesto_items', 'presupuesto_id', d.id, p.items) }
          data = d.id
        }
        break
      }
      case 'eliminarPresupuesto': {
        await admin.from('presupuestos').delete().eq('id', id)
        data = true; break
      }
      case 'getPresupuestoItems': {
        const { data: r } = await admin.from('presupuesto_items').select('*').eq('presupuesto_id', presupuesto_id).order('orden')
        data = r || []; break
      }
      case 'guardarPresupuestoItems': {
        await saveItems(admin, 'presupuesto_items', 'presupuesto_id', presupuesto_id, body.items)
        data = true; break
      }

      // === ÓRDENES DE TRABAJO ===
      case 'listarOrdenesTrabajo': {
        const { data: r } = await admin.from('ordenes_trabajo').select('*').eq('company_id', company_id).order('created_at', { ascending: false })
        data = r || []; break
      }
      case 'getOrdenTrabajo': {
        const { data: r } = await admin.from('ordenes_trabajo').select('*').eq('id', id).single()
        data = r; break
      }
      case 'guardarOrdenTrabajo': {
        const o = body.ot
        const payload = {
          company_id, presupuesto_id: o.presupuesto_id || null, cliente_id: o.cliente_id || null,
          contacto: o.contacto || null, direccion: o.direccion || null,
          tecnico_id: o.tecnico_id || null, titulo: o.titulo, descripcion: o.descripcion || null,
          estado: 'pendiente', prioridad: o.prioridad || 'normal',
          fecha_estimada: o.fecha_estimada || null,
          horas_estimadas: o.horas_estimadas || null, costo_estimado: o.costo_estimado || 0,
          notas_internas: o.notas_internas || null, notas_cliente: o.notas_cliente || null,
          created_by: user_id || null,
        }
        if (o.id) {
          delete payload.estado
          const { error } = await admin.from('ordenes_trabajo').update(payload).eq('id', o.id)
          if (error) throw error; data = o.id
        } else {
          const { data: d, error } = await admin.from('ordenes_trabajo').insert(payload).select('id').single()
          if (error) throw error; data = d.id
        }
        break
      }
      case 'iniciarOT': {
        const { error } = await admin.from('ordenes_trabajo').update({ estado: 'en_progreso', fecha_inicio: new Date().toISOString() }).eq('id', id)
        if (error) throw error; data = true; break
      }
      case 'completarOT': {
        const { error } = await admin.from('ordenes_trabajo').update({ estado: 'completada', fecha_fin: new Date().toISOString() }).eq('id', id)
        if (error) throw error; data = true; break
      }
      case 'cancelarOT': {
        const { error } = await admin.from('ordenes_trabajo').update({ estado: 'cancelada' }).eq('id', id)
        if (error) throw error; data = true; break
      }
      case 'getOTMateriales': {
        const { data: r } = await admin.from('ot_materiales').select('*').eq('orden_id', orden_id).order('created_at')
        data = r || []; break
      }
      case 'getOTTiempos': {
        const { data: r } = await admin.from('ot_tiempos').select('*').eq('orden_id', orden_id).order('created_at')
        data = r || []; break
      }
      case 'agregarMaterial': {
        const m = body.material
        const { data: d, error } = await admin.from('ot_materiales').insert({
          orden_id, producto_id: m.producto_id || null, descripcion: m.descripcion,
          cantidad: m.cantidad || 1, precio_unitario: m.precio_unitario || 0,
        }).select('id').single()
        if (error) throw error; data = d.id; break
      }
      case 'agregarTiempo': {
        const t = body.tiempo
        const { data: d, error } = await admin.from('ot_tiempos').insert({
          orden_id, user_id, horas: t.horas, descripcion: t.descripcion || null,
          fecha: t.fecha || new Date().toISOString().split('T')[0],
        }).select('id').single()
        if (error) throw error; data = d.id; break
      }
      case 'convertirPresupuestoAOT': {
        const { data: pres } = await admin.from('presupuestos').select('*').eq('id', presupuesto_id).single()
        if (!pres) throw new Error('Presupuesto no encontrado')
        const { data: items } = await admin.from('presupuesto_items').select('*').eq('presupuesto_id', presupuesto_id).order('orden')

        const { data: ot, error } = await admin.from('ordenes_trabajo').insert({
          company_id: pres.company_id, presupuesto_id: pres.id,
          cliente_id: pres.cliente_id, contacto: pres.contacto, direccion: pres.direccion,
          titulo: `OT desde presupuesto #${pres.numero}`,
          descripcion: items?.map((i: any) => `- ${i.descripcion} x${i.cantidad}`).join('\n') || null,
          estado: 'pendiente', created_by: user_id || null,
        }).select('id').single()
        if (error) throw error
        await admin.from('presupuestos').update({ estado: 'aprobado' }).eq('id', presupuesto_id)
        data = ot.id; break
      }
      default:
        return new Response(JSON.stringify({ error: 'Acción no válida' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})

async function saveItems(admin: any, table: string, fk: string, parentId: string, items: any[]) {
  await admin.from(table).delete().eq(fk, parentId)
  if (!items?.length) return
  const rows = items.map((it: any, i: number) => ({
    [fk]: parentId, producto_id: it.producto_id || null,
    descripcion: it.descripcion, cantidad: it.cantidad || 1,
    precio_unitario: it.precio_unitario || 0, tipo: it.tipo || 'servicio', orden: i,
  }))
  const { error } = await admin.from(table).insert(rows)
  if (error) throw error
}
