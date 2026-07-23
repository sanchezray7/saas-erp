import { getSupabase } from '@saas/core'

export async function listarAccounts(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('accounts').select('*').eq('company_id', companyId).order('code')
  if (error) throw error
  return data || []
}

export async function guardarAccount(companyId, account) {
  const supabase = getSupabase()
  const payload = {
    company_id: companyId,
    parent_id: account.parent_id || null,
    code: account.code,
    name: account.name,
    type: account.type,
    is_active: account.is_active !== false,
    banco_nombre: account.banco_nombre || null,
    numero_cuenta: account.numero_cuenta || null,
    tipo_cuenta: account.tipo_cuenta || 'corriente',
  }
  if (account.id) {
    const { error } = await supabase.from('accounts').update(payload).eq('id', account.id)
    if (error) throw error
    return account.id
  }
  const { data, error } = await supabase.from('accounts').insert(payload).select('id').single()
  if (error) throw error
  return data.id
}

export async function eliminarAccount(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('accounts').delete().eq('id', id)
  if (error) throw error
}

// Construye árbol de cuentas (parent → children)
export function buildAccountTree(accounts) {
  const map = {}
  const roots = []
  accounts.forEach((a) => { map[a.id] = { ...a, children: [] } })
  accounts.forEach((a) => {
    if (a.parent_id && map[a.parent_id]) map[a.parent_id].children.push(map[a.id])
    else if (!a.parent_id) roots.push(map[a.id])
  })
  return roots
}

// Seed por defecto para Paraguay
export const SEED_ACCOUNTS_PY = [
  { code: '1', name: 'Activo', type: 'activo', parent_code: null },
  { code: '1.1', name: 'Activo Corriente', type: 'activo', parent_code: '1' },
  { code: '1.1.1', name: 'Caja', type: 'activo', parent_code: '1.1' },
  { code: '1.1.2', name: 'Bancos', type: 'activo', parent_code: '1.1' },
  { code: '1.1.3', name: 'Clientes', type: 'activo', parent_code: '1.1' },
  { code: '1.1.4', name: 'IVA Crédito Fiscal', type: 'activo', parent_code: '1.1' },
  { code: '1.1.5', name: 'Inventario', type: 'activo', parent_code: '1.1' },
  { code: '1.2', name: 'Activo No Corriente', type: 'activo', parent_code: '1' },
  { code: '1.2.1', name: 'Inmuebles', type: 'activo', parent_code: '1.2' },
  { code: '2', name: 'Pasivo', type: 'pasivo', parent_code: null },
  { code: '2.1', name: 'Pasivo Corriente', type: 'pasivo', parent_code: '2' },
  { code: '2.1.1', name: 'Proveedores', type: 'pasivo', parent_code: '2.1' },
  { code: '2.1.2', name: 'IVA Débito Fiscal', type: 'pasivo', parent_code: '2.1' },
  { code: '2.1.3', name: 'Retenciones por Pagar', type: 'pasivo', parent_code: '2.1' },
  { code: '2.1.4', name: 'Obligaciones Fiscales', type: 'pasivo', parent_code: '2.1' },
  { code: '2.2', name: 'Pasivo No Corriente', type: 'pasivo', parent_code: '2' },
  { code: '2.2.1', name: 'Préstamos Bancarios', type: 'pasivo', parent_code: '2.2' },
  { code: '3', name: 'Patrimonio', type: 'patrimonio', parent_code: null },
  { code: '3.1', name: 'Capital', type: 'patrimonio', parent_code: '3' },
  { code: '3.2', name: 'Resultados Acumulados', type: 'patrimonio', parent_code: '3' },
  { code: '4', name: 'Ingresos', type: 'ingreso', parent_code: null },
  { code: '4.1', name: 'Ventas', type: 'ingreso', parent_code: '4' },
  { code: '4.2', name: 'Otros Ingresos', type: 'ingreso', parent_code: '4' },
  { code: '5', name: 'Costos', type: 'costo', parent_code: null },
  { code: '5.1', name: 'Costo de Ventas', type: 'costo', parent_code: '5' },
  { code: '6', name: 'Gastos', type: 'gasto', parent_code: null },
  { code: '6.1', name: 'Gastos Administrativos', type: 'gasto', parent_code: '6' },
  { code: '6.2', name: 'Gastos de Ventas', type: 'gasto', parent_code: '6' },
  { code: '6.3', name: 'Gastos Financieros', type: 'gasto', parent_code: '6' },
  { code: '6.4', name: 'Ajuste de Inventario', type: 'gasto', parent_code: '6' },
]

