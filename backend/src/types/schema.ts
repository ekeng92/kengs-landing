/**
 * TypeScript types mirroring the locked DB schema (schema-draft.md).
 * These are hand-written and should be replaced with Supabase-generated types
 * once the Supabase project is provisioned (supabase gen types typescript).
 *
 * Numeric columns from Postgres are represented as number here.
 * Dates are ISO strings (YYYY-MM-DD). Timestamps are ISO strings with timezone offset.
 * JSONB columns use Record<string, unknown> or unknown for variable-shape payloads.
 */

// ─── Canonical enumerations ───────────────────────────────────────────────────

export type WorkspaceMemberRole = 'owner' | 'reviewer' | 'accountant'

export type RecordStatus = 'draft' | 'committed' | 'voided'

export type ExpenseReviewState = 'Business' | 'Personal' | 'Review'

export type TaxPeriod = 'Pre-Service' | 'Operational'

export type DocumentationStatus = 'CC' | 'Y' | 'N'

export type ImportJobStatus = 'uploaded' | 'parsed' | 'flagged' | 'promoted' | 'failed'

export type ImportRowReviewStatus = 'pending' | 'flagged' | 'approved' | 'rejected' | 'promoted'

// ─── Table row types ──────────────────────────────────────────────────────────

export interface Workspace {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export interface WorkspaceMembership {
  id: string
  workspace_id: string
  user_id: string
  role: WorkspaceMemberRole
  created_at: string
  updated_at: string
}

export interface Property {
  id: string
  workspace_id: string
  name: string
  code: string
  placed_in_service_date: string | null
  ownership_type: string | null
  market: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Booking {
  id: string
  workspace_id: string
  property_id: string
  source_platform: string
  source_confirmation_code: string | null
  guest_name: string | null
  check_in_date: string
  check_out_date: string
  nights: number | null
  gross_revenue_amount: number | null
  cleaning_fee_amount: number | null
  platform_fee_amount: number | null
  tax_amount: number | null
  net_payout_amount: number | null
  status: RecordStatus
  source_import_row_id: string | null
  created_at: string
  updated_at: string
}

export interface Expense {
  id: string
  workspace_id: string
  property_id: string | null
  transaction_date: string
  merchant_name: string | null
  description: string | null
  category: string | null
  amount: number
  payment_method: string | null
  review_state: ExpenseReviewState
  tax_period: TaxPeriod | null
  documentation_status: DocumentationStatus | null
  needs_receipt_followup: boolean
  status: RecordStatus
  source_import_row_id: string | null
  created_at: string
  updated_at: string
}

export interface MileageTrip {
  id: string
  workspace_id: string
  property_id: string
  trip_date: string
  origin: string | null
  destination: string | null
  miles: number
  purpose: string | null
  deduction_rate: number | null
  deduction_amount: number | null
  created_at: string
  updated_at: string
}

export interface Budget {
  id: string
  workspace_id: string
  property_id: string | null
  year: number
  category: string
  amount: number
  created_at: string
  updated_at: string
}

export interface ImportJob {
  id: string
  workspace_id: string
  created_by_user_id: string
  import_type: string
  original_filename: string | null
  storage_path: string | null
  status: ImportJobStatus
  row_count: number | null
  error_count: number | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface ImportRow {
  id: string
  import_job_id: string
  row_index: number
  entity_type: string | null
  raw_payload: Record<string, unknown>
  normalized_payload: Record<string, unknown> | null
  validation_errors: unknown | null
  review_status: ImportRowReviewStatus
  promoted_entity_type: string | null
  promoted_entity_id: string | null
  dedupe_key: string | null
  created_at: string
  updated_at: string
}

export interface Document {
  id: string
  workspace_id: string
  property_id: string | null
  related_entity_type: string | null
  related_entity_id: string | null
  document_type: string
  storage_path: string
  uploaded_by_user_id: string
  created_at: string
  updated_at: string
}

export interface AuditEvent {
  id: string
  workspace_id: string
  actor_user_id: string
  entity_type: string
  entity_id: string
  event_type: string
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  created_at: string
  // Note: no updated_at — audit events are append-only
}
