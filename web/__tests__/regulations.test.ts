import { describe, it, expect } from 'vitest'
import { PROPERTY_TAX } from '../lib/regulations'

describe('PROPERTY_TAX', () => {
  it('defines 1세대1주택 특례 공제 as 12억', () => {
    expect(PROPERTY_TAX.deduction.singleHouseSpecial).toBe(120000)
  })

  it('defines 인별과세 기본공제 as 9억', () => {
    expect(PROPERTY_TAX.deduction.perPerson).toBe(90000)
  })

  it('defines fair market value ratio as 60%', () => {
    expect(PROPERTY_TAX.fairMarketValueRatio).toBe(0.60)
  })

  it('general rate brackets are sorted ascending by maxBase', () => {
    const bases = PROPERTY_TAX.rates.general.map(b => b.maxBase)
    const sorted = [...bases].sort((a, b) => a - b)
    expect(bases).toEqual(sorted)
  })
})
