$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $projectRoot '.env'
if (-not (Test-Path -LiteralPath $envPath)) {
  throw "No se encontró $envPath"
}

Write-Host ''
Write-Host 'Configuración de Resend para TISNET' -ForegroundColor Cyan
Write-Host 'Crea tu API key en: https://resend.com/api-keys'
Write-Host 'La clave se guardará únicamente en tisnet-api/.env (archivo ignorado por Git).'
Write-Host ''

$secureKey = Read-Host 'Pega tu RESEND_API_KEY' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
  $apiKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
}
if (-not $apiKey.StartsWith('re_')) {
  throw 'La API key de Resend debe comenzar con re_.'
}

$mailFrom = Read-Host 'Remitente (Enter para TISNET <onboarding@resend.dev>)'
if ([string]::IsNullOrWhiteSpace($mailFrom)) {
  $mailFrom = 'TISNET <onboarding@resend.dev>'
}

$lines = [Collections.Generic.List[string]](Get-Content -LiteralPath $envPath)
function Set-EnvValue([string]$name, [string]$value) {
  for ($index = 0; $index -lt $lines.Count; $index += 1) {
    if ($lines[$index] -match ('^' + [regex]::Escape($name) + '=')) {
      $lines[$index] = "$name=$value"
      return
    }
  }
  $lines.Add("$name=$value")
}

Set-EnvValue 'NOTIFICATION_PROVIDER' 'resend'
Set-EnvValue 'RESEND_API_KEY' $apiKey
Set-EnvValue 'MAIL_FROM' $mailFrom
Set-EnvValue 'PUBLIC_FRONTEND_URL' 'http://127.0.0.1:5173'
Set-Content -LiteralPath $envPath -Value $lines -Encoding utf8

Write-Host ''
Write-Host 'Resend quedó configurado. Reinicia el backend para activar el envío real.' -ForegroundColor Green
Write-Host 'Presiona Enter para cerrar.'
[void](Read-Host)
