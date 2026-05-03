# Telegram Bot Scope for Keng's Landing

Status: draft
Owner: AEON Watch
Related task: AEON-027
Related implementation contract: `docs/specs/telegram-api-command-contract.md` (AEON-035)
Created: 2026-05-02

## Purpose

Telegram should be the fast-entry operating surface for Keng's Landing: Eric sends short natural-language updates, OpenClaw turns them into safe API mutations, and the deployed dashboard remains the source of truth.

The bot should not become a second dashboard. It should handle capture, nudges, quick lookup, and narrow operational actions that are painful to do from a browser on mobile.

## Recommended Architecture

Use **OpenClaw agent tooling first**, backed by the existing Keng's Landing API.

Why:

- OpenClaw already receives Telegram messages and has the agent context to interpret terse commands.
- The backend API already owns persistence, auth, validation, and dashboard updates.
- Natural-language parsing belongs closer to the agent than to a Hono webhook route.
- It avoids creating a second inbound auth surface before the operations model is stable.

Use a dedicated Hono webhook only later if Keng's Landing needs non-agent, deterministic bot flows such as button menus, guest-facing messages, or vendor integrations.

## Initial Capabilities

### 1. Task capture and grooming

Examples:

- "Add task: call Freestone CAD about land split"
- "Move AEON-004 to waiting, blocked on property ID"
- "What are my critical KL tasks?"
- "Remind me tomorrow to upload the golf cart bill of sale"

API surface:

- `GET /tasks?workspace_id=...`
- `POST /tasks`
- `PATCH /tasks/:idOrRef`

Guardrails:

- Default new tasks to `backlog` unless Eric explicitly says todo/urgent.
- Never move tasks to `done` without explicit command.
- Ask one clarification if the requested target task is ambiguous.

### 2. Expense capture prompts

Examples:

- "Log $42.17 Home Depot for 360 supplies"
- "That $500 ATM withdrawal was for Jeff Yancey labor"
- "FB Marketplace table was STR furniture"

API surface:

- Current expense routes if available for create/update.
- If the exact expense cannot be matched, create a review task instead of guessing.

Guardrails:

- No destructive edits.
- Keep uncategorized or uncertain items in Review.
- Capture source text in notes for audit trail.

### 3. Booking and guest ops quick lookup

Examples:

- "Any check-ins this weekend?"
- "Show next 360 booking"
- "Create guest-book task for hot tub instructions"

API surface:

- `GET /bookings`
- `GET /dashboard/metrics`
- `POST /tasks`

Guardrails:

- Read-only for bookings in the first phase unless Eric explicitly asks for a supported mutation.
- Do not message guests or vendors through Telegram without a separate approval path.

### 4. Morning / situational briefings

Examples:

- "KL brief"
- "What needs my attention?"

Brief should include:

- Unblocked critical/high tasks
- Waiting tasks needing Eric
- Failed health checks or import issues
- Upcoming bookings/check-ins if API supports it
- One recommended next action

Guardrails:

- One compact digest, not scattered notifications.
- No routine heartbeat noise when everything is normal.

## Command Shape

Support both terse commands and natural language:

- `task add ...`
- `task update AEON-004 ...`
- `expense note ...`
- `booking next`
- `kl brief`

Natural-language messages should be interpreted conservatively:

1. Identify intent.
2. Identify target resource.
3. Check ambiguity.
4. Perform safe API call or ask one clarification.
5. Reply with the resulting task/ref or summary.

## Safety Model

Allowed without extra confirmation from Eric:

- Read task/booking/dashboard data.
- Create backlog/todo tasks from explicit user text.
- Add clarification notes or blocked reason to an existing task when the task is explicit.
- Add audit notes to an expense when the expense is explicitly identified.

Require confirmation:

- Delete/archive anything.
- Mark tasks done.
- Commit financial records from review to final.
- Send messages to guests, vendors, CPA, or public channels.
- Change auth/users/workspace settings.

Fallback behavior:

- If the agent is uncertain, create a backlog task with the raw text rather than silently dropping it.
- If an API mutation fails, report the failure and do not retry in a loop.

## Phase Plan

### Phase 1 — Agent-mediated ops

- Add OpenClaw-side helper patterns for tasks.
- Support task add/list/update for explicit commands.
- Support `kl brief` read-only summary.
- Log every mutation in the Telegram reply with the affected ref code.

### Phase 2 — Finance annotation

- Add expense lookup/update flows for review items.
- Support receipt/context capture from Telegram text.
- Preserve original message text for tax audit trail.

### Phase 3 — Guided workflows

- Add recurring prompts for weekly review, missing receipts, and upcoming guest ops.
- Add richer frontend links in replies so Eric can jump from Telegram to the dashboard.

### Phase 4 — Dedicated webhook only if needed

Consider a Hono Telegram webhook when requirements become deterministic product behavior rather than agent behavior:

- Inline buttons / menus
- Guest-facing automations
- Multi-user team flows
- Vendor message routing
- SLA-style notifications independent of OpenClaw

## Phase 1 MVP Acceptance Criteria

Phase 1 is ready when Eric can use Telegram for the minimum operating loop without opening VS Code:

- Create a Keng's Landing task from a short Telegram message and receive the new `AEON-NNN` ref.
- List critical/high Keng's Landing tasks with compact titles, status, and blockers.
- Update an explicit task's status, blocked reason, or clarification notes when the ref code is present.
- Request `kl brief` and receive one compact digest with: critical unblocked tasks, waiting tasks needing Eric, health/import warnings, and one recommended next action.
- Every mutation reply includes what changed, the affected ref code, and a dashboard link when available.
- Ambiguous commands ask one clarification instead of guessing.

## Implementation Notes for AEON Dev

For the concrete Phase 1 command/API contract, see `docs/specs/telegram-api-command-contract.md`.

Prefer a thin OpenClaw-side command layer that calls the deployed Keng's Landing API with the existing agent API key:

- Keep command parsing conservative and intent-based, not a broad financial-autonomy agent.
- Reuse the existing `/tasks` API first; do not add backend routes until a missing capability is proven.
- Centralize task API calls behind small helpers: `listTasks`, `createTask`, `patchTask`, `getTask`.
- Add a dry-run/preview path for any future financial mutation before it can commit records.
- Log raw inbound command text into task/expense notes where it affects tax or audit context.

## First Commands to Wire

1. `kl brief`
2. `task add <text>`
3. `task list [critical|high|waiting|todo]`
4. `task update AEON-NNN <field/change>`
5. Natural-language aliases for the same four intents.

## Open Questions

- Should Telegram-created tasks default to `backlog` or `todo` for Eric? Recommendation: backlog unless urgency is explicit.
- Should expense commands create draft expenses, or only annotate existing review rows? Recommendation: annotate/review first.
- Should morning briefings be proactive or only on command? Recommendation: proactive only for critical blockers/failures; otherwise on `kl brief`.
