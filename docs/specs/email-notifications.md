# Email Notifications Integration

> Status: proposed  
> Last updated: 2026-05-02  
> Owner: Keng's Landing backend

## Purpose

Add application-level email notifications for operational events in Keng's Landing: failed imports, stale tasks, sync failures, finance close reminders, and other admin/system alerts.

This document covers the recommended provider, backend architecture, configuration, data model options, and rollout plan.

## Recommendation

Use **Resend** as the first transactional email provider.

Reasons:

- Simple HTTP API and Node SDK.
- Works well from Cloudflare Workers using `fetch` or the SDK.
- Supports HTML and plain-text emails.
- Supports idempotency keys for safe retries.
- Default rate limit is documented as 5 requests/second per team, which is far above Keng's Landing's expected notification volume.

Postmark is a strong alternative if deliverability tooling becomes more important later. For the initial admin-notification use case, Resend is the simpler fit.

## Initial Scope

Start with **admin/system notifications only**. Do not use this for guest-facing or vendor-facing email until templates, sender identity, logging, and unsubscribe/compliance expectations are deliberately designed.

Good first triggers:

- Import job failed.
- iCal sync failed or produced suspicious results.
- Task is overdue or stale.
- Monthly finance close reminder.
- Migration/check failure during scheduled operational checks.
- Unusual booking or expense anomaly detected by future rules.

Out of scope for v1:

- Guest emails.
- Marketing emails.
- Multi-user notification preferences.
- Attachments.
- Inbound email processing.
- User-configurable email templates.

## Provider Comparison

### Resend

Best for v1.

- API endpoint: `POST https://api.resend.com/emails`
- Auth: `Authorization: Bearer <RESEND_API_KEY>`
- Required fields: `from`, `to`, `subject`, and at least one body field (`html`, `text`, or SDK-only `react`).
- Supports arrays for recipients.
- Supports custom headers and tags.
- Supports idempotency keys.
- Default documented rate limit: 5 requests/second/team.

Docs:

- https://resend.com/docs/send-with-cloudflare-workers
- https://resend.com/docs/api-reference/emails/send-email

### Postmark

Good fallback if Resend does not meet deliverability or observability needs.

- API endpoint: `POST https://api.postmarkapp.com/email`
- Auth: `X-Postmark-Server-Token: <token>`
- Required fields: `From`, `To`, `Subject`, and `TextBody` and/or `HtmlBody`.
- Requires a confirmed sender signature or verified sender domain.
- Supports sandbox token `POSTMARK_API_TEST` for validation without delivery.

Docs:

- https://postmarkapp.com/developer/user-guide/send-email-with-api

## Cloudflare Worker Configuration

Use Cloudflare Worker secrets for API keys and non-secret vars for defaults.

Secrets should not be committed to git.

Required production secrets:

```txt
RESEND_API_KEY
NOTIFICATION_TO_EMAIL
```

Recommended production vars:

```txt
NOTIFICATION_FROM_EMAIL="Keng's Landing <notifications@kengslanding.com>"
NOTIFICATION_REPLY_TO_EMAIL="eric@..."
NOTIFICATION_PROVIDER="resend"
NOTIFICATIONS_ENABLED="true"
```

Local development should use `backend/.dev.vars`, which is already git-ignored. Cloudflare documents `.dev.vars` / `.env` for local secret loading and Worker secrets for deployed environments.

Docs:

- https://developers.cloudflare.com/workers/configuration/secrets/

Example setup commands:

```bash
cd backend
wrangler secret put RESEND_API_KEY
wrangler secret put NOTIFICATION_TO_EMAIL
```

Optional staging/test values can be placed in `backend/.dev.vars`:

```dotenv
RESEND_API_KEY="re_..."
NOTIFICATION_TO_EMAIL="eric@example.com"
NOTIFICATION_FROM_EMAIL="Keng's Landing <notifications@example.com>"
NOTIFICATION_REPLY_TO_EMAIL="eric@example.com"
NOTIFICATION_PROVIDER="resend"
NOTIFICATIONS_ENABLED="false"
```

Keep `NOTIFICATIONS_ENABLED=false` locally unless actively testing email delivery.

## Proposed Backend Design

Add a provider-neutral notification service under the backend source tree:

```txt
backend/src/lib/notifications/
  email.ts
  templates.ts
  types.ts
```

### Types

```ts
export type NotificationSeverity = 'info' | 'warning' | 'critical'

export type EmailNotification = {
  type: string
  severity: NotificationSeverity
  subject: string
  text: string
  html?: string
  idempotencyKey?: string
  tags?: Record<string, string>
}
```

### Env additions

Add these optional fields to `backend/src/types/env.ts`:

```ts
RESEND_API_KEY?: string
NOTIFICATION_TO_EMAIL?: string
NOTIFICATION_FROM_EMAIL?: string
NOTIFICATION_REPLY_TO_EMAIL?: string
NOTIFICATION_PROVIDER?: 'resend' | 'postmark'
NOTIFICATIONS_ENABLED?: string
```

### Send function

Use direct `fetch` first instead of adding a provider SDK dependency. This keeps the Worker bundle simple and makes the integration easy to test.

