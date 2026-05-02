#!/usr/bin/env node
/**
 * Database migration runner for Kengs Landing.
 *
 * Reads Flyway-style SQL files from db/migrations/ and applies them
 * in order, tracking state in a _migrations table.
 *
 * Usage:
 *   node scripts/migrate.mjs                  # apply pending migrations
 *   node scripts/migrate.mjs --status         # show applied vs pending
 *   node scripts/migrate.mjs --dry-run        # show what would be applied
 *
 * Requires DATABASE_URL env var (Supabase pooler or direct connection).
 * Falls back to .dev.vars if DATABASE_URL is not set.
 */

import postgres from 'postgres'
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(__dirname, '..', 'db', 'migrations')

// ── Config ──────────────────────────────────────────────────────────────────

function getDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL

  // Fall back to .dev.vars
  try {
    const devVars = readFileSync(join(__dirname, '..', '.dev.vars'), 'utf8')
    const match = devVars.match(/^DATABASE_URL=(.+)$/m)
    if (match) return match[1].trim()
  } catch {}

  console.error('❌ DATABASE_URL not set. Add it to .dev.vars or export it.')
  console.error('   Format: postgresql://postgres.[ref]:[password]@[host]:6543/postgres')
  process.exit(1)
}

// ── Migration discovery ─────────────────────────────────────────────────────

function discoverMigrations() {
  return readdirSync(migrationsDir)
    .filter(name => /^V\d{3}__.+\.sql$/.test(name))
    .sort()
    .map(name => {
      const match = name.match(/^V(\d{3})__(.+)\.sql$/)
      return {
        version: Number(match[1]),
        name,
        slug: match[2],
        sql: readFileSync(join(migrationsDir, name), 'utf8').trim(),
      }
    })
}

// ── Migration tracking table ────────────────────────────────────────────────

async function ensureTrackingTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      version     INTEGER     PRIMARY KEY,
      name        TEXT        NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      checksum    TEXT        NOT NULL
    )
  `
}

async function getAppliedVersions(sql) {
  const rows = await sql`SELECT version, name, applied_at, checksum FROM _migrations ORDER BY version`
  return new Map(rows.map(r => [r.version, r]))
}

function checksum(content) {
  // Simple hash — not crypto, just drift detection
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return hash.toString(16)
}

// ── Commands ────────────────────────────────────────────────────────────────

async function showStatus(sql, migrations, applied) {
  console.log(`\n📊 Migration Status`)
  console.log(`   ${migrations.length} total, ${applied.size} applied, ${migrations.length - applied.size} pending\n`)

  for (const m of migrations) {
    const a = applied.get(m.version)
    if (a) {
      const drift = checksum(m.sql) !== a.checksum ? ' ⚠️  CHECKSUM MISMATCH' : ''
      console.log(`   ✅ V${String(m.version).padStart(3, '0')} ${m.slug} — applied ${new Date(a.applied_at).toISOString().slice(0, 10)}${drift}`)
    } else {
      console.log(`   ⏳ V${String(m.version).padStart(3, '0')} ${m.slug} — pending`)
    }
  }
  console.log()
}

async function applyMigrations(sql, migrations, applied, dryRun) {
  const pending = migrations.filter(m => !applied.has(m.version))

  if (pending.length === 0) {
    console.log('✅ All migrations already applied. Nothing to do.')
    return 0
  }

  // Check for checksum drift on applied migrations
  for (const m of migrations) {
    const a = applied.get(m.version)
    if (a && checksum(m.sql) !== a.checksum) {
      console.error(`⚠️  V${String(m.version).padStart(3, '0')} ${m.slug} has been modified after application!`)
      console.error('   Migrations are append-only. This needs manual resolution.')
      process.exit(1)
    }
  }

  console.log(`\n🚀 Applying ${pending.length} pending migration(s)${dryRun ? ' (DRY RUN)' : ''}:\n`)

  for (const m of pending) {
    const label = `V${String(m.version).padStart(3, '0')} ${m.slug}`

    if (dryRun) {
      console.log(`   📝 Would apply: ${label}`)
      continue
    }

    try {
      await sql.begin(async tx => {
        // Execute the migration SQL
        await tx.unsafe(m.sql)
        // Record it
        await tx`
          INSERT INTO _migrations (version, name, checksum)
          VALUES (${m.version}, ${m.name}, ${checksum(m.sql)})
        `
      })
      console.log(`   ✅ Applied: ${label}`)
    } catch (err) {
      console.error(`   ❌ Failed: ${label}`)
      console.error(`      ${err.message}`)
      process.exit(1)
    }
  }

  if (!dryRun) {
    console.log(`\n✅ ${pending.length} migration(s) applied successfully.`)
  }
  return pending.length
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const statusOnly = args.includes('--status')
  const dryRun = args.includes('--dry-run')

  const databaseUrl = getDatabaseUrl()
  const sql = postgres(databaseUrl, {
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10,
    idle_timeout: 5,
    max: 1,
  })

  try {
    // Verify connection
    const [{ now }] = await sql`SELECT now()`
    console.log(`🔗 Connected to database (server time: ${now.toISOString().slice(0, 19)})`)

    await ensureTrackingTable(sql)
    const migrations = discoverMigrations()
    const applied = await getAppliedVersions(sql)

    if (statusOnly) {
      await showStatus(sql, migrations, applied)
    } else {
      await applyMigrations(sql, migrations, applied, dryRun)
    }
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      console.error(`❌ Cannot connect to database. Check DATABASE_URL.`)
    } else {
      console.error(`❌ ${err.message}`)
    }
    process.exit(1)
  } finally {
    await sql.end()
  }
}

main()
