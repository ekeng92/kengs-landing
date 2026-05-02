$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendRoot = Join-Path $repoRoot 'backend'
$taskBoardPath = Join-Path $repoRoot 'business\finances\TASKS.md'
$chatKeyPath = Join-Path (Split-Path -Parent $repoRoot) 'ChatKey'

function Get-GitStatusSummary {
  param([string]$Path)

  Push-Location $Path
  try {
    $branch = git rev-parse --abbrev-ref HEAD
    $statusLines = git status --short
    if (-not $statusLines) {
      return "branch=$branch; clean"
    }

    return "branch=$branch; changes=$($statusLines.Count)"
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

$taskBoardItem = Get-Item $taskBoardPath
$devVarsExists = Test-Path (Join-Path $backendRoot '.dev.vars')
$nodeModulesExists = Test-Path (Join-Path $backendRoot 'node_modules')

Write-Host 'Kengs Landing Environment Status'
Write-Host '==============================='
Write-Host "Repo: $(Get-GitStatusSummary -Path $repoRoot)"

if (Test-Path $chatKeyPath) {
  Write-Host "ChatKey: $(Get-GitStatusSummary -Path $chatKeyPath)"
} else {
  Write-Host 'ChatKey: missing sibling clone'
}

Write-Host "Backend .dev.vars: $(if ($devVarsExists) { 'present' } else { 'missing' })"
Write-Host "Backend node_modules: $(if ($nodeModulesExists) { 'present' } else { 'missing' })"
Write-Host "GitHub CLI: $(Get-GhAuthSummary)"
Write-Host "Task board updated: $($taskBoardItem.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'))"