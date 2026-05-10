-- V029: Track who completed a cleaning sheet and the cleaned date
ALTER TABLE cleaning_sessions
  ADD COLUMN IF NOT EXISTS completed_by TEXT,
  ADD COLUMN IF NOT EXISTS cleaned_date DATE;
