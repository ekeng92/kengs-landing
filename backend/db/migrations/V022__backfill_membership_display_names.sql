-- V022: Backfill display_name and email on workspace_memberships from auth.users
-- Pre-V017/V019 memberships have NULL display_name/email. This fills them from
-- the Supabase auth table. Only touches rows where the field is currently NULL.
-- Agents (role='agent') won't match auth.users and are left untouched.
-- Idempotent: safe to run multiple times — WHERE clause skips already-populated rows.

UPDATE workspace_memberships wm
SET email = au.email
FROM auth.users au
WHERE wm.user_id = au.id
  AND wm.email IS NULL
  AND au.email IS NOT NULL;

UPDATE workspace_memberships wm
SET display_name = COALESCE(
  NULLIF(au.raw_user_meta_data->>'full_name', ''),
  au.email
)
FROM auth.users au
WHERE wm.user_id = au.id
  AND wm.display_name IS NULL;
