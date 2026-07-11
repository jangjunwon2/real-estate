import { describe, it, expect } from 'vitest'
import { recommendMarriageTiming } from '../../lib/advisor/marriageTimingAdvisor'
import type { AdvisorProfile } from '../../lib/advisor/types'

const baseProfile: AdvisorProfile = {
  buyerType: 'couple',
  marriageStatus: 'planned',
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

describe('recommendMarriageTiming', () => {
  it('returns null for solo buyers', () => {
    expect(recommendMarriageTiming({ ...baseProfile, buyerType: 'solo' })).toBeNull()
  })

  it('returns null when marriage is already registered', () => {
    expect(recommendMarriageTiming({ ...baseProfile, marriageStatus: 'registered' })).toBeNull()
  })

  it('recommends delaying registration when a spouse already owns a home', () => {
    const result = recommendMarriageTiming({ ...baseProfile, spouseHomeStatus: 'one' })
    expect(result!.card.conclusion).toContain('미루는')
  })

  it('recommends registering promptly when both partners are homeless', () => {
    const result = recommendMarriageTiming(baseProfile)
    expect(result!.card.conclusion).toContain('먼저 신고')
  })
})
