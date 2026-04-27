import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from './types/env'
import { workspacesRouter } from './routes/workspaces'
import { propertiesRouter } from './routes/properties'
import { expensesRouter } from './routes/expenses'
import { bookingsRouter } from './routes/bookings'
import { importsRouter } from './routes/imports'
import { dashboardRouter } from './routes/dashboard'

const app = new Hono<{ Bindings: Env }>()

app.use(
  '*',
  cors({
    origin: [
      'https://kengs-landing-frontend.pages.dev',
      'http://localhost:8788',
      'http://localhost:3000',
    ],
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  })
)

app.get('/health', (c) => c.json({ status: 'ok', ts: new Date().toISOString() }))

app.route('/workspaces', workspacesRouter)
app.route('/properties', propertiesRouter)
app.route('/expenses', expensesRouter)
app.route('/bookings', bookingsRouter)
app.route('/imports', importsRouter)
app.route('/dashboard', dashboardRouter)

export default app
