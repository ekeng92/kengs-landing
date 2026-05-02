---
applyTo: '**'
author: 'AEON Dev Lead'
created: '2026-05-02'
lastUpdated: '2026-05-02'
---

# Ways of Working — Kengs Landing Engineering Team

> This is the onboarding document for any agent joining the Kengs Landing team. Read this first. Ask questions if anything is unclear. Do not begin work until you understand the workflow.

---

## Team Structure

| Role | Agent | Responsibility |
|------|-------|----------------|
| **SAGE** | Eric Keng (SAGE Keng) | Product owner, final reviewer, moves tasks to `done` |
| **Dev Lead** | AEON Dev Lead | Shift coordination, task assignment, work validation, shift reporting |
| **Dev** | AEON Dev (or subagents) | Implementation — code, migrations, frontend, infrastructure |
| **QA** | AEON QA | Post-dev validation, regression testing, acceptance verification |
| **Review** | AEON Review | Code review on diffs and PRs — bugs, security, conventions |
| **Test** | AEON Test | Test generation, test suite execution, test failure diagnosis |
| **PR** | AEON PR | Git operations, commit, push, PR creation |
| **Explore** | Explore | Read-only codebase research, pattern discovery, question answering |

### How Agents Join a Shift

Agents don't run persistently. The **Dev Lead** dispatches them per-task during a shift. Each dispatch is self-contained — the agent receives full context in its prompt, does the work, and reports back. Agents do not communicate with each other directly; all coordination flows through the Dev Lead.

---

## Task Lifecycle

Every piece of work is a task on the **deployed task board** (Supabase-backed, API-driven).

```
backlog → todo → in_progress → [qa_review] → review → done
                    ↑               ↑            ↑        ↑
               DEV AGENT        QA AGENT     DEV LEAD   SAGE
               implements       validates    approves   accepts
```

### States

| State | Who Moves Here | What It Means |
|-------|---------------|---------------|
| `backlog` | SAGE or Dev Lead | Idea captured, not yet prioritized |
| `todo` | SAGE or Dev Lead | Prioritized, ready for assignment |
| `in_progress` | Dev Lead assigns | A dev agent is actively working on it |
| `in_progress` (QA phase) | Dev Lead reassigns | QA agent is validating the dev output |
| `review` | Dev Lead | Work is complete, validated, pushed. Waiting for SAGE approval |
| `done` | SAGE only | Accepted and closed |
| `waiting` | Dev Lead | Blocked on SAGE input — `clarification_notes` has specific questions |

### Rules

- **ALL work must be a task.** No work happens outside the board
- **Tasks get a `session_id`** linking them to the shift that touched them
- **`assigned_agent`** tracks who is currently responsible
- **`completion_notes`** are mandatory before moving to `review` — the SAGE assesses work from notes alone
- **`clarification_notes`** must contain specific questions, not "need more info"
- **Only SAGE moves tasks to `done`.** Agents move to `review` at most

---

## The Dev → QA Handoff

This is the core quality workflow. After a dev agent completes implementation:

1. **Dev agent** reports back to Dev Lead with: files changed, what was built, any decisions made
2. **Dev Lead** does a quick sanity check (tests pass? types clean?)
3. **Dev Lead** dispatches **AEON QA** with full context:
   - Task reference and acceptance criteria
   - Dev agent's report (what was done)
   - Changed file paths
   - Work type (code, docs, migration, config, mixed)
   - Repo conventions to check against
4. **QA agent** runs the full validation workflow:
   - Runs complete test suite (not just new tests)
   - Verifies TypeScript compilation
   - Walks each acceptance criterion
   - Audits for edge cases and convention violations
   - Writes regression tests for any uncovered behavior
   - Returns a structured QA report with verdict
5. **Dev Lead** reviews the QA report:
   - **✅ APPROVED** → merge QA's regression tests, move task to `review`
   - **⚠️ APPROVED WITH NOTES** → fix warnings inline or note them, move to `review`
   - **❌ BLOCKED** → re-dispatch to dev agent with QA's findings as context, iterate

### What QA Does NOT Do

- QA does not implement features
- QA does not make architectural decisions
- QA does not skip the test suite to save time
- QA does not approve without running tests

---

## Code Conventions

### Stack

| Layer | Technology |
|-------|-----------|
| Backend | Hono.js on Cloudflare Workers, TypeScript strict |
| Frontend | Vanilla HTML/JS on Cloudflare Pages |
| Database | Supabase Postgres via PostgREST client |
| Auth | Supabase JWT + `X-API-Key` for agents |
| Testing | Vitest with `createMockSupabase()` pattern |
| Validation | Zod schemas on every endpoint |
| Migrations | Flyway-style SQL (`V###__description.sql`) |
| CI | GitHub Actions — typecheck + vitest + migration checks |

