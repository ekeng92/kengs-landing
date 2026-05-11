# Kengs Landing — Audit Review Findings

> Generated: 2026-05-10 | Deep Repo Audit Phase 2

## Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 2 |
| 🟠 High | 5 |
| 🟡 Medium | 8 |
| 🟢 Low | 4 |
| **Total** | **19** |

**Baseline**: 373 tests pass (19 files), TypeScript clean, 30 migrations

---

## 🔴 Critical Findings

### C1: Tenant Isolation Missing on Mutation Endpoints

**Severity**: 🔴 Critical
**Impact**: Any authenticated user can modify or delete records belonging to other workspaces by guessing UUIDs
**Affected files**:
- `routes/expenses.ts` — `PATCH /:id` and `PATCH /:id/commit` skip workspace verification
- `routes/bookings.ts` — `PATCH /:id`, `PATCH /:id/commit`, `PATCH /:id/void` skip workspace verification
- `routes/mileage.ts` — `PATCH /:id` and `DELETE /:id` skip workspace verification
- `routes/properties.ts` — `PATCH /:id` and `DELETE /:id` skip workspace verification

**Note**: GET endpoints correctly verify workspace access (fetch workspace_id, then `requireWorkspaceFeature`). The pattern exists but was not applied to mutation endpoints.

**Fix**: Add workspace ownership check before mutation, matching the GET pattern.

### C2: Missing `requireWorkspaceFeature` on Entire Route Files

