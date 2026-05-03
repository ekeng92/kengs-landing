# Telegram → API Command Contract

Status: draft
Owner: AEON Watch
Related tasks: AEON-035, AEON-027
Created: 2026-05-02

## Purpose

This is the handoff contract for wiring Eric's Telegram messages into safe Keng's Landing API calls. It narrows the Phase 1 surface to task operations and read-only briefs so AEON Dev can implement without inventing product behavior.

The source of truth remains the deployed Keng's Landing API and dashboard. Telegram is only the fast-entry shell.

## Phase 1 Intents

### `kl brief`

Read-only summary.

API calls:

- `GET /health`
- `GET /tasks?workspace_id=$AGENT_WORKSPACE_ID&status=todo&priority=critical`
- `GET /tasks?workspace_id=$AGENT_WORKSPACE_ID&status=todo&priority=high`
- `GET /tasks?workspace_id=$AGENT_WORKSPACE_ID&status=waiting`
- Optional: `GET /tasks?workspace_id=$AGENT_WORKSPACE_ID&status=in_progress&assigned_agent=aeon-watch`

Reply shape:

```text
KL brief:
- Health: ok|problem
- Critical/high: AEON-004 Pull Freestone County tax assessment — blocked: Needs SAGE clarification
- Waiting on Eric: ...
- Watch lane: ...
Next move: one concrete recommendation.
```

Guardrails:

- Keep to one compact digest.
- Do not mutate task state from `kl brief`.
- If health fails, put it first.

### `task add <text>`

Create a task from explicit user text.

API call:

- `POST /tasks`

Default payload:

```json
{
  "workspace_id": "$AGENT_WORKSPACE_ID",
  "title": "<short title>",
  "description": "Created from Telegram: <raw message>",
  "status": "backlog",
  "priority": "medium",
  "project": "kengs-landing",
  "tags": ["telegram"],
  "created_by": "aeon-watch"
}
```

Parsing rules:

- If Eric says `urgent`, use `priority=urgent` and `status=todo`.
- If Eric says `critical`, use `priority=critical` and `status=todo`.
- If he names a project, preserve it; otherwise default to `kengs-landing`.
- Preserve the raw inbound text in description or clarification notes.

Reply shape:

```text
Created AEON-0NN — <title> (backlog, medium).
```

### `task list [critical|high|waiting|todo|mine]`

List compact task rows.

API calls:

- `GET /tasks?workspace_id=$AGENT_WORKSPACE_ID&status=todo`
- Add `priority=critical` or `priority=high` when requested.
- Use `status=waiting` for waiting.
- Use `assigned_agent=aeon-watch` for mine.

Reply shape:

```text
Critical KL tasks:
- AEON-004 — Pull Freestone County tax assessment (todo; blocked: Needs SAGE clarification)
- AEON-006 — Categorize pre-service expenses into tax buckets (todo)
```

Guardrails:

- Prefer at most 8 rows.
- Include blocked reason when present.
- If no rows match, say so plainly.

### `task update AEON-NNN <change>`

Patch an explicit task.

API call:

- `PATCH /tasks/:idOrRef`

Allowed fields in Phase 1:

- `status`: `backlog`, `todo`, `in_progress`, `review`, `waiting`
- `priority`: `low`, `medium`, `high`, `critical`, `urgent`
- `blocked_reason`
- `clarification_notes`
- `assigned_agent`
- `session_id`
- `due_date`
- `effort`
- `context`

Require confirmation before:

- `status=done`
- `status=archived`
- title/description rewrites that discard existing context
- deleting anything

Reply shape:

```text
Updated AEON-035 — status: in_progress; assigned_agent: aeon-watch.
```

Ambiguity handling:

- If the message has no ref code and matches multiple tasks, ask one clarification.
- If the field cannot be mapped with confidence, ask one clarification.
- If the API rejects the patch, report the API error without retry loops.

## Natural-language Aliases

Support these as conservative aliases only when the intent and target are clear:

| User says | Interpret as |
|---|---|
| `What needs my attention?` | `kl brief` |
| `Show critical KL tasks` | `task list critical` |
| `Add a task to ...` | `task add ...` |
| `AEON-004 is blocked on Freestone CAD` | `task update AEON-004 blocked_reason=Freestone CAD` |
| `Put AEON-004 waiting` | `task update AEON-004 status=waiting` |
| `AEON-035 is for Watch` | `task update AEON-035 assigned_agent=aeon-watch` |

Do not infer financial mutations from casual natural language in Phase 1. If Eric says something expense-related, create or update a review task unless the exact expense API/update contract is already implemented.

## Safety / Audit Requirements

- Use the existing agent API key and `workspace_id` from OpenClaw credentials; do not expose either in replies.
- Every mutation reply must include the affected ref code and exactly what changed.
- Preserve raw Telegram text for tax, finance, and audit-related context.
- Never message guests, vendors, CPA, or public channels from this flow.
- Never delete, archive, or mark done without explicit confirmation.
- Keep all API writes serialized per inbound Telegram message.

## Implementation Handoff

Recommended helper layer:

- `listTasks(filters)`
- `getTask(refOrId)`
- `createTask(input)`
- `patchTask(refOrId, patch)`
- `buildKlBrief()`
- `parseTelegramKlIntent(text)`

Minimum tests:

- `kl brief` reads health + task filters and returns compact digest.
- `task add` defaults to backlog/medium and preserves raw text.
- `task add urgent ...` creates todo/urgent.
- `task update AEON-035 status waiting` patches only status.
- `task update` without a ref asks for clarification.
- `task update AEON-035 done` requires confirmation.
- API failures are surfaced without duplicate writes.

## Open Edge Cases

- Dashboard deep-link pattern for task refs is not documented here yet.
- Expense annotation commands need a separate Phase 2 contract after confirming expense lookup fields and review-row UX.
- Booking quick lookup should stay read-only until the `/bookings` response shape and date filters are validated against deployed data.
