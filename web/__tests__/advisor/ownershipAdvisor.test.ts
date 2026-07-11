import { describe, it, expect } from 'vitest'
import { recommendOwnership } from '../../lib/advisor/ownershipAdvisor'
import type { AdvisorProfile } from '../../lib/advisor/types'

const baseProfile: AdvisorProfile = {
  buyerType: 'couple',
  marriageStatus: 'registered',
  selfHomeStatus: 'none',
  spouseHomeStatus: 'none',
  householdHead: true,
  subscriptionAccountYears: 5,
  noHomeYears: 5,
  numChildren: 0,
  income: 8000,
  assets: 30000,
  budgetMax: 200000,
}

describe('recommendOwnership', () => {
  it('returns null for solo buyers', () => {
    expect(recommendOwnership({ ...baseProfile, buyerType: 'solo' }, 200000)).toBeNull()
  })

  it('recommends joint ownership when it saves property tax', () => {
    const result = recommendOwnership(baseProfile, 200000)
    expect(result).not.toBeNull()
    expect(result!.card.conclusion).toContain('공동명의')
  })

  it('warns about first-buyer eligibility when a spouse already owns a home', () => {
    const result = recommendOwnership({ ...baseProfile, spouseHomeStatus: 'one' }, 200000)
    expect(result!.card.reasons.some(r => r.includes('생애최초'))).toBe(true)
  })

  it('includes a comparison table with both scenarios', () => {
    const result = recommendOwnership(baseProfile, 200000)
    expect(result!.table.rows.length).toBeGreaterThan(0)
    expect(Object.keys(result!.table.scenarioLabels)).toEqual(['sole', 'joint'])
  })
})
