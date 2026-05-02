#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_ROOT="$REPO_ROOT/backend"
TASK_BOARD="$REPO_ROOT/business/finances/TASKS.md"
CHATKEY_PATH="$(dirname "$REPO_ROOT")/chatkey"
FRONTEND_INDEX="$REPO_ROOT/frontend/index.html"
DASHBOARD_PATH="$REPO_ROOT/business/finances/dashboard.html"

git_status_summary() {
  local path="$1"
  pushd "$path" > /dev/null
  local branch
  branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
  local changes
  changes=$(git status --short 2>/dev/null | wc -l | tr -d ' ')
  popd > /dev/null
  if [[ "$changes" -eq 0 ]]; then
    echo "branch=$branch; clean"
  else
    echo "branch=$branch; $changes uncommitted change(s)"
  fi
}

gh_auth_summary() {
  if ! command -v gh &>/dev/null; then
    echo "gh not installed"
    return
  fi
  if gh auth status &>/dev/null; then
    echo "authenticated"
  else
    echo "not authenticated"
  fi
}

node_version() {
  if command -v node &>/dev/null; then
    node --version 2>/dev/null || echo "error"
  else
    echo "not found"
  fi
}

wrangler_version() {
  if command -v wrangler &>/dev/null; then
    wrangler --version 2>/dev/null | head -1
  elif [[ -x "$BACKEND_ROOT/node_modules/.bin/wrangler" ]]; then
    "$BACKEND_ROOT/node_modules/.bin/wrangler" --version 2>/dev/null | head -1
  else
    echo "not found"
  fi
}

python_status() {
  if command -v python3 &>/dev/null; then
    local ver
    ver=$(python3 --version 2>/dev/null)
    local openpyxl
    openpyxl=$(pip3 show openpyxl 2>/dev/null | grep "^Version:" | cut -d' ' -f2)
    if [[ -n "$openpyxl" ]]; then
      echo "$ver; openpyxl $openpyxl"
    else
      echo "$ver; openpyxl MISSING - run: pip3 install openpyxl"
    fi
  else
    echo "not found"
  fi
}

tsc_check() {
  if [[ -d "$BACKEND_ROOT/node_modules" ]]; then
    pushd "$BACKEND_ROOT" > /dev/null
    local errors
    errors=$(npx tsc --noEmit 2>&1 | grep -c "error TS" || true)
    popd > /dev/null
    if [[ "$errors" -eq 0 ]]; then
      echo "clean"
    else
      echo "$errors error(s)"
    fi
  else
    echo "skipped (no node_modules)"
  fi
}

echo ""
echo "Kengs Landing Environment Status"
echo "================================"
echo "Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo "OS:   $(uname -s) $(uname -m)"
echo ""

echo "--- Repos ---"
echo "Repo:    $(git_status_summary "$REPO_ROOT")"
if [[ -d "$CHATKEY_PATH" ]]; then
  echo "ChatKey: $(git_status_summary "$CHATKEY_PATH")"
else
  echo "ChatKey: missing sibling clone"
fi

echo ""
echo "--- Runtime ---"
echo "Node.js:  $(node_version)"
echo "Wrangler: $(wrangler_version)"
echo "Python:   $(python_status)"

echo ""
echo "--- Backend ---"
echo ".dev.vars:         $(if [[ -f "$BACKEND_ROOT/.dev.vars" ]]; then echo 'present'; else echo 'MISSING - copy .dev.vars.example and fill in Supabase credentials'; fi)"
echo ".dev.vars.example: $(if [[ -f "$BACKEND_ROOT/.dev.vars.example" ]]; then echo 'present'; else echo 'missing'; fi)"
echo "node_modules:      $(if [[ -d "$BACKEND_ROOT/node_modules" ]]; then echo 'present'; else echo 'missing - run: npm install'; fi)"
echo "TypeScript:        $(tsc_check)"

echo ""
echo "--- Frontend ---"
echo "frontend/index.html: $(if [[ -f "$FRONTEND_INDEX" ]]; then echo 'present'; else echo 'missing'; fi)"
echo "finance dashboard:   $(if [[ -f "$DASHBOARD_PATH" ]]; then echo 'present'; else echo 'missing'; fi)"

echo ""
echo "--- Auth / Integrations ---"
echo "GitHub CLI: $(gh_auth_summary)"

echo ""
echo "--- Task Board ---"
if [[ -f "$TASK_BOARD" ]]; then
  local_mod=$(stat -f '%Sm' -t '%Y-%m-%d %H:%M:%S' "$TASK_BOARD" 2>/dev/null || stat -c '%y' "$TASK_BOARD" 2>/dev/null | cut -d'.' -f1)
  echo "TASKS.md updated: $local_mod"
  open_tasks=$(grep -c '^\- \[ \]' "$TASK_BOARD" 2>/dev/null || echo 0)
  done_tasks=$(grep -c '^\- \[x\]' "$TASK_BOARD" 2>/dev/null || echo 0)
  echo "Tasks: $open_tasks open, $done_tasks completed"
else
  echo "TASKS.md: not found"
fi
echo ""
