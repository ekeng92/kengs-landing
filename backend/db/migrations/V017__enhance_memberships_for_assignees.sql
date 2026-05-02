-- V017: Enhance workspace memberships for assignee support
-- Adds display_name so the frontend can show names without a user profile lookup.
-- Expands role to include 'agent' for non-human workspace participants.
-- Agents don't have a real Supabase auth user_id — use a deterministic UUID.

ALTER TABLE workspace_memberships
  DROP CONSTRAINT IF EXISTS workspace_memberships_role_check;

ALTER TABLE workspace_memberships
  ADD CONSTRAINT workspace_memberships_role_check
  CHECK (role IN ('owner', 'reviewer', 'accountant', 'agent'));

ALTER TABLE workspace_memberships
  ADD COLUMN IF NOT EXISTS display_name TEXT;
