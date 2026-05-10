import type { Env } from '../types/env'

export type EmailPayload = {
  to: string
  subject: string
  text: string
  html: string
}

export async function sendTransactionalEmail(env: Env, payload: EmailPayload) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    return { sent: false, skipped: true as const }
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [payload.to],
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Email send failed: ${res.status} ${detail}`)
  }

  return { sent: true, skipped: false as const }
}
