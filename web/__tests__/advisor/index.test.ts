import { describe, it, expect } from 'vitest'
import { recommendPurchaseStrategy } from '../../lib/advisor'
import type { AdvisorProfile } from '../../lib/advisor/types'

const coupleProfile: AdvisorProfile = {
  buyerType: 'couple',
  marriageStatus: 'planned',
  selfHomeStatus: 'none',
  spouseHomeStatus: 'one',
  householdHead: true,
  subscriptionAccountYears: 5,
  noHomeYears: 5,
  numChildren: 0,
  income: 8000,
  assets: 30000,
  budgetMax: 200000,
}

const soloProfile: AdvisorProfile = {
  ...coupleProfile,
  buyerType: 'solo',
  marriageStatus: null,
  spouseHomeStatus: null,
}

describe('recommendPurchaseStrategy', () => {
  it('includes ownership and marriage-timing cards for couples', () => {
    const report = recommendPurchaseStrategy(coupleProfile)
    const ids = report.cards.map(c => c.id)
    expect(ids).toContain('ownership')
    expect(ids).toContain('marriage-timing')
    expect(ids).toContain('purchase-method')
  })

  it('omits ownership and marriage-timing cards for solo buyers', () => {
    const report = recommendPurchaseStrategy(soloProfile)
    const ids = report.cards.map(c => c.id)
    expect(ids).not.toContain('ownership')
    expect(ids).not.toContain('marriage-timing')
    expect(ids).toContain('purchase-method')
  })

  it('computes subscription score once and reuses it', () => {
    const report = recommendPurchaseStrategy(coupleProfile)
    expect(report.subscriptionScore.total).toBeGreaterThan(0)
  })
})
