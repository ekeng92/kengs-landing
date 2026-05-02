# Keng's Landing Dev Environment

## Purpose

Keep the local workflow explicit while Keng's Landing operates as both a live finance prototype and a product transition repo.

## Workspace Shape

- Multi-repo workspace file: `C:/Users/Keng/Projects/KengRepos.code-workspace`
- Paired repos:
  - `C:/Users/Keng/Projects/kengs-landing`
  - `C:/Users/Keng/Projects/ChatKey`

ChatKey supplies the working identity and operating standards. Keng's Landing supplies the product rules, task board, and runnable surfaces.

## Context Load Order

When resuming work, load context in this order:

1. ChatKey `protocol/GLOSSARY.md`
2. ChatKey `aeons/dev/IDENTITY.md`
3. ChatKey `aeons/dev/PORTABLE.md`
4. Keng's Landing `.github/copilot-instructions.md`
5. Keng's Landing `.github/instructions/01-product-planning.instructions.md`
6. Keng's Landing `.github/instructions/02-finance-product-delivery.instructions.md`
7. Keng's Landing `business/finances/TASKS.md`

This keeps the session aligned to AEON Dev craft first, then repo-specific product and delivery rules.

## Local Workflow

### Backend API

Working directory: `backend/`

Required setup:

1. Copy `.dev.vars.example` to `.dev.vars`
2. Fill in Supabase credentials
3. Run `powershell -ExecutionPolicy Bypass -File scripts/bootstrap-dev.ps1`

Primary commands:

- `powershell -ExecutionPolicy Bypass -File scripts/bootstrap-dev.ps1`
- `npm run dev`
- `npm run typecheck`
- `npm run deploy`

VS Code tasks are checked in under `.vscode/tasks.json` for bootstrap, install, dev, and typecheck.

### Finance Prototype

Primary UI: `business/finances/dashboard.html`

The finance dashboard is still a file-based prototype. Open it directly in the browser for review and manual workflow validation.

### Task Board

Canonical local task board: `business/finances/TASKS.md`

Web view for quick review/sharing:

- `https://github.com/ekeng92/kengs-landing/blob/main/business/finances/TASKS.md`

There is currently no active GitHub Projects board for this repo.

### Environment Status

Run `powershell -ExecutionPolicy Bypass -File scripts/environment-status.ps1` from the repo root to get a quick status snapshot for:

- repo cleanliness
- backend dependency/config readiness
- GitHub CLI auth state
- task board last modified time

## Current Environment Gaps

- GitHub CLI is not authenticated on this PC, which blocks issue/PR/project automation
- The workspace file is outside the repo, so team-wide shared workspace settings remain intentionally local for now
- The finance dashboard is file-based, so there is no unified app start command across prototype and backend surfaces yet

## Immediate Next Improvements

1. Decide whether markdown remains the only task board or whether GitHub Projects should mirror it after auth is restored
2. Add a lightweight environment status report for repo sync, backend readiness, and task-board freshness
3. Reduce Windows-specific friction by deciding whether the mini PC should stay native, move to WSL2, or move to Ubuntu