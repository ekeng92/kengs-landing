// Temporary migration runner — run once then delete
// Usage: DB_PASSWORD=xxx node db/run-migrations.mjs
import postgres from 'postgres'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const password = process.env.DB_PASSWORD
if (!password) { console.error('Set DB_PASSWORD env var'); process.exit(1) }

const sql = postgres({
  host: 'db.ubfvhzepyizfjmghkhyh.supabase.co',
  port: 5432,
  database: 'postgres',
  username: 'postgres',
  password,
  ssl: { rejectUnauthorized: false },
  connect_timeout: 60,
  idle_timeout: 30,
})

const migrationsDir = new URL('./migrations', import.meta.url).pathname
const files = readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort()

console.log(`Found ${files.length} migration files`)

for (const file of files) {
  const content = readFileSync(join(migrationsDir, file), 'utf8')
  try {
    await sql.unsafe(content)
    console.log(`✓ ${file}`)
  } catch (err) {
    // Skip "already exists" errors for idempotency
    if (err.message?.includes('already exists')) {
      console.log(`⊘ ${file} (already applied)`)
    } else {
      console.error(`✗ ${file}: ${err.message}`)
      process.exit(1)
    }
  }
}

console.log('\nAll migrations complete.')
await sql.end()
