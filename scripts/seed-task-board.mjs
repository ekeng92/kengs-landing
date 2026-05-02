#!/usr/bin/env node
/**
 * Seed the Kengs Landing task board from TASKS.md content.
 *
 * Parses the markdown task list and creates tasks via the backend API.
 * Uses DEV_BYPASS_AUTH so no JWT needed — just hit the local dev server
 * which connects to production Supabase.
 *
 * Usage:
 *   # Start wrangler dev first:  cd backend && npx wrangler dev
 *   node scripts/seed-task-board.mjs
 *   node scripts/seed-task-board.mjs --dry-run    # Preview without creating
 *   node scripts/seed-task-board.mjs --prod        # Hit prod API directly (needs auth)
 *
 * author: AEON Dev | created: 2026-05-02
 */

const API_BASE = process.argv.includes('--prod')
  ? 'https://kengs-landing-api.kengs-landing.workers.dev'
  : 'http://localhost:8787'

const DRY_RUN = process.argv.includes('--dry-run')
const WORKSPACE_ID = 'b0604861-b7ae-4f1e-a7cb-fe066d57c623'

// V016 migration (due_date, effort, context, blocked_reason) may not be applied
// to production Supabase yet. Strip those fields unless --full-schema is passed.
const FULL_SCHEMA = process.argv.includes('--full-schema')
const V016_FIELDS = ['due_date', 'effort', 'context', 'blocked_reason']

// When backend route sends V016 fields regardless, bypass it and hit Supabase directly.
const DIRECT_SUPABASE = process.argv.includes('--direct')
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ubfvhzepyizfjmghkhyh.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// ─── Task definitions parsed from TASKS.md ───────────────────────────────────
// Each task maps to the API contract: title, description, status, priority, project, tags, etc.

