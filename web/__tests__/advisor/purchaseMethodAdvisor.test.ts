import { describe, it, expect } from 'vitest'
import { recommendPurchaseMethod } from '../../lib/advisor/purchaseMethodAdvisor'
import type { AdvisorProfile } from '../../lib/advisor/types'

const baseProfile: AdvisorProfile = {
  buyerType: 'solo',
  marriageStatus: null,
  selfHomeStatus: 'none',
  spouseHomeStatus: null,
  householdHead: true,
  subscriptionAccountYears: 10,
  noHomeYears: 10,
  numChildren: 0,
  income: 6000,
  assets: 30000,
  budgetMax: 60000,
}

describe('recommendPurchaseMethod', () => {
  it('recommends subscription when score is high and not multi-home', () => {
    const result = recommendPurchaseMethod(baseProfile, 60)
    expect(result.card.conclusion).toContain('청약')
  })

  it('recommends sale when score is low', () => {
    const result = recommendPurchaseMethod(baseProfile, 10)
    expect(result.card.conclusion).toContain('일반매매')
  })

  it('excludes subscription for multi-home owners regardless of score', () => {
    const result = recommendPurchaseMethod({ ...baseProfile, selfHomeStatus: 'multiple' }, 70)
    expect(result.card.reasons.some(r => r.includes('다주택자'))).toBe(true)
  })

  it('includes a comparison table with three scenarios', () => {
    const result = recommendPurchaseMethod(baseProfile, 60)
    expect(Object.keys(result.table.scenarioLabels)).toEqual(['subscription', 'sale', 'auction'])
  })
})
