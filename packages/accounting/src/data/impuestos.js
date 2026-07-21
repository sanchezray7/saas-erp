import { getSupabase } from '@saas/core'

export async function listarGruposImpuestos(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('tax_groups').select('*').eq('company_id', companyId).order('name')
  if (error) throw error
  return data || []
}

export async function guardarGrupoImpuesto(companyId, grupo) {
  const supabase = getSupabase()
  const payload = { company_id: companyId, name: grupo.name, type: grupo.type }
  if (grupo.id) {
    const { error } = await supabase.from('tax_groups').update(payload).eq('id', grupo.id)
    if (error) throw error
    return grupo.id
  }
  const { data, error } = await supabase.from('tax_groups').insert(payload).select('id').single()
  if (error) throw error
  return data.id
}

export async function eliminarGrupoImpuesto(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('tax_groups').delete().eq('id', id)
  if (error) throw error
}

export async function listarImpuestos(companyId, groupId) {
  const supabase = getSupabase()
  let query = supabase.from('taxes').select('*, tax_group:tax_group_id(id, name, type)').eq('company_id', companyId).order('name')
  if (groupId) query = query.eq('tax_group_id', groupId)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function guardarImpuesto(companyId, impuesto) {
  const supabase = getSupabase()
  const payload = {
    company_id: companyId,
    tax_group_id: impuesto.tax_group_id,
    name: impuesto.name,
    percentage: Number(impuesto.percentage),
    is_withholding: impuesto.is_withholding || false,
    account_id: impuesto.account_id || null,
  }
  if (impuesto.id) {
    const { error } = await supabase.from('taxes').update(payload).eq('id', impuesto.id)
    if (error) throw error
    return impuesto.id
  }
  const { data, error } = await supabase.from('taxes').insert(payload).select('id').single()
  if (error) throw error
  return data.id
}

export async function eliminarImpuesto(id) {
  const supabase = getSupabase()
  // Eliminar referencias en invoice_tax_lines primero
  await supabase.from('invoice_tax_lines').delete().eq('tax_id', id)
  const { error } = await supabase.from('taxes').delete().eq('id', id)
  if (error) throw error
}

export async function guardarInvoiceTaxLines(companyId, invoiceType, invoiceId, items) {
  const supabase = getSupabase()

  // Borrar líneas existentes de esta factura
  await supabase.from('invoice_tax_lines').delete().match({ invoice_type: invoiceType, invoice_id: invoiceId })

  if (!items || items.length === 0) return

  const lines = []
  for (const item of items) {
    const base = Number(item.base_amount) || 0
    for (const t of (item.taxes || [])) {
      const pct = Number(t.percentage) / 100
      let taxAmount
      if (item.iva_incluido && !t.is_withholding) {
        taxAmount = base - (base / (1 + pct))
      } else if (item.iva_incluido && t.is_withholding) {
        // base sin IVA para retenciones cuando el precio incluye IVA
        const ivaLines = (item.taxes || []).filter((x) => !x.is_withholding)
        let ivaTotal = 0
        ivaLines.forEach((x) => { const p = Number(x.percentage) / 100; ivaTotal += base - (base / (1 + p)) })
        taxAmount = (base - ivaTotal) * pct
      } else {
        taxAmount = base * pct
      }
      lines.push({
        company_id: companyId,
        invoice_type: invoiceType,
        invoice_id: invoiceId,
        tax_id: t.id,
        base_amount: base,
        tax_amount: taxAmount,
      })
    }
  }

  if (lines.length > 0) {
    const { error } = await supabase.from('invoice_tax_lines').insert(lines)
    if (error) throw error
  }
}

export async function listarInvoiceTaxLines(invoiceType, invoiceId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('invoice_tax_lines')
    .select('*, tax:tax_id(*, tax_group:tax_group_id(name, type))')
    .match({ invoice_type: invoiceType, invoice_id: invoiceId })
  if (error) throw error
  return data || []
}

export function calcularResumenImpuestos(taxes, baseAmount, ivaIncluido = false) {
  let totalImpuestos = 0
  let totalRetenciones = 0
  let baseSinIva = baseAmount

  // 1ra pasada: calcular IVA incluido si corresponde
  if (ivaIncluido) {
    const ivaLines = (taxes || []).filter((t) => !t.is_withholding)
    let ivaTotal = 0
    ivaLines.forEach((t) => {
      const pct = Number(t.percentage) / 100
      const tax = baseAmount - (baseAmount / (1 + pct))
      ivaTotal += tax
    })
    baseSinIva = baseAmount - ivaTotal
  }

  const lines = (taxes || []).map((t) => {
    const pct = Number(t.percentage) / 100
    let amount
    let baseUsada

    if (ivaIncluido && !t.is_withholding) {
      // IVA incluido: extraer del total
      amount = baseAmount - (baseAmount / (1 + pct))
      baseUsada = baseAmount
    } else if (ivaIncluido && t.is_withholding) {
      // Retención: calcular sobre la base sin IVA
      amount = baseSinIva * pct
      baseUsada = baseSinIva
    } else {
      // Modo normal: impuesto sobre el subtotal
      amount = baseAmount * pct
      baseUsada = baseAmount
    }

    if (t.is_withholding) totalRetenciones += amount
    else totalImpuestos += amount

    return { ...t, tax_amount: amount, base_amount: baseUsada }
  })

  const total = ivaIncluido ? baseAmount + totalImpuestos - totalRetenciones : baseAmount + totalImpuestos - totalRetenciones

  return { lines, totalImpuestos, totalRetenciones, total, baseSinIva }
}

// Seed de impuestos para Chile
export async function seedImpuestosCL(companyId) {
  const supabase = getSupabase()

  const debitoGroup = await supabase.from('tax_groups').upsert({
    company_id: companyId, name: 'IVA Débito Fiscal', type: 'debito_fiscal',
  }, { onConflict: 'company_id,name' }).select('id').single()

  const creditoGroup = await supabase.from('tax_groups').upsert({
    company_id: companyId, name: 'IVA Crédito Fiscal', type: 'credito_fiscal',
  }, { onConflict: 'company_id,name' }).select('id').single()

  const retencionGroup = await supabase.from('tax_groups').upsert({
    company_id: companyId, name: 'Retenciones', type: 'retencion_venta',
  }, { onConflict: 'company_id,name' }).select('id').single()

  const taxes = [
    { tax_group_id: debitoGroup.data.id, name: 'IVA 19%', percentage: 19, is_withholding: false },
    { tax_group_id: creditoGroup.data.id, name: 'IVA 19%', percentage: 19, is_withholding: false },
    { tax_group_id: retencionGroup.data.id, name: 'Retención Renta 10%', percentage: 10, is_withholding: true },
    { tax_group_id: retencionGroup.data.id, name: 'Retención Renta 0.5%', percentage: 0.5, is_withholding: true },
  ]

  for (const t of taxes) {
    await supabase.from('taxes').upsert({
      company_id: companyId, tax_group_id: t.tax_group_id,
      name: t.name, percentage: t.percentage, is_withholding: t.is_withholding,
    }, { onConflict: 'company_id,name' })
  }

  return { debitoId: debitoGroup.data.id, creditoId: creditoGroup.data.id }
}
