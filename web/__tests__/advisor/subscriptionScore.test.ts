import { describe, it, expect } from 'vitest'
import { calcSubscriptionScore } from '../../lib/advisor/subscriptionScore'

describe('calcSubscriptionScore', () => {
  it('returns max 84 points at max eligibility (15+ years, 6+ dependents, 15+ account years)', () => {
    const result = calcSubscriptionScore(15, 6, 15)
    expect(result.total).toBe(84)
    expect(result.noHomeYearsScore).toBe(32)
    expect(result.dependentsScore).toBe(35)
    expect(result.accountPeriodScore).toBe(17)
  })

  it('returns minimum scores for a brand-new applicant', () => {
    const result = calcSubscriptionScore(0, 0, 0)
    expect(result.noHomeYearsScore).toBe(2)
    expect(result.dependentsScore).toBe(5)
    expect(result.accountPeriodScore).toBe(1)
    expect(result.total).toBe(8)
  })

  it('caps no-home-years score at 32 beyond 15 years', () => {
    expect(calcSubscriptionScore(20, 0, 0).noHomeYearsScore).toBe(32)
  })

  it('caps dependents score at 35 beyond 6 dependents', () => {
    expect(calcSubscriptionScore(0, 10, 0).dependentsScore).toBe(35)
  })
})