// Seed para Chile (Plan de Cuentas basado en normas chilenas)
export const SEED_ACCOUNTS_CL = [
  { code: '1', name: 'Activo', type: 'activo', parent_code: null },
  { code: '11', name: 'Activo Corriente', type: 'activo', parent_code: '1' },
  { code: '111', name: 'Caja', type: 'activo', parent_code: '11' },
  { code: '112', name: 'Banco', type: 'activo', parent_code: '11' },
  { code: '113', name: 'Clientes', type: 'activo', parent_code: '11' },
  { code: '114', name: 'IVA Crédito Fiscal', type: 'activo', parent_code: '11' },
  { code: '115', name: 'Existencias', type: 'activo', parent_code: '11' },
  { code: '12', name: 'Activo No Corriente', type: 'activo', parent_code: '1' },
  { code: '121', name: 'Propiedades, Planta y Equipo', type: 'activo', parent_code: '12' },
  { code: '2', name: 'Pasivo', type: 'pasivo', parent_code: null },
  { code: '21', name: 'Pasivo Corriente', type: 'pasivo', parent_code: '2' },
  { code: '211', name: 'Proveedores', type: 'pasivo', parent_code: '21' },
  { code: '212', name: 'IVA Débito Fiscal', type: 'pasivo', parent_code: '21' },
  { code: '213', name: 'Remuneraciones por Pagar', type: 'pasivo', parent_code: '21' },
  { code: '214', name: 'AFP por Pagar', type: 'pasivo', parent_code: '21' },
  { code: '215', name: 'ISAPRE por Pagar', type: 'pasivo', parent_code: '21' },
  { code: '216', name: 'Impuesto a la Renta por Pagar', type: 'pasivo', parent_code: '21' },
  { code: '22', name: 'Pasivo No Corriente', type: 'pasivo', parent_code: '2' },
  { code: '221', name: 'Préstamos Bancarios', type: 'pasivo', parent_code: '22' },
  { code: '3', name: 'Patrimonio', type: 'patrimonio', parent_code: null },
  { code: '31', name: 'Capital', type: 'patrimonio', parent_code: '3' },
  { code: '32', name: 'Utilidades Retenidas', type: 'patrimonio', parent_code: '3' },
  { code: '4', name: 'Ingresos', type: 'ingreso', parent_code: null },
  { code: '41', name: 'Ingresos por Ventas', type: 'ingreso', parent_code: '4' },
  { code: '42', name: 'Otros Ingresos', type: 'ingreso', parent_code: '4' },
  { code: '5', name: 'Costos', type: 'costo', parent_code: null },
  { code: '51', name: 'Costo de Ventas', type: 'costo', parent_code: '5' },
  { code: '6', name: 'Gastos', type: 'gasto', parent_code: null },
  { code: '61', name: 'Gastos de Administración', type: 'gasto', parent_code: '6' },
  { code: '62', name: 'Gastos de Ventas', type: 'gasto', parent_code: '6' },
  { code: '63', name: 'Gastos Financieros', type: 'gasto', parent_code: '6' },
]

