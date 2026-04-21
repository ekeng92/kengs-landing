// Seed script: creates a workspace, property, and membership for local dev
import postgres from 'postgres'

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
})

const DEV_USER_ID = '00000000-0000-0000-0000-000000000001'

// Check if workspace already exists
const existing = await sql`SELECT id FROM workspaces LIMIT 1`
if (existing.length > 0) {
  console.log('Workspace already exists:', existing[0].id)
  const props = await sql`SELECT id, code, name FROM properties WHERE workspace_id = ${existing[0].id}`
  console.log('Properties:', props)
  const memberships = await sql`SELECT id, role FROM workspace_memberships WHERE workspace_id = ${existing[0].id}`
  console.log('Memberships:', memberships)
  await sql.end()
  process.exit(0)
}

// Create workspace
const [ws] = await sql`
  INSERT INTO workspaces (name) VALUES ('Keng''s Landing LLC')
  RETURNING id
`
console.log('Created workspace:', ws.id)

// Create membership
await sql`
  INSERT INTO workspace_memberships (workspace_id, user_id, role)
  VALUES (${ws.id}, ${DEV_USER_ID}, 'owner')
`
console.log('Created dev user membership')

// Create properties matching the existing STR portfolio
const properties = [
  { code: '360CR', name: '360 County Road', pis: '2024-06-01', ownership: 'Series LLC', market: 'Corsicana, TX' },
  { code: 'IRONWOOD', name: 'Ironwood', pis: '2024-08-01', ownership: 'Personal', market: 'Corsicana, TX' },
  { code: 'MARLOW', name: 'Marlow', pis: '2025-01-01', ownership: 'Personal', market: 'Corsicana, TX' },
]

for (const p of properties) {
  const [prop] = await sql`
    INSERT INTO properties (workspace_id, name, code, placed_in_service_date, ownership_type, market)
    VALUES (${ws.id}, ${p.name}, ${p.code}, ${p.pis}, ${p.ownership}, ${p.market})
    RETURNING id
  `
  console.log(`Created property: ${p.code} (${prop.id})`)
}

console.log('\nSeed complete. Workspace ID:', ws.id)
console.log('Add this to your .dev.vars:\nDEV_WORKSPACE_ID=' + ws.id)

await sql.end()
