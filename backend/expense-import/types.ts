// author: AEON Dev | created: 2026-04-19 | last updated: 2026-04-19
// Shared TypeScript types aligned with schema-draft.md.
// Source of truth for all backend expense-import modules.

export type ImportJobStatus = 'uploaded' | 'parsed' | 'flagged' | 'promoted' | 'failed';

export type ImportRowReviewStatus =
  | 'pending'
  | 'flagged'
  | 'approved'
  | 'rejected'
  | 'promoted';

export type ExpenseReviewState = 'Business' | 'Personal' | 'Review';

export type TaxPeriod = 'Pre-Service' | 'Operational';

export type DocumentationStatus = 'CC' | 'Y' | 'N';

/** Canonical normalized candidate fields for an expense row. */
export interface NormalizedExpenseCandidate {
  transaction_date: string | null;       // ISO date YYYY-MM-DD
  amount: number | null;                 // positive value; refunds excluded
  merchant_name: string | null;
  description: string | null;            // raw source description preserved
  payment_method: string | null;
  candidate_property_code: string | null; // null until resolved against workspace properties
  candidate_category: string | null;     // Schedule E category if deterministic
  candidate_review_state: ExpenseReviewState;
  confidence_score: number;              // 0.0000–1.0000
  confidence_explanation: string;
}

/** A fully parsed source row including raw content, normalized candidate, and staging state. */
export interface ParsedRow {
  row_index: number;
  raw_payload: Record<string, string>;
  normalized_payload: NormalizedExpenseCandidate | null; // null on hard failure
  validation_errors: string[] | null;
  review_status: ImportRowReviewStatus;
  dedupe_key: string | null;
  confidence_score: number | null;
}

/** Summary returned from the ingest Edge Function after processing a file. */
export interface ImportJobSummary {
  job_id: string;
  status: ImportJobStatus;
  row_count: number;
  error_count: number;
  auto_promoted_count: number;
  flagged_count: number;
}

/** Input for promoting a single approved import_row into a committed expense. */
export interface PromotionInput {
  importRowId: string;
  workspaceId: string;
  actorUserId: string;
  reviewState: ExpenseReviewState;
  category: string;
  propertyId: string | null;
  description: string | null;
  paymentMethod: string | null;
  documentationStatus: DocumentationStatus;
}

/** Result returned by promoteRow. */
export interface PromoteResult {
  expenseId: string;
  taxPeriod: TaxPeriod;
}
