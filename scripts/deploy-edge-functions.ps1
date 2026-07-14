param(
  [Parameter(Mandatory=$true)]
  [string]$ProjectRef
)

$ErrorActionPreference = "Stop"

$functions = @(
  'company-signup',
  'get-user-permissions',
  'crear-usuario',
  'form-webhook',
  'summarize-contact',
  'draft-email',
  'send-whatsapp',
  'whatsapp-webhook',
  'cobranza-auto',
  'send-push'
)

Write-Host "=== Deploying Edge Functions to $ProjectRef ===" -ForegroundColor Cyan

foreach ($fn in $functions) {
  Write-Host "-> Deploying $fn..." -ForegroundColor Yellow
  supabase functions deploy $fn --project-ref $ProjectRef
  if ($LASTEXITCODE -eq 0) {
    Write-Host "  [OK] $fn deployed" -ForegroundColor Green
  } else {
    Write-Host "  [FAIL] $fn failed" -ForegroundColor Red
    exit 1
  }
}

Write-Host "`n=== All functions deployed ===" -ForegroundColor Cyan
Write-Host "`nNext: Set secrets in Supabase Dashboard or run:"
Write-Host "  supabase secrets set SERVICE_ROLE_KEY=<value>"
Write-Host "`nFor push notifications:"
Write-Host "  supabase secrets set VAPID_PUBLIC_KEY=<key>"
Write-Host "  supabase secrets set VAPID_PRIVATE_KEY=<key>"
Write-Host "`nGenerate VAPID keys: npx web-push generate-vapid-keys"
