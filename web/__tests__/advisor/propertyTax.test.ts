import { describe, it, expect } from 'vitest'
import { estimateOfficialPrice, calcPropertyTax, compareOwnershipPropertyTax } from '../../lib/advisor/propertyTax'

describe('estimateOfficialPrice', () => {
  it('estimates official price as 67% of market price', () => {
    expect(estimateOfficialPrice(100000)).toBe(67000)
  })
})

describe('calcPropertyTax', () => {
  it('returns 0 when base is below deduction', () => {
    expect(calcPropertyTax(100000, 120000)).toBe(0)
  })

  it('computes tax for official price 20억, sole ownership deduction 12억', () => {
    // base = (200000-120000)*0.6 = 48000 → 30000*0.5% + 18000*0.7% = 150+126 = 276
    expect(calcPropertyTax(200000, 120000)).toBe(276)
  })

  it('computes tax for official price 20억, joint individual deduction 18억', () => {
    // base = (200000-180000)*0.6 = 12000 → 12000*0.5% = 60
    expect(calcPropertyTax(200000, 180000)).toBe(60)
  })

  it('applies multi-house 3plus surcharge brackets above 12억 base', () => {
    const generalTax = calcPropertyTax(300000, 120000, 1)
    const multiHouseTax = calcPropertyTax(300000, 120000, 3)
    expect(multiHouseTax).toBeGreaterThan(generalTax)
  })
})

describe('compareOwnershipPropertyTax', () => {
  it('recommends jointIndividual when it yields lower tax', () => {
    const result = compareOwnershipPropertyTax(200000, 1)
    expect(result.recommended).toBe('jointIndividual')
    expect(result.savings).toBe(42)
  })

  it('both scenarios are 0 below both deduction thresholds', () => {
    const result = compareOwnershipPropertyTax(100000, 1)
    expect(result.soleOrSpecialOwnership.propertyTax).toBe(0)
    expect(result.jointIndividual.propertyTax).toBe(0)
  })
})
