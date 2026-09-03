$ErrorActionPreference = "Stop"
fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression
fnm use 20.18.0
Set-Location (Join-Path $PSScriptRoot "..")
if (-not (Test-Path "node_modules")) { npm install }
npx wrangler whoami
if ($LASTEXITCODE -ne 0) {
  Write-Host "Dang mo trinh duyet de dang nhap Cloudflare..."
  npx wrangler login
}
npm run deploy