### Backend Rules

- Route files: `src/routes/<entity>.ts`, tests alongside: `<entity>.test.ts`
- All routes use `requireAuth` middleware
- All list endpoints require `workspace_id` for tenant isolation
- Never expose raw DB errors — map known codes (23505 → 409, 23503 → 422)
- No `console.log` in production — use structured logging
- Zod validation at route boundary for all inputs
- Database changes via migrations only — never raw SQL in routes

### Testing Rules

- Every route file MUST have a corresponding `.test.ts` file
- Tests use `createMockSupabase()` from `test/mock-supabase.ts`
- Required test categories per route: CRUD happy paths, input validation (Zod rejects), error handling (DB failures), business logic edge cases
- Run `npx vitest run` before every commit
- Test names must be descriptive: `'returns 409 when duplicate confirmation code'`

### Git Rules

- Always `pwd && git rev-parse --is-inside-work-tree` before `git add/commit` (multi-repo workspace)
- Long commit messages: `git commit -F /tmp/<msg>.txt` (avoids shell quote corruption)
- Never `git commit --amend` + `git push --force` on pushed commits
- `"Review" means pushed.` Code must be on `origin/main` before a task moves to `review`

### Frontend Rules

- Multi-page HTML architecture (not SPA)
- Shared app shell: `css/app-shell.css` + `js/app-shell.js`
- All pages include the shared header/nav shell
- No framework dependencies — vanilla JS with fetch API

---

## Agent Dispatch Protocol

When the Dev Lead dispatches any agent, the prompt MUST include:

1. **Identity line**: "You are being dispatched by AEON Dev Lead as work unit for task AEON-NNN."
2. **Task context**: Full title + description
3. **Exact file paths**: Not "check the routes" — `backend/src/routes/tasks.ts`
4. **Repo conventions**: Framework, test pattern, validation pattern
5. **Acceptance criteria**: Bullet list of what "done" means
6. **Known pitfalls**: Relevant learnings that prevent known mistakes
7. **Return format**: What to include in the response

### Why This Matters

Subagents get ONE chance. They don't have access to the board, the learnings file, or previous context. Everything they need must be in the prompt. A well-scoped prompt with exact file paths saves more time than three vague dispatches.

---

## Quality Gates

Before any task moves to `review`, ALL of these must be true:

- [ ] Full test suite passes (`npx vitest run` — all tests, not just new ones)
- [ ] TypeScript compiles clean (`npx tsc --noEmit`)
- [ ] Code follows repo conventions (instruction files)
- [ ] Acceptance criteria verified (walked one by one)
- [ ] Regression tests written for new behavior
- [ ] Changes committed and pushed to `origin/main`
- [ ] `completion_notes` written on the task

---

## Communication

- **SAGE → Dev Lead**: Via task board (task creation, priority, clarification answers) or direct chat
- **Dev Lead → Subagents**: Via dispatch prompts (self-contained, full context)
- **Subagents → Dev Lead**: Via return reports (files changed, test results, findings)
- **Dev Lead → SAGE**: Via shift reports and task `completion_notes`
- **Blockers**: Flagged immediately via `clarification_notes` on the task, status moved to `waiting`

### What "Waiting" Means

When a task is in `waiting`, it has specific questions in `clarification_notes`. The SAGE answers, the Dev Lead reads the answer, and work resumes. Agents never halt the entire shift for one blocker — they move to other tasks.

---

## Shift Structure

Every managed session follows this cycle:

```
SURVEY → PLAN → ASSIGN → MONITOR → REVIEW → ITERATE → REPORT
```

1. **Survey** — Query the board. What's todo? What's in progress? What's blocked?
2. **Plan** — Match tasks to agents. Build an assignment table with acceptance criteria
3. **Assign** — Update tasks on the board, dispatch subagents with full context
4. **Monitor** — Track dispatched work, read subagent reports
5. **Review** — Validate output: run tests, check types, read diffs, dispatch QA
6. **Iterate** — Fix the 20% that's not right, either inline or via targeted re-dispatch
7. **Report** — Produce shift summary for SAGE: completed, in-progress, waiting, new tasks

---

## Onboarding Checklist for New Agents

If you're reading this as a new agent joining the team:

- [ ] Read this document fully
- [ ] Read `copilot-instructions.md` for repo architecture and design principles
- [ ] Read `instructions/03-backend-conventions.instructions.md` for backend patterns
- [ ] Understand the task board API (CRUD via `/tasks` endpoint)
- [ ] Know your role — are you Dev, QA, Test, Review, or Explore?
- [ ] Ask the Dev Lead if anything is unclear — don't guess

Welcome to the team. Do good work.
