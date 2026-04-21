// author: AEON Dev | created: 2026-04-19 | last updated: 2026-04-19
// Schedule E aligned canonical categories for STR expense classification.
// Source: docs/specs/import-parsing-rules.md § Category Mapping Rule

export const SCHEDULE_E_CATEGORIES = [
  'Advertising',
  'Cleaning & turnover',
  'Insurance',
  'Mortgage interest',
  'Platform fees',
  'Professional services',
  'Property taxes',
  'Repairs & maintenance',
  'Supplies',
  'Utilities',
] as const;

export type ScheduleECategory = (typeof SCHEDULE_E_CATEGORIES)[number];

export function isValidCategory(value: string): value is ScheduleECategory {
  return (SCHEDULE_E_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Keyword-based heuristic category mapping.
 * Only covers patterns with deterministic, high-confidence mappings.
 * Any merchant not matched here must go to review — never guess ambiguous ones.
 * Source: docs/specs/import-parsing-rules.md § Category Mapping Rule
 */
export const CATEGORY_KEYWORD_MAP: Array<{
  pattern: RegExp;
  category: ScheduleECategory;
}> = [
  { pattern: /airbnb|vrbo|homeaway|booking\.com|expedia/i, category: 'Platform fees' },
  { pattern: /allstate|state\s*farm|farmers\s*ins|geico|nationwide|insurance/i, category: 'Insurance' },
  { pattern: /home\s*depot|lowe['']?s|ace\s*hardware|menards|true\s*value/i, category: 'Repairs & maintenance' },
  { pattern: /jan-pro|molly\s*maid|cleaning\s*service|maid|housekeeping/i, category: 'Cleaning & turnover' },
  { pattern: /electric|power\s*co|water\s*utility|gas\s*co|xcel|reliant|atmos|centerpoint|utility/i, category: 'Utilities' },
  { pattern: /turbotax|h&r\s*block|cpa\s*firm|accountant|legalzoom|attorney\s*at\s*law/i, category: 'Professional services' },
  { pattern: /zillow|facebook\s*ads|google\s*ads|advertising\s*co/i, category: 'Advertising' },
  { pattern: /costco|sam['']?s\s*club|walmart\s*supply|office\s*depot|staples/i, category: 'Supplies' },
];

/**
 * Returns the Schedule E category for a merchant + description text, or null
 * if no deterministic match is found. Null means the row requires user review.
 */
export function inferCategory(
  merchant: string,
  description: string
): ScheduleECategory | null {
  const text = `${merchant} ${description}`;
  for (const { pattern, category } of CATEGORY_KEYWORD_MAP) {
    if (pattern.test(text)) return category;
  }
  return null;
}
