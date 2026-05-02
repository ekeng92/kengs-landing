$ErrorActionPreference = 'Stop'

$backendRoot = Split-Path -Parent $PSScriptRoot
$devVarsPath = Join-Path $backendRoot '.dev.vars'
$devVarsExamplePath = Join-Path $backendRoot '.dev.vars.example'

Write-Host 'Kengs Landing backend bootstrap'
Write-Host "Backend root: $backendRoot"

if (-not (Test-Path $devVarsPath)) {
  Write-Warning ".dev.vars is missing. Copy $devVarsExamplePath to $devVarsPath and fill in Supabase credentials before running the dev server."
} else {
  Write-Host '.dev.vars found.'
}

if (-not (Test-Path (Join-Path $backendRoot 'node_modules'))) {
  Write-Host 'Installing backend dependencies with npm install...'
  Push-Location $backendRoot
  try {
    npm install
  }
  finally {
    Pop-Location
  }
} else {
  Write-Host 'node_modules already present. Skipping npm install.'
}

Write-Host 'Bootstrap check complete.'
Write-Host 'Next steps:'
Write-Host '  1. Confirm .dev.vars has valid Supabase values.'
Write-Host '  2. Run npm run typecheck.'
Write-Host '  3. Run npm run dev when config is ready.'