// Seed para Colombia (PUC - Plan Único de Cuentas)
export const SEED_ACCOUNTS_CO = [
  { code: '1', name: 'Activo', type: 'activo', parent_code: null },
  { code: '11', name: 'Disponible', type: 'activo', parent_code: '1' },
  { code: '1105', name: 'Caja', type: 'activo', parent_code: '11' },
  { code: '1110', name: 'Bancos', type: 'activo', parent_code: '11' },
  { code: '13', name: 'Deudores', type: 'activo', parent_code: '1' },
  { code: '1305', name: 'Clientes', type: 'activo', parent_code: '13' },
  { code: '1355', name: 'Anticipo de Impuestos', type: 'activo', parent_code: '13' },
  { code: '14', name: 'Inventarios', type: 'activo', parent_code: '1' },
  { code: '1435', name: 'Mercancías', type: 'activo', parent_code: '14' },
  { code: '15', name: 'Propiedades, Planta y Equipo', type: 'activo', parent_code: '1' },
  { code: '1505', name: 'Edificios y Terrenos', type: 'activo', parent_code: '15' },
  { code: '1510', name: 'Equipos de Cómputo', type: 'activo', parent_code: '15' },
  { code: '2', name: 'Pasivo', type: 'pasivo', parent_code: null },
  { code: '21', name: 'Obligaciones Financieras', type: 'pasivo', parent_code: '2' },
  { code: '2105', name: 'Préstamos Bancarios', type: 'pasivo', parent_code: '21' },
  { code: '22', name: 'Proveedores', type: 'pasivo', parent_code: '2' },
  { code: '2205', name: 'Proveedores Nacionales', type: 'pasivo', parent_code: '22' },
  { code: '23', name: 'Cuentas por Pagar', type: 'pasivo', parent_code: '2' },
  { code: '2365', name: 'Retención en la Fuente', type: 'pasivo', parent_code: '23' },
  { code: '2367', name: 'Impuesto a las Ventas Retenido (ReteIVA)', type: 'pasivo', parent_code: '23' },
  { code: '2368', name: 'IVA por Pagar', type: 'pasivo', parent_code: '23' },
  { code: '2370', name: 'Aportes Nómina por Pagar', type: 'pasivo', parent_code: '23' },
  { code: '24', name: 'Impuestos por Pagar', type: 'pasivo', parent_code: '2' },
  { code: '2404', name: 'ICA por Pagar', type: 'pasivo', parent_code: '24' },
  { code: '25', name: 'Obligaciones Laborales', type: 'pasivo', parent_code: '2' },
  { code: '2505', name: 'Salarios por Pagar', type: 'pasivo', parent_code: '25' },
  { code: '28', name: 'Otros Pasivos', type: 'pasivo', parent_code: '2' },
  { code: '2805', name: 'Anticipos de Clientes', type: 'pasivo', parent_code: '28' },
  { code: '3', name: 'Patrimonio', type: 'patrimonio', parent_code: null },
  { code: '3105', name: 'Capital', type: 'patrimonio', parent_code: '3' },
  { code: '3305', name: 'Utilidad del Ejercicio', type: 'patrimonio', parent_code: '3' },
  { code: '4', name: 'Ingresos', type: 'ingreso', parent_code: null },
  { code: '41', name: 'Ingresos Operacionales', type: 'ingreso', parent_code: '4' },
  { code: '4135', name: 'Comercio al por Mayor y Menor', type: 'ingreso', parent_code: '41' },
  { code: '42', name: 'Ingresos No Operacionales', type: 'ingreso', parent_code: '4' },
  { code: '4205', name: 'Otros Ingresos', type: 'ingreso', parent_code: '42' },
  { code: '5', name: 'Costos', type: 'costo', parent_code: null },
  { code: '51', name: 'Costo de Ventas', type: 'costo', parent_code: '5' },
  { code: '5105', name: 'Costo de Mercancías', type: 'costo', parent_code: '51' },
  { code: '6', name: 'Gastos', type: 'gasto', parent_code: null },
  { code: '61', name: 'Gastos de Administración', type: 'gasto', parent_code: '6' },
  { code: '6105', name: 'Gastos de Personal', type: 'gasto', parent_code: '61' },
  { code: '62', name: 'Gastos de Ventas', type: 'gasto', parent_code: '6' },
  { code: '6205', name: 'Comisiones', type: 'gasto', parent_code: '62' },
  { code: '63', name: 'Gastos No Operacionales', type: 'gasto', parent_code: '6' },
  { code: '6305', name: 'Gastos Financieros', type: 'gasto', parent_code: '63' },
  { code: '64', name: 'Impuestos', type: 'gasto', parent_code: '6' },
  { code: '6405', name: 'Impuesto de Industria y Comercio', type: 'gasto', parent_code: '64' },
]

export async function seedAccounts(companyId, pais = 'PY') {
  const supabase = getSupabase()
  const seed = pais === 'CL' ? SEED_ACCOUNTS_CL : pais === 'CO' ? SEED_ACCOUNTS_CO : SEED_ACCOUNTS_PY
  const codeMap = {}
  for (const a of seed) {
    const parentId = a.parent_code ? codeMap[a.parent_code] : null
    const { data } = await supabase.from('accounts').upsert({
      company_id: companyId, parent_id: parentId || null,
      code: a.code, name: a.name, type: a.type,
    }, { onConflict: 'company_id,code' }).select('id').single()
    if (data) codeMap[a.code] = data.id
  }
}

export async function listarAccountsParaSelect(companyId) {
  const accs = await listarAccounts(companyId)
  // Armar lista plana con indentación
  const flat = []
  function walk(list, depth) {
    list.forEach((a) => {
      flat.push({ ...a, indent: depth })
      if (a.children) walk(a.children, depth + 1)
    })
  }
  walk(buildAccountTree(accs), 0)
  return flat
}

export async function autoAsignarCuentasImpuestos(companyId) {
  const supabase = getSupabase()
  // Buscar cuentas por código
  const { data: accounts } = await supabase.from('accounts').select('*').eq('company_id', companyId)
  if (!accounts) return
  const creditoAccount = accounts.find((a) => a.code === '1.1.4' || a.code === '114' || a.code === '1355')
  const debitoAccount = accounts.find((a) => a.code === '2.1.2' || a.code === '212' || a.code === '2368')

  // Asignar a impuestos que no tengan cuenta
  const { data: taxes } = await supabase.from('taxes').select('*, tax_group:tax_group_id(type)').eq('company_id', companyId).is('account_id', null)
  for (const t of (taxes || [])) {
    let accountId = null
    if (t.tax_group?.type === 'credito_fiscal' && creditoAccount) accountId = creditoAccount.id
    if (t.tax_group?.type === 'debito_fiscal' && debitoAccount) accountId = debitoAccount.id
    if (accountId) {
      await supabase.from('taxes').update({ account_id: accountId }).eq('id', t.id)
    }
  }
}
