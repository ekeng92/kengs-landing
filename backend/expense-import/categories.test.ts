import { describe, expect, it } from 'vitest'
import { inferCategory, isValidCategory, SCHEDULE_E_CATEGORIES } from './categories'

describe('Schedule E categories', () => {
  it('accepts only canonical Schedule E categories', () => {
    for (const category of SCHEDULE_E_CATEGORIES) {
      expect(isValidCategory(category)).toBe(true)
    }

    expect(isValidCategory('Repairs')).toBe(false)
    expect(isValidCategory('Personal')).toBe(false)
  })

  it.each([
    ['Airbnb service fee', '', 'Platform fees'],
    ['State Farm Insurance', '', 'Insurance'],
    ['Home Depot', 'materials', 'Repairs & maintenance'],
    ['Molly Maid', 'turnover clean', 'Cleaning & turnover'],
    ['Reliant Energy', 'electric bill', 'Utilities'],
    ['LegalZoom', 'entity filing', 'Professional services'],
    ['Facebook Ads', 'listing promotion', 'Advertising'],
    ["Sam's Club", 'guest supplies', 'Supplies'],
  ])('infers %s as %s', (merchant, description, expected) => {
    expect(inferCategory(merchant, description)).toBe(expected)
  })

  it('returns null for ambiguous merchants instead of guessing', () => {
    expect(inferCategory('Random Market', 'unclear purchase')).toBeNull()
  })
})