const tasks = [
  // ── Priority — Tax Prep / Depreciation ──
  {
    title: 'Pull Freestone County tax assessment',
    description: 'Need land vs building value split for 27.5-year depreciation calculation. Check Freestone County CAD website or 2025 property tax statement.',
    status: 'todo',
    priority: 'critical',
    project: 'kengs-landing',
    tags: ['tax', 'depreciation'],
    context: 'computer',
    effort: 'deep',
  },
  {
    title: 'Get golf cart bill of sale',
    description: 'Need documentation for Section 179 election ($2,400). Check texts/FB Marketplace messages.',
    status: 'todo',
    priority: 'high',
    project: 'kengs-landing',
    tags: ['tax', 'documentation'],
    context: 'phone',
    effort: 'errand',
  },
  {
    title: 'Categorize pre-service expenses into tax buckets',
    description: '94 expenses tagged Pre-Service ($18K+). Need to split into: (1) capital improvements (add to basis, depreciate 27.5yr), (2) startup costs (up to $5K deducted year 1, remainder amortized 15yr).',
    status: 'todo',
    priority: 'high',
    project: 'kengs-landing',
    tags: ['tax', 'expenses', 'depreciation'],
    context: 'computer',
    effort: 'deep',
  },
  {
    title: 'Build Depreciation Schedule sheet',
    description: 'Add to Excel tracker once assessment data and placed-in-service date are confirmed. Blocked on Freestone County tax assessment.',
    status: 'waiting',
    priority: 'high',
    project: 'kengs-landing',
    tags: ['tax', 'depreciation'],
    context: 'computer',
    effort: 'deep',
    blocked_reason: 'Waiting on Freestone County tax assessment data',
  },

  // ── Review Items ──
  {
    title: 'Categorize Home Depot / Lowe\'s charges',
    description: '~19 from Robinhood CC + 2 from Chase CC. Keep in Review, export HD/Lowe\'s transaction history later to categorize.',
    status: 'todo',
    priority: 'medium',
    project: 'kengs-landing',
    tags: ['review', 'expenses'],
    context: 'computer',
    effort: 'deep',
  },
  {
    title: 'Classify FB Marketplace purchases',
    description: '~$350 total, 5 items. Determine which are STR furniture/supplies vs personal.',
    status: 'todo',
    priority: 'medium',
    project: 'kengs-landing',
    tags: ['review', 'expenses'],
    context: 'phone',
    effort: 'quick',
  },
  {
    title: 'Verify ATM withdrawal $500 context',
    description: 'Check texts for Jeff Yancey payment context.',
    status: 'todo',
    priority: 'medium',
    project: 'kengs-landing',
    tags: ['review', 'expenses'],
    context: 'phone',
    effort: 'quick',
  },
  {
    title: 'Reconstruct unaccounted cash $3,400',
    description: 'Do NOT report until documented. Try to reconstruct from texts/receipts.',
    status: 'todo',
    priority: 'high',
    project: 'kengs-landing',
    tags: ['review', 'expenses', 'tax'],
    context: 'phone',
    effort: 'deep',
  },

  // ── Data Imports ──
  {
    title: 'Import Amazon orders',
    description: 'Option C deferred. Export Amazon order history CSV, match ~$6,188 across 181 transactions to STR vs personal.',
    status: 'backlog',
    priority: 'medium',
    project: 'kengs-landing',
    tags: ['import', 'expenses'],
    context: 'computer',
    effort: 'deep',
  },
  {
    title: 'Run VRBO import with real CSV',
    description: 'Export a reservation CSV from VRBO dashboard, run python import-vrbo-csv.py --detect <file> first, then do the live import.',
    status: 'todo',
    priority: 'medium',
    project: 'kengs-landing',
    tags: ['import', 'bookings'],
    context: 'computer',
    effort: 'quick',
  },

  // ── Dashboard / Reporting ──
  {
    title: 'Build Depreciation Schedule in dashboard',
    description: 'Blocked on tax assessment data. Add depreciation schedule view to the deployed dashboard.',
    status: 'waiting',
    priority: 'medium',
    project: 'kengs-landing',
    tags: ['dashboard', 'tax', 'depreciation'],
    context: 'computer',
    effort: 'deep',
    blocked_reason: 'Waiting on Freestone County tax assessment',
  },
  {
    title: 'Annual CC statement archive',
    description: 'At year-end, download full Robinhood CC + Chase transaction histories to finances/2026/.',
    status: 'backlog',
    priority: 'low',
    project: 'kengs-landing',
    tags: ['reporting', 'archive'],
    context: 'computer',
    effort: 'quick',
  },

  // ── Task Board / Executive Function ──
  {
    title: 'Weekly board sweep automation',
    description: 'Surface stale In Progress, due Waiting tasks, and top 3 next actions. Could be a scheduled AEON Watch job.',
    status: 'backlog',
    priority: 'medium',
    project: 'kengs-landing',
    tags: ['automation', 'aeon-watch'],
    context: 'computer',
    effort: 'deep',
  },

  // ── Backend Engineering ──
  {
    title: 'Add pagination to list endpoints',
    description: 'Bookings, expenses, mileage, tasks all return all rows. Add limit/offset query params following a shared pattern. Required before dataset grows.',
    status: 'backlog',
    priority: 'medium',
    project: 'kengs-landing',
    tags: ['backend', 'api'],
    context: 'computer',
    effort: 'deep',
  },
  {
    title: 'Add void endpoints for bookings and expenses',
    description: 'Committed records have a status field but no transition to voided. Add PATCH /:id/void for both entities with audit trail.',
    status: 'backlog',
    priority: 'medium',
    project: 'kengs-landing',
    tags: ['backend', 'api'],
    context: 'computer',
    effort: 'deep',
  },
  {
    title: 'Wire import job status auto-update',
    description: 'Parse-bookings and parse-expenses routes don\'t update job.status to parsed/flagged after row creation. Job lifecycle stalls at uploaded.',
    status: 'backlog',
    priority: 'medium',
    project: 'kengs-landing',
    tags: ['backend', 'import'],
    context: 'computer',
    effort: 'quick',
  },
  {
    title: 'Add Supabase Storage binding',
    description: 'Import routes reference signed URLs and storage_path but no Storage binding exists in wrangler.toml. Needed for file upload support.',
    status: 'backlog',
    priority: 'medium',
    project: 'kengs-landing',
    tags: ['backend', 'infrastructure'],
    context: 'computer',
    effort: 'deep',
  },

  // ── AEON Watch Suggestions ──
  {
    title: 'Create monthly close checklist',
    description: 'Turn the current finance workflow into a repeatable month-end sequence: import statements, review uncategorized expenses, reconcile bookings, archive receipts, export tax snapshot.',
    status: 'backlog',
    priority: 'medium',
    project: 'kengs-landing',
    tags: ['automation', 'finance', 'aeon-watch'],
    context: 'computer',
    effort: 'deep',
  },
  {
    title: 'Tax-prep packet export',
    description: 'One-click/year-end bundle for CPA: Schedule E worksheet, depreciation schedule, mileage log, categorized expenses, booking revenue, and source audit trail.',
    status: 'backlog',
    priority: 'medium',
    project: 'kengs-landing',
    tags: ['reporting', 'tax', 'aeon-watch'],
    context: 'computer',
    effort: 'deep',
  },
  {
    title: 'Build review queue guardrails',
    description: 'Flag transactions over a threshold, missing receipts, ambiguous vendor categories, duplicate-looking expenses, and pre-service vs operational edge cases.',
    status: 'backlog',
    priority: 'low',
    project: 'kengs-landing',
    tags: ['automation', 'finance', 'aeon-watch'],
    context: 'computer',
    effort: 'deep',
  },
  {
    title: 'Property-level profitability view',
    description: 'Compare 360 / Ironwood / Marlow by revenue, expenses, mileage allocation, supplies, capex, and owner cash recovery.',
    status: 'backlog',
    priority: 'low',
    project: 'kengs-landing',
    tags: ['dashboard', 'finance'],
    context: 'computer',
    effort: 'deep',
  },
  {
    title: 'Operations evidence vault',
    description: 'Link receipts, invoices, deeds, insurance, lease docs, maintenance records, and improvement photos to the relevant property/tax bucket.',
    status: 'backlog',
    priority: 'low',
    project: 'kengs-landing',
    tags: ['operations', 'documentation'],
    context: 'computer',
    effort: 'deep',
  },
  {
    title: 'Booking platform reconciliation',
    description: 'Compare Airbnb/VRBO payouts, fees, taxes, cleaning fees, refunds, and deposits against bank deposits so revenue ties out cleanly.',
    status: 'backlog',
    priority: 'medium',
    project: 'kengs-landing',
    tags: ['finance', 'reconciliation', 'aeon-watch'],
    context: 'computer',
    effort: 'deep',
  },

  // ── AEON Watch / Infrastructure ──
  {
    title: 'Define Telegram bot scope for Kengs Landing',
    description: 'The bot is live via openclaw but has no Kengs Landing tasks wired to it. Define what it should handle: booking alerts, expense prompts, task nudges, morning briefings. Then decide: openclaw agent tool, or dedicated Hono webhook route in the backend.',
    status: 'todo',
    priority: 'high',
    project: 'kengs-landing',
    tags: ['telegram', 'aeon-watch', 'automation'],
    context: 'computer',
    effort: 'deep',
  },
  {
    title: 'Weekly board sweep automation',
    description: 'Surface stale In Progress items, due Waiting tasks, and top 3 next actions automatically.',
    status: 'backlog',
    priority: 'medium',
    project: 'kengs-landing',
    tags: ['automation', 'aeon-watch'],
    context: 'computer',
    effort: 'deep',
  },
  {
    title: 'AEON Watch ops dashboard',
    description: 'Status page or dashboard view for gateway health, tasks audit, cron jobs, repo sync status, and recent work log.',
    status: 'backlog',
    priority: 'low',
    project: 'kengs-landing',
    tags: ['dashboard', 'aeon-watch', 'infrastructure'],
    context: 'computer',
    effort: 'deep',
  },
  {
    title: 'Define standing autonomy levels',
    description: 'Document which actions AEON Watch can do silently, which need approval, and which are never allowed without Eric.',
    status: 'backlog',
    priority: 'medium',
    project: 'kengs-landing',
    tags: ['aeon-watch', 'governance'],
    context: 'computer',
    effort: 'deep',
  },
  {
    title: 'Validate openclaw memory recall end-to-end',
    description: 'Memory-lancedb initializes and stores to ~/.openclaw/memory/lancedb but lazy-init means the DB hasn\'t been created yet. Send a test message via Telegram and confirm recall works.',
    status: 'todo',
    priority: 'medium',
    project: 'aeon-infra',
    tags: ['openclaw', 'memory', 'validation'],
    context: 'computer',
    effort: 'quick',
  },
  {
    title: 'Fix skills-remote bin probe timeout',
    description: 'Every gateway restart logs remote bin probe timed out for 44 required bins. Investigate if the node service needs to be installed (openclaw node install) or if it\'s a connectivity issue.',
    status: 'backlog',
    priority: 'low',
    project: 'aeon-infra',
    tags: ['openclaw', 'debugging'],
    context: 'computer',
    effort: 'deep',
  },
  {
    title: 'Implement tool-level security restrictions',
    description: 'The cleared denyCommands used invalid command names. The original intent (block camera, SMS, contacts, calendar) needs to be reimplemented via tools.exec policy or by disabling specific skill plugins.',
    status: 'backlog',
    priority: 'medium',
    project: 'aeon-infra',
    tags: ['openclaw', 'security'],
    context: 'computer',
    effort: 'deep',
  },

  // ── Product Vision (new) ──
  {
    title: 'Make deployed site the management hub',
    description: 'Kengs Landing website should be the operating system for the business. All tasks, finances, guest docs, operations — managed from the browser, not VS Code. Agents interact through Telegram/OpenClaw, mutations flow through the API, dashboard reflects reality.',
    status: 'todo',
    priority: 'critical',
    project: 'kengs-landing',
    tags: ['product', 'vision', 'architecture'],
    context: 'computer',
    effort: 'deep',
  },
  {
    title: 'Surface operations docs on website',
    description: 'Guest book, WiFi QR codes, cleaning checklists, house rules — all should be viewable and editable through the deployed site, not just as files in the repo.',
    status: 'backlog',
    priority: 'high',
    project: 'kengs-landing',
    tags: ['product', 'operations', 'frontend'],
    context: 'computer',
    effort: 'deep',
  },
  {
    title: 'Wire Telegram → API for task/operations commands',
    description: 'Text on Telegram to create tasks, update guest book, update finances, finish tasks. OpenClaw agent should call the Kengs Landing API to make changes that reflect on the dashboard.',
    status: 'backlog',
    priority: 'high',
    project: 'kengs-landing',
    tags: ['telegram', 'automation', 'product'],
    context: 'computer',
    effort: 'deep',
  },
]

