import { describe, it, expect } from 'vitest'
import {
  calcMonthlyPayment,
  calcNoHomeYears,
  calcMaxAffordablePrice,
  calcAcquisitionTax,
  calcBrokerFee,
  detectZoneType,
  detectStrictestZone,
  calcAffordableScenarios,
  calcLoanProducts,
  type UserFinance,
} from '../lib/koreanRealEstate'

// ─── calcMonthlyPayment ───────────────────────────────────────────────────────

describe('calcMonthlyPayment', () => {
  it('returns 0 for zero principal', () => {
    expect(calcMonthlyPayment(0, 3.5)).toBe(0)
  })

  it('computes correct payment for zero rate (simple division)', () => {
    // 3,600만원 ÷ 360개월 = 10만원/월
    expect(calcMonthlyPayment(3600, 0, 30)).toBe(10)
  })

  it('returns positive value for normal loan', () => {
    const monthly = calcMonthlyPayment(30000, 3.5, 30)
    expect(monthly).toBeGreaterThan(0)
    expect(monthly).toBeGreaterThan(100) // sanity: >100만원/월
    expect(monthly).toBeLessThan(200)    // sanity: <200만원/월
  })

  it('higher rate produces higher payment', () => {
    const low = calcMonthlyPayment(30000, 2.5, 30)
    const high = calcMonthlyPayment(30000, 5.0, 30)
    expect(high).toBeGreaterThan(low)
  })

  it('longer term produces lower payment', () => {
    const short = calcMonthlyPayment(30000, 3.5, 20)
    const long = calcMonthlyPayment(30000, 3.5, 30)
    expect(long).toBeLessThan(short)
  })
})

// ─── calcNoHomeYears ──────────────────────────────────────────────────────────

describe('calcNoHomeYears', () => {
  const currentYear = new Date().getFullYear()

  it('returns 0 for someone born in the current year - 30', () => {
    // age = 30, years = max(0, 30 - 30) = 0
    expect(calcNoHomeYears(currentYear - 30)).toBe(0)
  })

  it('returns positive years for someone born before 30 years + current', () => {
    // age = 35 → max(0, 35 - 30) = 5
    expect(calcNoHomeYears(currentYear - 35)).toBe(5)
  })

  it('returns 0 for someone younger than 30', () => {
    expect(calcNoHomeYears(currentYear - 25)).toBe(0)
  })

  it('caps at realistic max for very old birth year', () => {
    const years = calcNoHomeYears(1960)
    expect(years).toBeGreaterThan(30)
  })
})

// ─── calcMaxAffordablePrice ───────────────────────────────────────────────────

describe('calcMaxAffordablePrice', () => {
  it('is limited by priceCap', () => {
    const price = calcMaxAffordablePrice(20000, 0.7, 50000, 50000, 30000)
    expect(price).toBe(30000)
  })

  it('applies LTV correctly when LTV is the binding constraint', () => {
    // selfFunds=10000, ltvRate=0.5 → selfFunds = 50% of price → price = 20000
    const price = calcMaxAffordablePrice(10000, 0.5, 99999, 99999)
    expect(price).toBe(20000)
  })

  it('loan cap limits the loan', () => {
    // selfFunds=10000, no LTV constraint (ltvRate=1), loanCap=5000
    const price = calcMaxAffordablePrice(10000, 1, 5000, 10000)
    expect(price).toBe(15000)
  })

  it('DSR max limits the loan', () => {
    // selfFunds=10000, dsrMax=3000
    const price = calcMaxAffordablePrice(10000, 1, 99999, 3000)
    expect(price).toBe(13000)
  })
})

// ─── calcAcquisitionTax ───────────────────────────────────────────────────────

describe('calcAcquisitionTax', () => {
  it('applies first-buyer discount (max 200만원)', () => {
    const result = calcAcquisitionTax(30000, true)
    expect(result.discount).toBeLessThanOrEqual(200)
    expect(result.discount).toBeGreaterThan(0)
    expect(result.final).toBeLessThan(result.base)
  })

  it('no discount for non-first-buyer', () => {
    const result = calcAcquisitionTax(30000, false)
    expect(result.discount).toBe(0)
    expect(result.final).toBe(result.base)
  })

  it('totalTax = final + localEduTax + stampTax', () => {
    const r = calcAcquisitionTax(50000, false)
    expect(r.totalTax).toBe(r.final + r.localEduTax + r.stampTax)
  })
})

// ─── calcBrokerFee ────────────────────────────────────────────────────────────

describe('calcBrokerFee', () => {
  it('returns a positive fee', () => {
    expect(calcBrokerFee(50000)).toBeGreaterThan(0)
  })

  it('higher price produces higher fee', () => {
    const low = calcBrokerFee(20000)
    const high = calcBrokerFee(80000)
    expect(high).toBeGreaterThan(low)
  })
})

