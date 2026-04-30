#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const migrationsDir = new URL('../db/migrations/', import.meta.url)
const files = readdirSync(migrationsDir)
  .filter((name) => /^V\d{3}__.+\.sql$/.test(name))
  .sort()

const failures = []
const seenVersions = new Map()
let previousVersion = 0

for (const file of files) {
  const match = file.match(/^V(\d{3})__(.+)\.sql$/)
  if (!match) continue

  const version = Number(match[1])
  const slug = match[2]

  if (seenVersions.has(version)) {
    failures.push(`Duplicate migration version V${String(version).padStart(3, '0')}: ${seenVersions.get(version)} and ${file}`)
  }
  seenVersions.set(version, file)

  if (version !== previousVersion + 1) {
    failures.push(`Migration sequence gap: expected V${String(previousVersion + 1).padStart(3, '0')} before ${file}`)
  }
  previousVersion = version

  if (!/^[a-z0-9_]+$/.test(slug)) {
    failures.push(`Migration slug must be lowercase snake_case: ${file}`)
  }

  const sql = readFileSync(join(migrationsDir.pathname, file), 'utf8').trim()
  if (!sql) failures.push(`Migration is empty: ${file}`)
}

if (files.length === 0) failures.push('No migration files found')

if (failures.length > 0) {
  console.error('Migration check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`Migration check passed: ${files.length} migrations, V001..V${String(previousVersion).padStart(3, '0')}`)
