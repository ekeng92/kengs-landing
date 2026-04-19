/* ── Constants ────────────────────────────────────────────────────── */
export const CATEGORIES = [
  'Mortgage interest','Property taxes','Insurance','Repairs & maintenance',
  'Supplies','Utilities','Cleaning & turnover','Platform fees',
  'Professional services','Advertising','Travel','Depreciation','Other'
];
// Lookup map for case-insensitive category matching
export const CAT_LOOKUP = Object.fromEntries(CATEGORIES.map(c => [c.toLowerCase(), c]));
export const PLATFORMS = ['Airbnb','VRBO','Zillow','TurboTenant','Direct'];
export const PAYMENTS = ['Credit Card','Debit Card','Cash','Check','Venmo','Zelle','PayPal','Other'];
export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const DAYS_IN_MONTH = [31,28,31,30,31,30,31,31,30,31,30,31];

export const RECEIPT_VALUES = ['CC','Y','N'];
export const STATUS_VALUES = ['Business','Personal','Review'];

/* ── State ────────────────────────────────────────────────────────── */
export const state = {
  bookings: [],
  expenses: [],
  mileage: [],
  budgets: {},
  investment: { propertyPurchase: 87000, targetYears: 7 },
  fileHandle: null,
  dirty: false,
  activeTab: 'overview',
};
CATEGORIES.forEach(c => state.budgets[c] = 0);