**Severity**: 🔴 Critical
**Impact**: Feature-based access control is bypassed entirely for these features
**Affected files**:
- `routes/cleaning.ts` — admin endpoints have no feature access check
- `routes/cleaning-lists.ts` — admin endpoints have no feature access check
- `routes/csv-templates.ts` — CRUD endpoints have no feature access check
- `routes/dashboard.ts` — metrics endpoint has no feature access check (uses workspace_id from query but doesn't verify membership)
- `routes/ical-sync.ts` — manual trigger has no feature access check

---

## 🟠 High Findings

### H1: Raw Database Error Exposure (20+ locations)

**Severity**: 🟠 High
**Impact**: Supabase/PostgreSQL error messages leak table names, column names, and constraint details to clients
**Affected files**: `bookings.ts`, `dashboard.ts`, `expenses.ts`, `imports.ts`, `mileage.ts`, `properties.ts`, `workspaces.ts`
**Pattern**: `return c.json({ error: error.message }, 500)`
**Fix**: Use `mapDbError()` consistently (already exists in `lib/validation.ts`, used in some routes)

### H2: Auth `timingSafeEqual` Leaks Key Length

**Severity**: 🟠 High
**Impact**: Early return on `a.length !== b.length` allows attackers to determine the exact length of the API key via timing analysis
**File**: `lib/auth.ts:7`
**Fix**: Pad shorter string or hash both before comparison

### H3: Zero Tests for iCal Sync (223 lines)

**Severity**: 🟠 High
**Impact**: External data ingestion with no test coverage; iCal parsing bugs could create invalid bookings
**File**: `routes/ical-sync.ts`
**Fix**: Write test suite covering: feed fetch, iCal parsing, dedup, status endpoint, error handling

### H4: Import Route Missing Zod Validation on Create

**Severity**: 🟠 High
**Impact**: `POST /imports` accepts arbitrary JSON without schema validation
**File**: `routes/imports.ts:30-57`
**Fix**: Add Zod schema for import job creation body

### H5: Cleaning Submit Accepts Unvalidated Body

**Severity**: 🟠 High
**Impact**: `POST /:token/submit` uses `await c.req.json()` without Zod validation, trusting arbitrary client data for checklist items
**File**: `routes/cleaning.ts:102-130`
**Fix**: Add Zod schema for submit body

---

## 🟡 Medium Findings

### M1: `imports.ts` is 936 Lines

**Severity**: 🟡 Medium
**Impact**: Hard to maintain, review, and test; mixes booking and expense import logic
**File**: `routes/imports.ts`
**Fix**: Consider splitting into booking-import and expense-import route files

### M2: Frontend .bak Files Committed

**Severity**: 🟡 Medium
**Impact**: Stale code in repo causes confusion
**Files**: `frontend/booking-review/index.html.bak`, `frontend/expense-review/index.html.bak`, `frontend/booking-review/js/booking-review.js.bak`, `frontend/expense-review/js/expense-review.js.bak`
**Fix**: Delete .bak files, add `*.bak` to .gitignore

### M3: No Frontend Automated Tests

**Severity**: 🟡 Medium
**Impact**: 16 HTML pages + 3 JS modules with zero test coverage; `cypress/` directory exists but appears unused
**Fix**: Not actionable in this audit (architectural decision)

### M4: Dashboard Metrics Raw Error Leak

**Severity**: 🟡 Medium
**Impact**: Dashboard export endpoint leaks errors
**File**: `routes/dashboard.ts:122,159`
**Fix**: Use mapDbError

### M5: CORS Origin Hardcoded

**Severity**: 🟡 Medium
**Impact**: New deployment URLs require code change
**File**: `src/index.ts:24-28`
**Fix**: Move to environment variable (low priority)

### M6: Properties List Missing `requireWorkspaceFeature`

**Severity**: 🟡 Medium
**Impact**: List endpoint validates workspace_id param but doesn't verify user has property access
**File**: `routes/properties.ts:21-34`

### M7: Inconsistent Error Mapping

**Severity**: 🟡 Medium
**Impact**: Some routes use `mapDbError()`, others return raw `error.message`
**Files**: bookings, expenses, properties use `mapDbError` on some paths but not others

### M8: Missing Input Validation on Import Row Update

**Severity**: 🟡 Medium
**Impact**: `PATCH /:jobId/rows/:rowId` accepts arbitrary JSON for normalized_payload
**File**: `routes/imports.ts:160-172`

---

## 🟢 Low Findings

### L1: Redundant Double-Query on GET-by-ID

**Severity**: 🟢 Low
**Impact**: Performance — fetches workspace_id first, then re-fetches the full record in a second query
**Files**: bookings, expenses, mileage, properties all do two queries for one GET
**Fix**: Single query with workspace membership join, or use the first query result

### L2: Mileage Delete Returns No Confirmation Data

**Severity**: 🟢 Low
**Impact**: Client doesn't know what was deleted
**File**: `routes/mileage.ts:215-222`

### L3: iCal Parser Regex Could Be More Robust

**Severity**: 🟢 Low
**Impact**: Edge cases in iCal format (folded lines, quoted values) not handled
**File**: `routes/ical-sync.ts:178-195`

### L4: Frontend `generate-icons.html` is a Dev Tool in Production

**Severity**: 🟢 Low
**Impact**: Minor — exposed dev tool at a public URL
**File**: `frontend/generate-icons.html`

---

## Cross-Cutting Patterns

1. **Tenant isolation is inconsistent**: GET endpoints verify workspace access; most mutation endpoints do not. This is the single highest-risk pattern in the codebase.

2. **Error handling is half-migrated**: `mapDbError()` exists and is excellent, but only 4 of 13 route files use it consistently. The others leak raw Supabase errors.

3. **Zod validation is partial**: Core entity routes (bookings, expenses, tasks, mileage) have schemas. Newer routes (imports create, cleaning submit) skip validation entirely.

4. **Feature access control is incomplete**: Newer route files (cleaning, cleaning-lists, csv-templates) were added without `requireWorkspaceFeature` integration.

---

## Prioritized Fix List

1. **C1 + C2**: Add workspace ownership verification to all mutation endpoints (Critical, ~45 min)
2. **H1**: Replace all `error.message` with `mapDbError()` (High, ~20 min)
3. **H2**: Fix timing-safe comparison to not leak length (High, ~5 min)
4. **H4 + H5**: Add Zod validation to imports create and cleaning submit (High, ~15 min)
5. **H3**: Write iCal sync test suite (High, ~30 min)
6. **M2**: Delete .bak files (Medium, ~2 min)