// ─── detectZoneType ───────────────────────────────────────────────────────────

describe('detectZoneType', () => {
  it('classifies 서울 as tohe', () => {
    expect(detectZoneType('서울 강남구')).toBe('tohe')
    expect(detectZoneType('서울 마포구')).toBe('tohe')
    expect(detectZoneType('서울 노원구')).toBe('tohe')
  })

  it('classifies 경기 규제지역 as overheat', () => {
    expect(detectZoneType('경기 과천시')).toBe('overheat')
    expect(detectZoneType('성남시 분당구')).toBe('overheat')
  })

  it('classifies 수도권 비규제 as metro (스트레스DSR +3.0%p 대상)', () => {
    expect(detectZoneType('인천 연수구')).toBe('metro')
    expect(detectZoneType('경기 고양')).toBe('metro')
    expect(detectZoneType('고양시 덕양구')).toBe('metro')
    expect(detectZoneType('경기 부천')).toBe('metro')
  })

  it('returns none for unknown area', () => {
    expect(detectZoneType('제주시')).toBe('none')
    expect(detectZoneType('전라남도 순천시')).toBe('none')
    expect(detectZoneType('부산 해운대구')).toBe('none')
  })

  it('returns none for null/undefined', () => {
    expect(detectZoneType(null)).toBe('none')
    expect(detectZoneType(undefined)).toBe('none')
  })
})

// ─── calcAffordableScenarios ──────────────────────────────────────────────────

describe('calcAffordableScenarios', () => {
  const baseFinance: UserFinance = {
    income: 8000,
    assets: 20000,
    depositToRecover: 0,
    giftAmount: 0,
    existingLoanPayment: 0,
    isNewlywed: true,
    isFirstBuyer: true,
    noHomeYears: 10,
    numChildren: 1,
    ownedHomes: 0,
  }

  it('returns 5 scenarios', () => {
    const scenarios = calcAffordableScenarios(20000, baseFinance)
    expect(scenarios).toHaveLength(5)
  })

  it('didimdol-special is eligible for newlywed+first-buyer within income limit', () => {
    const scenarios = calcAffordableScenarios(20000, baseFinance)
    const didimdol = scenarios.find(s => s.id === 'didimdol-special')
    expect(didimdol?.eligible).toBe(true)
    expect(didimdol?.maxPrice).toBeGreaterThan(0)
  })

  it('didimdol-special is ineligible when not newlywed', () => {
    const scenarios = calcAffordableScenarios(20000, { ...baseFinance, isNewlywed: false })
    const didimdol = scenarios.find(s => s.id === 'didimdol-special')
    expect(didimdol?.eligible).toBe(false)
  })

  it('general mortgage is ineligible when income is 0', () => {
    const scenarios = calcAffordableScenarios(20000, { ...baseFinance, income: 0 })
    const general = scenarios.find(s => s.id === 'general')
    expect(general?.eligible).toBe(false)
  })

  it('monthlyPayment is positive for eligible scenarios', () => {
    const scenarios = calcAffordableScenarios(20000, baseFinance)
    for (const s of scenarios) {
      if (s.eligible) {
        expect(s.monthlyPayment).toBeGreaterThan(0)
      }
    }
  })

  it('general mortgage max price is lower in a regulated zone than unregulated (non-first-buyer LTV differs)', () => {
    const fin: UserFinance = { ...baseFinance, isFirstBuyer: false, income: 15000 }
    const none = calcAffordableScenarios(30000, fin, 'none').find(s => s.id === 'general')
    const tohe = calcAffordableScenarios(30000, fin, 'tohe').find(s => s.id === 'general')
    expect(none?.eligible).toBe(true)
    expect(tohe?.eligible).toBe(true)
    expect(tohe!.maxPrice).toBeLessThan(none!.maxPrice)
  })

  it('general mortgage subName reflects the regulated zone', () => {
    const fin: UserFinance = { ...baseFinance, isFirstBuyer: false }
    const tohe = calcAffordableScenarios(30000, fin, 'tohe').find(s => s.id === 'general')
    expect(tohe?.subName).toContain('토허제')
  })

  it('defaults to unregulated zone when none is passed (backward compatible)', () => {
    const scenarios = calcAffordableScenarios(20000, baseFinance)
    const general = scenarios.find(s => s.id === 'general')
    expect(general?.subName).toBe('시중은행')
  })

  it('metro zone reduces general mortgage limit vs 지방 (스트레스DSR +3.0%p vs +0.75%p)', () => {
    const fin: UserFinance = { ...baseFinance, isFirstBuyer: false, income: 15000 }
    const none = calcAffordableScenarios(30000, fin, 'none').find(s => s.id === 'general')
    const metro = calcAffordableScenarios(30000, fin, 'metro').find(s => s.id === 'general')
    expect(metro?.eligible).toBe(true)
    expect(metro!.maxPrice).toBeLessThan(none!.maxPrice)
  })

  it('유주택자 is blocked from all loans in 수도권·규제지역', () => {
    const fin: UserFinance = { ...baseFinance, ownedHomes: 1 }
    for (const zone of ['tohe', 'metro'] as const) {
      const scenarios = calcAffordableScenarios(20000, fin, zone)
      const general = scenarios.find(s => s.id === 'general')
      expect(general?.eligible).toBe(false)
      expect(general?.blockedReasons.join()).toContain('유주택자')
      const didimdol = scenarios.find(s => s.id === 'didimdol-special')
      expect(didimdol?.eligible).toBe(false)
      expect(didimdol?.blockedReasons.join()).toContain('무주택')
    }
  })

  it('유주택자 in 비수도권 can still use general mortgage (LTV 60%)', () => {
    const fin: UserFinance = { ...baseFinance, ownedHomes: 1, isFirstBuyer: false }
    const general = calcAffordableScenarios(20000, fin, 'none').find(s => s.id === 'general')
    expect(general?.eligible).toBe(true)
    expect(general!.maxPrice).toBeGreaterThan(0)
  })
})