// Remove duplicate "Weekly board sweep automation" - keep only the first
const seen = new Set()
const dedupedTasks = tasks.filter(t => {
  if (seen.has(t.title)) return false
  seen.add(t.title)
  return true
})

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🎯 Seeding ${dedupedTasks.length} tasks`)
  console.log(`   Workspace: ${WORKSPACE_ID}`)
  console.log(`   Mode: ${DIRECT_SUPABASE ? 'Direct Supabase REST' : `API at ${API_BASE}`}`)
  if (DRY_RUN) console.log('   🔍 DRY RUN — no tasks will be created\n')

  if (DIRECT_SUPABASE && !SUPABASE_KEY) {
    console.error('   ❌ SUPABASE_SERVICE_ROLE_KEY env var required for --direct mode')
    console.error('   Source it from backend/.dev.vars\n')
    process.exit(1)
  }

  // Health check
  if (!DIRECT_SUPABASE) {
    try {
      const health = await fetch(`${API_BASE}/health`)
      if (!health.ok) throw new Error(`Health check failed: ${health.status}`)
      console.log('   ✅ API health check passed\n')
    } catch (err) {
      console.error(`   ❌ Cannot reach API at ${API_BASE}`)
      console.error(`   Start the dev server: cd backend && npx wrangler dev\n`)
      process.exit(1)
    }
  } else {
    console.log('   ✅ Direct Supabase mode\n')
  }

  // Check for existing tasks to avoid duplicates
  let existingTitles
  if (DIRECT_SUPABASE) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/tasks?workspace_id=eq.${WORKSPACE_ID}&select=title`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    )
    const rows = await res.json()
    existingTitles = new Set(rows.map(r => r.title))
  } else {
    const res = await fetch(`${API_BASE}/tasks?workspace_id=${WORKSPACE_ID}`, {
      headers: { 'Content-Type': 'application/json' },
    })
    const json = await res.json()
    existingTitles = new Set((json.data || []).map(t => t.title))
  }
  console.log(`   📋 ${existingTitles.size} tasks already exist in the database\n`)

  let created = 0
  let skipped = 0

  for (const task of dedupedTasks) {
    if (existingTitles.has(task.title)) {
      console.log(`   ⏭  Skip (exists): ${task.title}`)
      skipped++
      continue
    }

    if (DRY_RUN) {
      console.log(`   📝 Would create: [${task.status}/${task.priority}] ${task.title}`)
      created++
      continue
    }

    if (DIRECT_SUPABASE) {
      // Build the row directly — no route handler in the way
      // ref_number and ref_code are auto-generated by the DB (trigger/sequence)
      const now = new Date().toISOString()
      const row = {
        workspace_id: WORKSPACE_ID,
        title: task.title,
        description: task.description || null,
        status: task.status === 'waiting' ? 'backlog' : task.status,
        priority: task.priority || 'medium',
        project: task.project || null,
        tags: task.tags || [],
        created_by: '00000000-0000-0000-0000-000000000001',
        assigned_to: null,
        created_at: now,
        updated_at: now,
      }

      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/tasks`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify(row),
        })

        if (res.ok) {
          const [inserted] = await res.json()
          console.log(`   ✅ Created: ${inserted?.ref_code ?? '???'} — ${task.title}`)
          created++
        } else {
          const err = await res.json().catch(() => ({}))
          console.error(`   ❌ Failed: ${task.title} — ${err.message || res.status}`)
        }
      } catch (err) {
        console.error(`   ❌ Error: ${task.title} — ${err.message}`)
      }
    } else {
      // Go through the backend API
      const body = {
        workspace_id: WORKSPACE_ID,
        ...task,
      }

      // Strip V016 fields if migration hasn't been applied
      if (!FULL_SCHEMA) {
        for (const f of V016_FIELDS) delete body[f]
        if (body.status === 'waiting') body.status = 'backlog'
      }

      try {
        const res = await fetch(`${API_BASE}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        if (res.ok) {
          const json = await res.json()
          console.log(`   ✅ Created: ${json.data?.ref_code ?? '???'} — ${task.title}`)
          created++
        } else {
          const err = await res.json().catch(() => ({}))
          console.error(`   ❌ Failed: ${task.title} — ${err.error || res.status}`)
        }
      } catch (err) {
        console.error(`   ❌ Error: ${task.title} — ${err.message}`)
      }
    }
  }

  console.log(`\n📊 Summary: ${created} created, ${skipped} skipped (already exist)`)
  console.log(`   Total in database: ${existingTitles.size + created}\n`)
}

main().catch(console.error)
