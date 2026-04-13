---
applyTo: '**'
---

# GitHub Operations — Keng's Landing

This repository is owned by the **ekeng92** personal GitHub account, NOT the Cotality/CoreLogic organization.

## Authentication

- All GitHub API operations (PRs, issues, releases, Actions) MUST use the **ekeng92** PAT
- The PAT is stored in `~/.config/aeon/credentials.env` as `GITHUB_AEON_PRIME_PAT`
- To use with `gh` CLI: `GH_TOKEN=$(grep GITHUB_AEON_PRIME_PAT ~/.config/aeon/credentials.env | cut -d'"' -f2) gh <command>`
- Do NOT use `gh` CLI with default auth — it resolves to the Cotality org account, not ekeng92
- When pushing, the git remote already has the PAT embedded — `git push` works without extra config
- Never hardcode or echo the PAT value in instruction files, logs, or chat output

## Repository Context

- **Remote**: `github.com/ekeng92/kengs-landing`
- **Visibility**: Private personal repo
- **No CI/CD pipelines** — this is a document/operations repo, not a code project
- **`.gitignore` pattern**: `*.ignore.*` keeps sensitive local files out of commits
