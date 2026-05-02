$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendRoot = Join-Path $repoRoot 'backend'
$taskBoardPath = Join-Path $repoRoot 'business\finances\TASKS.md'
$chatKeyPath = Join-Path (Split-Path -Parent $repoRoot) 'ChatKey'
$frontendIndexPath = Join-Path $repoRoot 'frontend\index.html'
$devVarsExamplePath = Join-Path $backendRoot '.dev.vars.example'

function Get-GitStatusSummary {
  param([string]$Path)

  Push-Location $Path
  try {
    $branch = git rev-parse --abbrev-ref HEAD
    $statusLines = git status --short
    if (-not $statusLines) {
      return "branch=$branch; clean"
    }

    return "branch=$branch; $($statusLines.Count) uncommitted change(s)"
  }
  finally {
    Pop-Location
  }
}

function Get-GhAuthSummary {
  $gh = Get-Command gh -ErrorAction SilentlyContinue
  if (-not $gh) {
    return 'gh not installed'
  }

  try {
    gh auth status *> $null
    return 'authenticated'
  }
  catch {
    return 'not authenticated'
  }
}

function Get-NodeVersion {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) { return 'not found' }
  try { return (node --version 2>&1).Trim() } catch { return 'error' }
}

function Get-WranglerVersion {
  $wrangler = Get-Command wrangler -ErrorAction SilentlyContinue
  if (-not $wrangler) {
    # Try local node_modules binary
    $localBin = Join-Path $backendRoot 'node_modules\.bin\wrangler.cmd'
    if (-not (Test-Path $localBin)) { return 'not found' }
    try { return (& $localBin --version 2>&1 | Select-Object -First 1).Trim() } catch { return 'error' }
  }
  try { return (wrangler --version 2>&1 | Select-Object -First 1).Trim() } catch { return 'error' }
}

$taskBoardItem = Get-Item $taskBoardPath
$devVarsExists = Test-Path (Join-Path $backendRoot '.dev.vars')
$nodeModulesExists = Test-Path (Join-Path $backendRoot 'node_modules')
$devVarsExampleExists = Test-Path $devVarsExamplePath
$frontendExists = Test-Path $frontendIndexPath

Write-Host ''
Write-Host 'Kengs Landing Environment Status'
Write-Host '================================'
Write-Host "Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host ''

Write-Host '--- Repos ---'
Write-Host "Repo:    $(Get-GitStatusSummary -Path $repoRoot)"
if (Test-Path $chatKeyPath) {
  Write-Host "ChatKey: $(Get-GitStatusSummary -Path $chatKeyPath)"
} else {
  Write-Host 'ChatKey: missing sibling clone'
}

Write-Host ''
Write-Host '--- Runtime ---'
Write-Host "Node.js:  $(Get-NodeVersion)"
Write-Host "Wrangler: $(Get-WranglerVersion)"

Write-Host ''
Write-Host '--- Backend ---'
Write-Host ".dev.vars:         $(if ($devVarsExists) { 'present' } else { 'MISSING - copy .dev.vars.example and fill in Supabase credentials' })"
Write-Host ".dev.vars.example: $(if ($devVarsExampleExists) { 'present' } else { 'missing' })"
Write-Host "node_modules:      $(if ($nodeModulesExists) { 'present' } else { 'missing - run: npm install' })"

Write-Host ''
Write-Host '--- Frontend ---'
Write-Host "frontend/index.html: $(if ($frontendExists) { 'present' } else { 'missing' })"
Write-Host "finance dashboard:   $(if (Test-Path (Join-Path $repoRoot 'business\finances\dashboard.html')) { 'present' } else { 'missing' })"

Write-Host ''
Write-Host '--- Auth / Integrations ---'
Write-Host "GitHub CLI: $(Get-GhAuthSummary)"

Write-Host ''
Write-Host '--- Task Board ---'
Write-Host "TASKS.md updated: $($taskBoardItem.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'))"
Write-Host ''