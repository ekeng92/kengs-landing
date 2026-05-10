-- V030: Seed built-in CSV format templates for common CSV sources
-- These are workspace-scoped but marked is_builtin=true (not deletable/editable via API)
-- Inserted per-workspace: each workspace gets its own copy of built-in templates

-- Function to seed built-in templates for a workspace
CREATE OR REPLACE FUNCTION seed_builtin_csv_templates(ws_id UUID) RETURNS void AS $$
BEGIN
  -- Airbnb Earnings CSV (current format, April 2026+)
  INSERT INTO csv_format_templates (workspace_id, name, entity_type, column_map, row_filter, amount_sign, date_format, source_url, is_builtin)
  VALUES (
    ws_id,
    'Airbnb Earnings CSV',
    'booking',
    '{"confirmation_code": "Confirmation code", "guest_name": "Guest", "check_in": "Start date", "check_out": "End date", "nights": "Nights", "gross_revenue": "Gross earnings", "cleaning_fee": "Cleaning fee", "platform_fee": "Service fee", "tax": "Tax", "net_payout": "Paid out", "type": "Type"}'::jsonb,
    '{"column": "Type", "include": ["Reservation"]}'::jsonb,
    'always_positive',
    'MM/DD/YYYY',
    'https://www.airbnb.com/hosting/earnings',
    true
  )
  ON CONFLICT (workspace_id, name) DO NOTHING;

  -- Chase Bank Transactions CSV
  INSERT INTO csv_format_templates (workspace_id, name, entity_type, column_map, amount_sign, date_format, source_url, is_builtin)
  VALUES (
    ws_id,
    'Chase Bank Transactions',
    'expense',
    '{"date": "Transaction Date", "amount": "Amount", "merchant": "Description", "description": "Memo", "reference_id": "Check or Slip #", "category": "Type"}'::jsonb,
    'negative_is_debit',
    'MM/DD/YYYY',
    'https://secure.chase.com/web/auth/dashboard#/dashboard/accountDetails/downloadAccountTransactions',
    true
  )
  ON CONFLICT (workspace_id, name) DO NOTHING;

  -- American Express Transactions CSV
  INSERT INTO csv_format_templates (workspace_id, name, entity_type, column_map, amount_sign, date_format, source_url, is_builtin)
  VALUES (
    ws_id,
    'American Express Transactions',
    'expense',
    '{"date": "Date", "amount": "Amount", "merchant": "Description", "reference_id": "Reference", "category": "Category"}'::jsonb,
    'always_positive',
    'MM/DD/YYYY',
    'https://global.americanexpress.com/activity/search',
    true
  )
  ON CONFLICT (workspace_id, name) DO NOTHING;

  -- Wells Fargo Transactions CSV
  INSERT INTO csv_format_templates (workspace_id, name, entity_type, column_map, amount_sign, date_format, is_builtin)
  VALUES (
    ws_id,
    'Wells Fargo Transactions',
    'expense',
    '{"date": "Date", "amount": "Amount", "merchant": "Description"}'::jsonb,
    'negative_is_debit',
    'MM/DD/YYYY',
    true
  )
  ON CONFLICT (workspace_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Seed for all existing workspaces
DO $$
DECLARE
  ws RECORD;
BEGIN
  FOR ws IN SELECT id FROM workspaces LOOP
    PERFORM seed_builtin_csv_templates(ws.id);
  END LOOP;
END $$;

-- Note: New workspaces should call seed_builtin_csv_templates(workspace_id)
-- during workspace creation, or via a trigger.
