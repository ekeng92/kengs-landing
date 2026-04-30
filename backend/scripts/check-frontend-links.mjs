#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'

const repoRoot = normalize(new URL('../../', import.meta.url).pathname)
const frontendRoot = join(repoRoot, 'frontend')
const failures = []

function walk(dir) {
  const files = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) files.push(...walk(path))
    else if (path.endsWith('.html')) files.push(path)
  }
  return files
}

function isExternal(ref) {
  return /^(https?:|mailto:|tel:|#|javascript:)/i.test(ref) || ref.startsWith('data:')
}

function resolveRef(file, rawRef) {
  const ref = rawRef.split('#')[0].split('?')[0]
  if (!ref || isExternal(ref)) return null

  if (ref.startsWith('/')) {
    const withoutSlash = ref.slice(1)
    if (!withoutSlash || ref.endsWith('/')) return join(frontendRoot, withoutSlash, 'index.html')
    return join(frontendRoot, withoutSlash)
  }

  return join(dirname(file), ref)
}

for (const file of walk(frontendRoot)) {
  const html = readFileSync(file, 'utf8')
  const refs = [...html.matchAll(/(?:href|src)=['"]([^'"]+)['"]/g)]
  for (const [, ref] of refs) {
    const resolved = resolveRef(file, ref)
    if (!resolved) continue
    if (!existsSync(resolved)) {
      failures.push(`${file.replace(repoRoot, '')}: missing ${ref} -> ${resolved.replace(repoRoot, '')}`)
    }
  }
}

if (failures.length > 0) {
  console.error('Frontend link check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Frontend link check passed')
