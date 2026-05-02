-- V021: Add agent management fields to tasks
-- Supports the AEON Dev Lead workflow where a manager agent assigns tasks
-- to subagents and tracks clarification needs back to the SAGE.

-- clarification_notes: Questions or missing context that must be resolved
-- before work can proceed. Written by agents, answered by SAGE.
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS clarification_notes TEXT;

-- assigned_agent: Which AEON/subagent is working this task.
-- Distinct from assigned_to (which is a workspace membership user_id).
-- This is a free-text agent identifier like 'aeon-dev', 'aeon-test', 'Explore'.
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS assigned_agent TEXT;

-- session_id: Links a task to the orchestration session that created/claimed it.
-- Enables the Dev Lead to track which tasks belong to the current shift.
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS session_id TEXT;

-- Create index for filtering tasks by assigned agent
CREATE INDEX IF NOT EXISTS tasks_assigned_agent
  ON tasks (assigned_agent)
  WHERE assigned_agent IS NOT NULL;
