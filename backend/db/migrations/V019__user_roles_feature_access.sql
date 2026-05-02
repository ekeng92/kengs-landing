-- V019: User management and per-feature access controls
-- Owner/admin can add users, assign roles, and override access by feature.

ALTER TABLE workspace_memberships
  DROP CONSTRAINT IF EXISTS workspace_memberships_role_check;

ALTER TABLE workspace_memberships
  ADD CONSTRAINT workspace_memberships_role_check
  CHECK (role IN ('owner', 'admin', 'manager', 'reviewer', 'accountant', 'agent'));

ALTER TABLE workspace_memberships
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS feature_access JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_workspace_memberships_email
  ON workspace_memberships (lower(email))
  WHERE email IS NOT NULL;
