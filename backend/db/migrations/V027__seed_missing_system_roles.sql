-- Seed system roles that were missing from V024.
-- V024 only seeded Owner, Admin, Cleaner. This adds the remaining
-- standard roles so the frontend role dropdowns (driven by workspace_roles)
-- show all available options.

INSERT INTO workspace_roles (workspace_id, name, description, scopes, is_system)
SELECT w.id, 'Manager', 'Manages tasks, bookings, expenses, and operations',
  '{"dashboard":"read","tasks":"admin","finances":"write","bookings":"write","expenses":"write","mileage":"write","imports":"write","properties":"write","users":"read","settings":"none","cleaning":"write","operations":"write"}'::jsonb,
  true
FROM workspaces w
ON CONFLICT (workspace_id, lower(name)) DO NOTHING;

INSERT INTO workspace_roles (workspace_id, name, description, scopes, is_system)
SELECT w.id, 'Accountant', 'Full finance access, read-only for other areas',
  '{"dashboard":"read","tasks":"write","finances":"admin","bookings":"read","expenses":"admin","mileage":"admin","imports":"write","properties":"read","users":"none","settings":"none","cleaning":"none","operations":"none"}'::jsonb,
  true
FROM workspaces w
ON CONFLICT (workspace_id, lower(name)) DO NOTHING;

INSERT INTO workspace_roles (workspace_id, name, description, scopes, is_system)
SELECT w.id, 'Reviewer', 'Read access with limited write for tasks and expenses',
  '{"dashboard":"read","tasks":"write","finances":"read","bookings":"read","expenses":"write","mileage":"read","imports":"none","properties":"read","users":"none","settings":"none","cleaning":"read","operations":"read"}'::jsonb,
  true
FROM workspaces w
ON CONFLICT (workspace_id, lower(name)) DO NOTHING;

INSERT INTO workspace_roles (workspace_id, name, description, scopes, is_system)
SELECT w.id, 'Agent', 'Automated agent with broad write access',
  '{"dashboard":"read","tasks":"admin","finances":"write","bookings":"write","expenses":"write","mileage":"write","imports":"write","properties":"read","users":"none","settings":"none","cleaning":"write","operations":"write"}'::jsonb,
  true
FROM workspaces w
ON CONFLICT (workspace_id, lower(name)) DO NOTHING;
