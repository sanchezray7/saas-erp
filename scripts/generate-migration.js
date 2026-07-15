const fs = require('fs')
const path = require('path')

const docsDir = path.join(__dirname, '..', 'apps', 'erp', 'docs')
const outputFile = path.join(__dirname, '..', '_combined-migration.sql')

const orden = [
  'crm-setup.sql', 'contacts-setup.sql',
  'leads-setup.sql', 'cold-leads-setup.sql',
  'industries-setup.sql', 'tags-setup.sql', 'ruc-setup.sql', 'metas-setup.sql',
  'email-templates-setup.sql', 'notificaciones-setup.sql', 'round-robin-setup.sql',
  'agenda-setup.sql', 'timeline-setup.sql', 'dashboard-kpi-setup.sql', 'ai-setup.sql',
  'reports-setup.sql', 'push-setup.sql',
  'paises-setup.sql', 'localizacion-setup.sql', 'moneda-setup.sql',
  'perfil-empresa-setup.sql', 'empresa-rpc-setup.sql', 'actividades-setup.sql',
  'plan-limites-setup.sql',
  'catalogo-setup.sql', 'unidades-setup.sql',
  'srm-setup.sql', 'sugerencias-oc-setup.sql', 'pagos-setup.sql',

  'taxes-setup.sql',
  'accounts-setup.sql',
  'cotizaciones-setup.sql', 'facturacion-setup.sql', 'notas-credito-debito-setup.sql',
  'anular-factura-setup.sql', 'cobranza-setup.sql',
  'facturas-proveedor-setup.sql', 'scorecard-setup.sql',

  'accounting-setup.sql',
  'cuentas-pagar-cobrar-setup.sql',

  'alertas-vencimiento-setup.sql', 'historial-precios-setup.sql', 'alternativas-setup.sql',
  'whatsapp-setup.sql',
  'inventario-setup.sql', 'ajuste-inventario-setup.sql',
  'conciliacion-setup.sql', 'calendario-cierre-setup.sql', 'tipos-cambio-setup.sql',
  'flujo-efectivo-setup.sql', 'consolidacion-setup.sql', 'consolidacion-avanzada-setup.sql',
  'holding-setup.sql', 'reportes-consolidados-setup.sql',
  'rrhh-setup.sql', 'rrhh-asistencia-setup.sql', 'rrhh-biometrico-setup.sql',
  'rrhh-turnos-setup.sql', 'rrhh-turnos-rediseno-setup.sql',
  'rrhh-control-horario-setup.sql', 'rrhh-organigrama-setup.sql',
  'rrhh-reportes-setup.sql', 'feriados-setup.sql',
  'nomina-setup.sql', 'nomina-asientos-setup.sql',
  'nomina-orden-calculo.sql', 'nomina-complementario-fix.sql',
]

const lines = [
  '-- ============================================================',
  '-- Migracion combinada: SaaS Empresarial',
  '-- Generado: ' + new Date().toISOString(),
  '-- ============================================================',
  '',
  '-- Desactivar validacion de bodies de funciones (orden circular tablas -> funciones -> RLS)',
  'SET check_function_bodies = false;',
  '',
]

// Extraer funciones helper de crm-setup.sql (deben ir ANTES de las tablas)
const crmPath = path.join(docsDir, 'crm-setup.sql')
if (fs.existsSync(crmPath)) {
  const crmContent = fs.readFileSync(crmPath, 'utf8')
  // Extraer desde "-- Helpers security definer" hasta antes de "drop policy if exists "cm_insert""
  const helperStart = crmContent.indexOf('-- Helpers security definer')
  const cmInsert = crmContent.indexOf('drop policy if exists "cm_insert"')
  
  if (helperStart >= 0 && cmInsert > helperStart) {
    const helpersSection = crmContent.substring(helperStart, cmInsert).trim()
    lines.push('-- ============================================================')
    lines.push('-- HELPER FUNCTIONS (deben ir antes de las tablas para RLS)')
    lines.push('-- ============================================================')
    lines.push(helpersSection)
    lines.push('')
    
    // El resto de crm-setup.sql sin las helpers
    const crmRest = crmContent.substring(0, helperStart) + crmContent.substring(cmInsert)
    // Guardar temporalmente para el loop
    fs.writeFileSync(crmPath + '.tmp', crmRest.trim(), 'utf8')
  }
}

let ok = 0, err = 0

for (const file of orden) {
  // Usar archivo temporal si existe (crm-setup.sql sin helpers)
  let filePath = path.join(docsDir, file)
  const tmpPath = filePath + '.tmp'
  if (fs.existsSync(tmpPath)) {
    filePath = tmpPath
  }
  if (!fs.existsSync(filePath)) {
    lines.push('-- [NO ENCONTRADO] ' + file)
    err++
    continue
  }
  const content = fs.readFileSync(filePath, 'utf8').trim()
  lines.push('')
  lines.push('-- ============================================================')
  lines.push('-- ' + file)
  lines.push('-- ============================================================')
  lines.push(content)
  lines.push('')
  ok++
}

fs.writeFileSync(outputFile, lines.join('\n'), 'utf8')
const stats = fs.statSync(outputFile)
console.log('Archivos encontrados: ' + ok)
console.log('Archivos faltantes: ' + err)
console.log('Combinado generado: ' + outputFile)
console.log('Tamano: ' + (stats.size / 1024).toFixed(1) + ' KB')
console.log('')
console.log('Instrucciones:')
console.log('1. Ir a https://supabase.com/dashboard/project/hbvcprxuveagzalyogeu/sql/new')
console.log('2. Copiar el contenido de ' + outputFile)
console.log('3. Pegar en el SQL Editor y ejecutar')
console.log('4. Si da error por tamano, ejecutar en partes (archivo por archivo)')

// Limpiar archivos temporales
for (const file of orden) {
  const tmpPath = path.join(docsDir, file) + '.tmp'
  if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath)
}