```ts
export async function sendEmailNotification(env: Env, notification: EmailNotification) {
  if (env.NOTIFICATIONS_ENABLED !== 'true') {
    return { skipped: true, reason: 'notifications_disabled' }
  }

  if (!env.RESEND_API_KEY || !env.NOTIFICATION_TO_EMAIL || !env.NOTIFICATION_FROM_EMAIL) {
    return { skipped: true, reason: 'missing_email_config' }
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      ...(notification.idempotencyKey ? { 'Idempotency-Key': notification.idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: env.NOTIFICATION_FROM_EMAIL,
      to: [env.NOTIFICATION_TO_EMAIL],
      reply_to: env.NOTIFICATION_REPLY_TO_EMAIL,
      subject: notification.subject,
      text: notification.text,
      html: notification.html,
      tags: Object.entries(notification.tags ?? {}).map(([name, value]) => ({ name, value })),
    }),
  })

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(`Email notification failed: ${response.status} ${JSON.stringify(body)}`)
  }

  return body
}
```

Notes:

- Prefer both `text` and `html` bodies for compatibility.
- Use idempotency keys for event-driven sends, e.g. `import-failed/<job-id>`.
- Avoid logging API keys, email body secrets, or full recipient metadata.
- Do not send email from request handlers if the email is non-critical to the request outcome; use `ctx.waitUntil(...)` where available.

## Integration Points

### Import failures

When an import job fails, notify Eric with:

- Import job ID.
- Source type.
- Failure reason.
- Link/path to the relevant app page if available.

Idempotency key:

```txt
import-failed/<job-id>
```

### iCal sync failures

The Worker already has a scheduled handler that runs `runIcalSync(env)`. Wrap that scheduled work so failures can trigger notification:

```ts
async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(
    runIcalSync(env)
      .then(r => console.log('iCal sync:', JSON.stringify(r)))
      .catch(async error => {
        console.error('iCal sync failed:', error)
        await sendEmailNotification(env, buildIcalSyncFailedEmail(error))
      })
  )
}
```

### Task reminders

Task reminders should probably be phase 2 because they require querying task state on a schedule and deciding dedupe rules.

Possible v2 behavior:

- Daily scheduled check.
- Find tasks with `due_date < today` and status not done/archived.
- Send one digest email rather than one email per task.
- Idempotency key per day, e.g. `task-digest/2026-05-02`.

### Finance close reminders

Use a monthly scheduled trigger or a cron entry in Cloudflare Workers.

Example schedule concept:

```txt
First day of month, morning Central time: send close checklist for prior month.
```

This should be a digest-style template, not many small emails.

## Template Strategy

Keep templates in code for v1.

Use small pure functions that return `{ subject, text, html }`.

Example:

```ts
export function buildImportFailedEmail(input: {
  jobId: string
  source: string
  error: string
}): EmailNotification {
  return {
    type: 'import_failed',
    severity: 'critical',
    subject: `Keng's Landing: Import failed (${input.source})`,
    text: [
      `Import failed`,
      `Job ID: ${input.jobId}`,
      `Source: ${input.source}`,
      `Error: ${input.error}`,
    ].join('\n'),
    html: `
      <h1>Import failed</h1>
      <p><strong>Job ID:</strong> ${escapeHtml(input.jobId)}</p>
      <p><strong>Source:</strong> ${escapeHtml(input.source)}</p>
      <p><strong>Error:</strong> ${escapeHtml(input.error)}</p>
    `,
    idempotencyKey: `import-failed/${input.jobId}`,
    tags: { type: 'import_failed', severity: 'critical' },
  }
}
```

Escape any user-controlled content before putting it into HTML.

## Optional Notification Log

For v1, provider logs may be enough.

If in-app auditability matters, add a `notification_events` table later:

```sql
create table notification_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  recipient text not null,
  subject text not null,
  provider text not null,
  provider_message_id text,
  status text not null check (status in ('queued', 'sent', 'failed', 'skipped')),
  idempotency_key text unique,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
```

Use this only after the notification service proves useful. Do not block v1 on a table migration.

## Error Handling and Safety

- Notifications must never expose secrets.
- Email send failure should not break core app workflows unless the workflow explicitly depends on email delivery.
- Use `ctx.waitUntil(...)` for background sends where possible.
- Use idempotency keys for retryable event notifications.
- Prefer digest emails for recurring checks to avoid alert fatigue.
- Add a kill switch: `NOTIFICATIONS_ENABLED=false`.
- Add clear subject prefixes: `Keng's Landing:`.
- Consider a future `NOTIFICATION_MIN_SEVERITY` var if volume grows.

## Testing Plan

Unit tests:

- Notification disabled returns skipped result.
- Missing config returns skipped result.
- Resend request is formed correctly.
- Non-2xx provider response throws a useful error.
- Templates escape HTML content.
- Idempotency key is included for supported events.

Integration/manual tests:

1. Set Resend sandbox/test recipient or use a verified recipient.
2. Set local `.dev.vars` values.
3. Temporarily set `NOTIFICATIONS_ENABLED=true` locally.
4. Call a dev-only test endpoint or test helper.
5. Verify delivery and provider log.
6. Turn local notifications off again.

Avoid committing test secrets or real personal email addresses.

## Rollout Plan

1. Create Resend account and verify sender domain or sender email.
2. Add Cloudflare Worker secrets and non-secret vars.
3. Add `Env` fields.
4. Implement provider-neutral notification types and `sendEmailNotification`.
5. Add one template: `ical_sync_failed` or `import_failed`.
6. Add tests with mocked `fetch`.
7. Wire one low-risk trigger.
8. Deploy.
9. Observe provider logs and tune subject/body format.
10. Add additional triggers as digest emails.

## Open Decisions

- Sender domain: use `kengslanding.com`, a subdomain like `notifications.kengslanding.com`, or a temporary provider domain?
- Recipient: Eric only, or a dedicated operations inbox?
- First trigger: import failure, iCal sync failure, or monthly finance close reminder?
- Should notifications be logged in Supabase from v1, or deferred?
- Should task reminders be daily digest only?