// ─── detectStrictestZone ────────────────────────────────────────────────────

describe('detectStrictestZone', () => {
  it('picks tohe when any region is in Seoul, regardless of order', () => {
    expect(detectStrictestZone(['경기 화성', '서울 강남구'])).toBe('tohe')
    expect(detectStrictestZone(['서울 강남구', '경기 화성'])).toBe('tohe')
  })

  it('returns none when no region is regulated', () => {
    expect(detectStrictestZone(['부산', '대전'])).toBe('none')
  })

  it('returns none for an empty list', () => {
    expect(detectStrictestZone([])).toBe('none')
  })
})

// ─── calcLoanProducts ─────────────────────────────────────────────────────────

describe('calcLoanProducts', () => {
  const finance: UserFinance = {
    income: 7000,
    assets: 15000,
    depositToRecover: 0,
    giftAmount: 0,
    existingLoanPayment: 0,
    isNewlywed: true,
    isFirstBuyer: true,
    noHomeYears: 5,
    numChildren: 0,
    ownedHomes: 0,
  }

  it('returns 5 products', () => {
    expect(calcLoanProducts(40000, finance)).toHaveLength(5)
  })

  it('calcLoan returns 0 for ineligible products', () => {
    const products = calcLoanProducts(40000, finance, '서울 강남구')
    for (const p of products) {
      if (!p.eligible) {
        expect(p.calcLoan(40000)).toBe(0)
      }
    }
  })

  it('규제지역 생애최초 LTV is 70% (2025.6.27 대책), 일반 40%', () => {
    const fbGeneral = calcLoanProducts(40000, finance, '서울 강남구').find(p => p.id === 'general')
    expect(fbGeneral?.ltvRate).toBe(0.7)
    const nonFb = calcLoanProducts(40000, { ...finance, isFirstBuyer: false }, '서울 강남구').find(p => p.id === 'general')
    expect(nonFb?.ltvRate).toBe(0.4)
  })

  it('지방 생애최초 LTV 80% + 대출 절대한도 6억', () => {
    const rich: UserFinance = { ...finance, income: 30000, assets: 100000 }
    const general = calcLoanProducts(100000, rich, '부산 해운대구').find(p => p.id === 'general')
    expect(general?.ltvRate).toBe(0.8)
    expect(general!.calcLoan(100000)).toBeLessThanOrEqual(60000) // 생애최초 한도 6억
  })

  it('유주택자 in 서울 — 일반 주담대 금지 (LTV 0%)', () => {
    const owner: UserFinance = { ...finance, isFirstBuyer: false, isNewlywed: false, ownedHomes: 1 }
    const general = calcLoanProducts(80000, owner, '서울 강남구').find(p => p.id === 'general')
    expect(general?.eligible).toBe(false)
    expect(general?.ltvRate).toBe(0)
    expect(general?.calcLoan(80000)).toBe(0)
  })

  it('유주택자 in 지방 — 일반 주담대 LTV 60%', () => {
    const owner: UserFinance = { ...finance, isFirstBuyer: false, isNewlywed: false, ownedHomes: 1 }
    const general = calcLoanProducts(40000, owner, '부산 해운대구').find(p => p.id === 'general')
    expect(general?.eligible).toBe(true)
    expect(general?.ltvRate).toBe(0.6)
  })

  it('수도권 비규제(metro)도 절대한도 적용 — 15억 이하 대출 최대 6억', () => {
    const rich: UserFinance = { ...finance, isFirstBuyer: false, isNewlywed: false, income: 50000, assets: 100000 }
    const general = calcLoanProducts(140000, rich, '인천 연수구').find(p => p.id === 'general')
    expect(general?.eligible).toBe(true)
    expect(general!.calcLoan(140000)).toBeLessThanOrEqual(60000)
  })
})
