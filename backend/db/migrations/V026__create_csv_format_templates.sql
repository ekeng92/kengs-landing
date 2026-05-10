-- V026: CSV format templates for universal import mapping
CREATE TABLE IF NOT EXISTS csv_format_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('booking', 'expense')),
  header_fingerprint TEXT,
  column_map JSONB NOT NULL,
  row_filter JSONB,
  amount_sign TEXT NOT NULL DEFAULT 'negative_is_debit' CHECK (amount_sign IN ('negative_is_debit', 'separate_columns', 'always_positive')),
  date_format TEXT NOT NULL DEFAULT 'auto' CHECK (date_format IN ('auto', 'MM/DD/YYYY', 'YYYY-MM-DD', 'DD/MM/YYYY', 'M/D/YYYY')),
  source_url TEXT,
  is_builtin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);

-- Partial unique index: only one template per fingerprint per workspace
CREATE UNIQUE INDEX IF NOT EXISTS idx_csv_templates_fingerprint 
  ON csv_format_templates (workspace_id, header_fingerprint) 
  WHERE header_fingerprint IS NOT NULL;

-- Add format_template_id to import_jobs for tracking which template was used
ALTER TABLE import_jobs ADD COLUMN IF NOT EXISTS format_template_id UUID REFERENCES csv_format_templates(id);
