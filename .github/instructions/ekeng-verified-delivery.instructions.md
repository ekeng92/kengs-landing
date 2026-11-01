---
description: Every change is independently reviewed, tested, verified, then committed and pushed.
applyTo: '**'
author: 'SAGE Keng + GitHub Copilot'
created: '2026-11-01'
---

# Verified Delivery

Standing authorization from SAGE Keng (2026-11-01): in this repository, every change
is verified before it ships, and a verified change is committed and pushed to the
current branch without asking. Never trade verification for speed. This is an
intentional independent copy of the ChatKey rule
(`ekeng92/chatkey`: `.github/instructions/ekeng-verified-delivery.instructions.md`,
playbook in `ekeng-verified-delivery-skill`); flag drift and ask before syncing.
It adds to, and does not replace, the task-board lifecycle in `04-ways-of-working`.

## The loop

1. **Implement.** Make the change. Write down the intent and acceptance criteria in
   plain words (what must be true), separate from how you built it.
2. **Independent review.** Dispatch a fresh-context review subagent with only the
   intent, acceptance criteria, and how to see the diff. Do not hand it your
   rationale, doubts, or suspected problems: the point is an unbiased reading that
   asks "why this way?". Triage every finding: fix it, or rebut it with evidence.
   Repeat with a fresh reviewer until nothing must-fix remains (three rounds at
   most, then tell Eric what is unresolved).
3. **Independent test.** Dispatch a fresh-context test subagent. It writes or extends
   tests from the intent and acceptance criteria (not from your implementation),
   runs them plus the full suite, and returns a short pass/fail report with repro
   commands. Fix failures in the code; if a test looks wrong, settle it against the
   acceptance criteria, not your preference. Any non-trivial production change made
   after step 2, including test-driven fixes, goes back to a fresh reviewer.
4. **Final verification (you).** Run the full build, tests, and lint fresh. Exercise
   the real behavior when it is user-visible. Read your own `git diff`. Update the
   docs the change touches.
5. **Ship.** Check the effective author and committer are
   `139284310+ekeng92@users.noreply.github.com`, and scan the diff for secrets and
   company content. Stage only the files this change touched, by explicit path
   (never `git add -A` or `git add .`); leave unrelated and pre-existing edits
   unstaged and untouched. A file holding both your hunks and someone else's is
   staged by hunk (`git add -p`) or left out. Commit in logical units. Before
   pushing, `git log @{u}..HEAD` must list only this change's commits (no upstream:
   check `git log origin/HEAD..HEAD`, then `git push -u origin HEAD`); if it lists
   others' commits or HEAD is detached, stop and report. Push the current branch and
   confirm the remote has the commit. If the push is rejected as non-fast-forward:
   fetch, rebase only your own unpushed commits, re-run step 4, push again; if it is
   still rejected, stop and report. Never `--no-verify`, never force-push, never
   amend pushed commits.

If anything is red, do not commit or push. Fix it or report the blocker.

## Keep the parent's context small

- Subagents return at most about 300 words: verdict, ranked findings with file and
  line, and the commands run. Never ask them to paste logs or full diffs back.
- One bounded job and a stop condition per subagent. At most three in parallel;
  subagents never start subagents. Use the cheapest model that can do the job, never
  one above the parent's; otherwise leave the harness defaults.
- Prefer a configured specialist (`aeon-review`, `aeon-test`, `aeon-qa`), otherwise
  `code-review` for review and `general-purpose` for testing.

## When the loop shrinks

Only prose documentation (README, specs, notes) and copy skip the two subagents; they
still get steps 4 and 5. Instruction, agent, skill and prompt files shape agent
behavior and get the full loop. A fix may use review only when a named existing test
exercises the changed behavior and you ran it and it passes. Say which steps you
skipped and why. Everything else, including config that changes behavior
(migrations, `wrangler.toml`, workflows), gets the full loop.

## Branch and task board

Push goes to the current branch. The task-board "review" state in
`04-ways-of-working` still means pushed to `origin/main` (and deployed): when work
is on a feature branch, say plainly that it is pushed but not yet on `main`, and do
not move the task to `review` until it is.

## Verification commands for this repository

Run from `backend/` exactly what CI runs (`.github/workflows/ci.yml`):

- `npm run typecheck`, `npm test` (all tests, not only new ones),
  `npm run check:migrations`, `npm run check:frontend`.
- New or changed migration in `backend/db/migrations`: also `npm run migrate:dry-run`.
- Frontend and dashboard changes: open the page and exercise it; the repo-level
  `cypress/` e2e suite is available when the flow warrants it.
