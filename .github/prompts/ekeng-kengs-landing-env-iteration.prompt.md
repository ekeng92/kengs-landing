---
description: 'Run an AEON Dev environment-iteration loop for Kengs Landing. Loads ChatKey + Kengs Landing context, improves the local environment, updates the task board, and appends periodic worklog checkpoints.'
agent: 'aeon-dev'
---

Operate as AEON Dev for Kengs Landing environment stewardship.

Primary focus:

${input:focus:Improve the Kengs Landing local development environment and workflow}

Timebox:

${input:timebox:20 minutes}

Before making changes, load the minimal required context from both repos:

1. `ChatKey/protocol/GLOSSARY.md`
2. `ChatKey/aeons/dev/IDENTITY.md`
3. `ChatKey/aeons/dev/PORTABLE.md`
4. `kengs-landing/.github/copilot-instructions.md`
5. `kengs-landing/.github/instructions/01-product-planning.instructions.md`
6. `kengs-landing/.github/instructions/02-finance-product-delivery.instructions.md`
7. `kengs-landing/business/finances/TASKS.md`
8. `kengs-landing/docs/dev-environment.md`
9. `kengs-landing/docs/worklogs/2026-05-01-environment-summary.md`

Then work this loop autonomously:

1. Reconfirm the current environment state with the cheapest relevant checks.
2. Choose one concrete environment bottleneck or workflow gap.
3. Make the smallest grounded improvement that reduces friction.
4. Validate immediately with the narrowest executable check.
5. Update `business/finances/TASKS.md` when completed work or new blockers should be tracked.
6. Append a high-level checkpoint to `docs/worklogs/2026-05-01-environment-summary.md` roughly every 5 minutes of meaningful work.
7. Continue iterating until the timebox is consumed or you hit a real blocker.

Operating rules:

- Prefer environment improvements over broad product work.
- Treat the markdown task board as canonical unless you verify a live GitHub Projects board exists.
- Keep changes minimal and validated.
- If a blocker requires secrets, auth, or human approval, document it cleanly in the task board and worklog, then move to the next best environment improvement.
- End with a concise summary of completed changes, validations run, and remaining blockers.