# Script para ejecutar migraciones SQL en el nuevo proyecto Supabase
# Modo 1: PowerShell (recomendado) — usa la Management API
# Modo 2: Generar SQL combinado para pegar en el SQL Editor
param(
  [Parameter(Mandatory = $false)]
  [string]$Mode = "generate",
  
  [Parameter(Mandatory = $false)]
  [string]$SupabaseRef = "hbvcprxuveagzalyogeu",
  
  [Parameter(Mandatory = $false)]
  [string]$ManagementApiKey = ""
)

$docsPath = Join-Path $PSScriptRoot "docs"
$outputPath = Join-Path $PSScriptRoot "_combined-migration.sql"

# Orden de migraciones
$orden = @(
  # Core / Auth
  "supabase-setup.sql",
  "rpc-setup.sql",
  
  # Global / Config
  "paises-setup.sql",
  "localizacion-setup.sql",
  "moneda-setup.sql",
  "perfil-empresa-setup.sql",
  "empresa-rpc-setup.sql",
  "actividades-setup.sql",
  
  # CRM base
  "crm-setup.sql",
  "contacts-setup.sql",
  "leads-setup.sql",
  "cold-leads-setup.sql",
  "industries-setup.sql",
  "tags-setup.sql",
  "ruc-setup.sql",
  "metas-setup.sql",
  "email-templates-setup.sql",
  "notificaciones-setup.sql",
  "round-robin-setup.sql",
  "agenda-setup.sql",
  "timeline-setup.sql",
  "dashboard-kpi-setup.sql",
  "ai-setup.sql",
  "push-setup.sql",
  
  # Cotizaciones / Facturación
  "cotizaciones-setup.sql",
  "facturacion-setup.sql",
  "notas-credito-debito-setup.sql",
  "anular-factura-setup.sql",
  "cobranza-setup.sql",
  
  # Catálogo / Productos
  "catalogo-setup.sql",
  "unidades-setup.sql",
  
  # SRM / Compras
  "srm-setup.sql",
  "sugerencias-oc-setup.sql",
  "pagos-setup.sql",
  "facturas-proveedor-setup.sql",
  "scorecard-setup.sql",
  "alertas-vencimiento-setup.sql",
  "historial-precios-setup.sql",
  "alternativas-setup.sql",
  
  # WhatsApp
  "whatsapp-setup.sql",
  
  # Inventario
  "inventario-setup.sql",
  "ajuste-inventario-setup.sql",
  
  # Contabilidad
  "accounting-setup.sql",
  "cuentas-pagar-cobrar-setup.sql",
  "conciliacion-setup.sql",
  "calendario-cierre-setup.sql",
  "tipos-cambio-setup.sql",
  "flujo-efectivo-setup.sql",
  "consolidacion-setup.sql",
  "consolidacion-avanzada-setup.sql",
  "holding-setup.sql",
  "reportes-consolidados-setup.sql",
  
  # RRHH
  "rrhh-setup.sql",
  "rrhh-asistencia-setup.sql",
  "rrhh-biometrico-setup.sql",
  "rrhh-turnos-setup.sql",
  "rrhh-turnos-rediseno-setup.sql",
  "rrhh-control-horario-setup.sql",
  "rrhh-organigrama-setup.sql",
  "rrhh-reportes-setup.sql",
  "feriados-setup.sql",
  
  # Nómina
  "nomina-setup.sql",
  "nomina-asientos-setup.sql",
  "nomina-orden-calculo.sql",
  "nomina-complementario-fix.sql",
  
  # Fixes (si existen)
  "reports-setup.sql"
)

function Generar-Combinado {
  Write-Host "Generando SQL combinado..." -ForegroundColor Cyan
  
  $combined = @()
  $combined += "-- ============================================================"
  $combined += "-- Migración combinada: SaaS Empresarial"
  $combined += "-- Generado: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
  $combined += "-- Proyecto: $SupabaseRef"
  $combined += "-- ============================================================"
  $combined += ""
  
  foreach ($file in $orden) {
    $path = Join-Path $docsPath $file
    if (Test-Path $path) {
      $content = Get-Content $path -Raw
      $combined += "-- ============================================================"
      $combined += "-- Archivo: $file"
      $combined += "-- ============================================================"
      $combined += $content.Trim()
      $combined += ""
      $combined += ""
      Write-Host "  ✓ $file" -ForegroundColor Green
    } else {
      Write-Host "  ✗ $file (no encontrado)" -ForegroundColor Yellow
    }
  }
  
  $combined -join "`r`n" | Out-File -FilePath $outputPath -Encoding utf8
  Write-Host "`nCombinado generado: $outputPath" -ForegroundColor Green
  Write-Host "Tamaño: $((Get-Item $outputPath).Length / 1KB) KB" -ForegroundColor Cyan
  Write-Host "`nInstrucciones:" -ForegroundColor Yellow
  Write-Host "1. Ir a https://supabase.com/dashboard/project/$SupabaseRef/sql/new"
  Write-Host "2. Copiar el contenido de $outputPath"
  Write-Host "3. Pegar en el SQL Editor y ejecutar"
  Write-Host "4. Si da error por tamaño, ejecutar en partes (cada archivo individualmente)"
}

function Ejecutar-ViaAPI {
  if (-not $ManagementApiKey) {
    Write-Host "ERROR: Se necesita ManagementApiKey para el modo api" -ForegroundColor Red
    Write-Host "Obtenela en: https://supabase.com/dashboard/project/$SupabaseRef/settings/api" -ForegroundColor Yellow
    Write-Host "Usá la 'service_role' key (NO la anon key)" -ForegroundColor Yellow
    exit 1
  }
  
  $url = "https://api.supabase.com/v1/projects/$SupabaseRef/sql"
  $headers = @{
    "Authorization" = "Bearer $ManagementApiKey"
    "Content-Type" = "application/json"
  }
  
  foreach ($file in $orden) {
    $path = Join-Path $docsPath $file
    if (-not (Test-Path $path)) {
      Write-Host "  ✗ $file (no encontrado)" -ForegroundColor Yellow
      continue
    }
    
    $query = Get-Content $path -Raw
    $body = @{ "query" = $query } | ConvertTo-Json
    
    Write-Host "  → $file ... " -NoNewline
    try {
      $response = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body -ContentType "application/json"
      Write-Host "OK" -ForegroundColor Green
    } catch {
      Write-Host "ERROR" -ForegroundColor Red
      Write-Host "    $($_.Exception.Message)" -ForegroundColor Red
    }
  }
}

# --- MAIN ---
switch ($Mode) {
  "generate" { Generar-Combinado }
  "api" { Ejecutar-ViaAPI }
  default { Generar-Combinado }
}
