/**
 * iCal sync — fetches Airbnb/VRBO iCal feeds and upserts draft bookings.
 *
 * Triggered by:
 *  - Cloudflare Cron trigger (scheduled, every hour)
 *  - POST /ical-sync/trigger (manual, auth-protected)
 *
 * Flow:
 *  1. Read ical_feeds from property_ical_feeds table
 *  2. Fetch each iCal URL
 *  3. Parse VEVENT entries → booking candidates
 *  4. Deduplicate against existing bookings (by confirmation code + property)
 *  5. Insert new bookings as status='draft' with source_platform='ical-sync'
 *
 * author: AEON Dev | created: 2026-04-26
 */
import { Hono } from 'hono'
import { requireAuth, type AuthVariables } from '../lib/auth'
import { createSupabaseClient } from '../lib/supabase'
import type { Env } from '../types/env'

type Bindings = Env
type Variables = AuthVariables

export const icalSyncRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/** Manual trigger — requires auth */
icalSyncRouter.post('/trigger', requireAuth, async (c) => {
  const result = await runIcalSync(c.env)
  return c.json(result)
})

/** Status — check last sync results */
icalSyncRouter.get('/status', requireAuth, async (c) => {
  const supabase = createSupabaseClient(c.env)
  const { data } = await supabase
    .from('property_ical_feeds')
    .select('id, property_id, platform, ical_url, last_synced_at, last_sync_status, properties(name, code)')
    .order('last_synced_at', { ascending: false })
  return c.json({ data })
})

// ── iCal Sync Core ──────────────────────────────────────────────────────

export async function runIcalSync(env: Env) {
  const supabase = createSupabaseClient(env)

  // 1. Get all active feeds
  const { data: feeds, error: feedErr } = await supabase
    .from('property_ical_feeds')
    .select('id, property_id, workspace_id, platform, ical_url')
    .eq('active', true)

  if (feedErr || !feeds?.length) {
    return { synced: 0, error: feedErr?.message ?? 'No active feeds' }
  }

  let totalInserted = 0
  let totalSkipped = 0
  const errors: string[] = []

  for (const feed of feeds) {
    try {
      // 2. Fetch iCal
      const res = await fetch(feed.ical_url, {
        headers: { 'User-Agent': 'KengsLanding-iCalSync/1.0' },
      })
      if (!res.ok) {
        errors.push(`${feed.platform}:${feed.property_id} HTTP ${res.status}`)
        await supabase.from('property_ical_feeds').update({
          last_synced_at: new Date().toISOString(),
          last_sync_status: `error: HTTP ${res.status}`,
        }).eq('id', feed.id)
        continue
      }

      const icalText = await res.text()
      const events = parseIcal(icalText)

      // 3. Get existing confirmation codes for this property
      const { data: existing } = await supabase
        .from('bookings')
        .select('source_confirmation_code')
        .eq('property_id', feed.property_id)
        .not('source_confirmation_code', 'is', null)

      const existingCodes = new Set(existing?.map(b => b.source_confirmation_code) ?? [])

      // 4. Filter and insert new bookings
      let inserted = 0
      let skipped = 0

      for (const event of events) {
        if (!event.checkIn || !event.checkOut) continue

        // Build a dedup key from the UID or summary
        const dedupeCode = event.uid || `ical-${event.checkIn}-${event.checkOut}-${event.summary}`

        if (existingCodes.has(dedupeCode)) {
          skipped++
          continue
        }

        // Calculate nights
        const nights = Math.round(
          (new Date(event.checkOut).getTime() - new Date(event.checkIn).getTime()) / 86400000
        )

        if (nights <= 0) continue

        const { error: insertErr } = await supabase.from('bookings').insert({
          workspace_id: feed.workspace_id,
          property_id: feed.property_id,
          source_platform: feed.platform || 'airbnb',
          source_confirmation_code: dedupeCode,
          guest_name: event.summary || null,
          check_in_date: event.checkIn,
          check_out_date: event.checkOut,
          nights,
          status: 'draft',
        })

        if (insertErr) {
          // Likely unique constraint violation — skip
          skipped++
        } else {
          inserted++
          existingCodes.add(dedupeCode)
        }
      }

      totalInserted += inserted
      totalSkipped += skipped

      await supabase.from('property_ical_feeds').update({
        last_synced_at: new Date().toISOString(),
        last_sync_status: `ok: ${inserted} new, ${skipped} skipped of ${events.length} events`,
      }).eq('id', feed.id)

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${feed.platform}:${feed.property_id} ${msg}`)
      await supabase.from('property_ical_feeds').update({
        last_synced_at: new Date().toISOString(),
        last_sync_status: `error: ${msg}`,
      }).eq('id', feed.id)
    }
  }

  return {
    synced: totalInserted,
    skipped: totalSkipped,
    feeds_processed: feeds.length,
    errors: errors.length > 0 ? errors : undefined,
  }
}

// ── iCal Parser ─────────────────────────────────────────────────────────

interface IcalEvent {
  uid: string | null
  summary: string | null
  checkIn: string | null
  checkOut: string | null
}

function parseIcal(text: string): IcalEvent[] {
  const events: IcalEvent[] = []
  const blocks = text.split('BEGIN:VEVENT')

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split('END:VEVENT')[0]

    const uid = extractField(block, 'UID')
    const summary = extractField(block, 'SUMMARY')
    const dtstart = extractField(block, 'DTSTART')
    const dtend = extractField(block, 'DTEND')

    events.push({
      uid,
      summary: cleanSummary(summary),
      checkIn: parseIcalDate(dtstart),
      checkOut: parseIcalDate(dtend),
    })
  }

  return events
}

function extractField(block: string, field: string): string | null {
  // Handle both "DTSTART:20260501" and "DTSTART;VALUE=DATE:20260501"
  const regex = new RegExp(`^${field}[;:](.*)$`, 'm')
  const match = block.match(regex)
  if (!match) return null
  // Strip any params before the colon
  const val = match[1]
  const colonIdx = val.indexOf(':')
  return colonIdx >= 0 ? val.slice(colonIdx + 1).trim() : val.trim()
}

function parseIcalDate(val: string | null): string | null {
  if (!val) return null
  // Format: 20260501 or 20260501T150000Z
  const clean = val.replace(/[^0-9T]/g, '')
  if (clean.length >= 8) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`
  }
  return null
}

function cleanSummary(summary: string | null): string | null {
  if (!summary) return null
  // Airbnb iCal summaries are often "Reserved" or "Guest Name - HMXXXXXX"
  // Remove "Reserved" entries — they don't have a real guest name
  if (summary.toLowerCase() === 'reserved' || summary.toLowerCase() === 'airbnb (not available)') {
    return null
  }
  return summary.trim()
}
