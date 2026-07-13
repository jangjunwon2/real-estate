import { describe, it, expect } from 'vitest'
import {
  buildWhatIfSuggestions,
  buildAdvisoryNotices,
  buildPropertyWhatIf,
  type WhatIfInput,
} from '../lib/advisor/whatIfAdvisor'
import type { UserFinance } from '../lib/koreanRealEstate'

const baseFinance: UserFinance = {
  income: 8000,
  assets: 20000,
  depositToRecover: 0,
  giftAmount: 0,
  existingLoanPayment: 0,
  isNewlywed: true,
  isFirstBuyer: true,
  noHomeYears: 5,
  numChildren: 0,
  ownedHomes: 0,
}

const baseInput: WhatIfInput = {
  finance: baseFinance,
  selfFunds: 20000,
  zone: 'tohe',
  buyerType: 'couple',
  marriageStatus: 'registered',
  selfHomeStatus: 'none',
  spouseHomeStatus: 'none',
  incomeSelf: 0,
}

describe('buildWhatIfSuggestions', () => {
  it('returns empty when income or selfFunds is 0', () => {
    expect(buildWhatIfSuggestions({ ...baseInput, finance: { ...baseFinance, income: 0 } })).toEqual([])
    expect(buildWhatIfSuggestions({ ...baseInput, selfFunds: 0 })).toEqual([])
  })

  it('suggests marriage registration for pre-registration couple (both 무주택)', () => {
    const input: WhatIfInput = { ...baseInput, marriageStatus: 'planned', incomeSelf: 4000 }
    const s = buildWhatIfSuggestions(input).find(x => x.id === 'marriage-register')
    expect(s).toBeDefined()
    // 신고 후 부부합산(8000)이 단독 소득(4000)보다 구매력이 커야 한다
    expect(s!.variantMax).toBeGreaterThan(s!.currentMax)
    expect(s!.deltaAmount).toBeGreaterThan(0)
  })

  it('does not suggest marriage registration when already registered', () => {
    const suggestions = buildWhatIfSuggestions(baseInput)
    expect(suggestions.find(x => x.id === 'marriage-register')).toBeUndefined()
  })

  it('suggests delaying registration when spouse owns a home', () => {
    const input: WhatIfInput = {
      ...baseInput,
      marriageStatus: 'planned',
      spouseHomeStatus: 'one',
      finance: { ...baseFinance, ownedHomes: 1 }, // 설정 화면과 동일하게 배우자 주택이 합산된 상태
    }
    const s = buildWhatIfSuggestions(input).find(x => x.id === 'marriage-delay')
    expect(s).toBeDefined()
    // 유주택 합산 상태(서울=주담대 금지) 대비 단독 무주택 매수가 확실히 유리해야 한다
    expect(s!.deltaAmount).toBeGreaterThan(0)
  })

  it('suggests newborn special loan when childless and income within limit', () => {
    const s = buildWhatIfSuggestions(baseInput).find(x => x.id === 'newborn')
    expect(s).toBeDefined()
    expect(s!.deltaAmount).toBeGreaterThan(0)
  })

  it('does not suggest newborn loan when income exceeds 2억', () => {
    const input: WhatIfInput = { ...baseInput, finance: { ...baseFinance, income: 25000 } }
    expect(buildWhatIfSuggestions(input).find(x => x.id === 'newborn')).toBeUndefined()
  })

  it('suggests repaying existing loans when payment > 0', () => {
    const input: WhatIfInput = { ...baseInput, finance: { ...baseFinance, existingLoanPayment: 100 } }
    const s = buildWhatIfSuggestions(input).find(x => x.id === 'repay-loan')
    expect(s).toBeDefined()
    expect(s!.deltaAmount).toBeGreaterThan(0)
  })

  it('suggests checking first-buyer status when unchecked but 무주택', () => {
    const input: WhatIfInput = { ...baseInput, finance: { ...baseFinance, isFirstBuyer: false, isNewlywed: false } }
    const s = buildWhatIfSuggestions(input).find(x => x.id === 'first-buyer-check')
    expect(s).toBeDefined()
    expect(s!.deltaAmount).toBeGreaterThan(0)
  })

  it('suggests widening region when zone is regulated', () => {
    const s = buildWhatIfSuggestions(baseInput).find(x => x.id === 'region-widen')
    expect(s).toBeDefined()
    expect(s!.deltaAmount).toBeGreaterThan(0)
  })

  it('does not suggest widening region when zone is already none', () => {
    const input: WhatIfInput = { ...baseInput, zone: 'none' }
    expect(buildWhatIfSuggestions(input).find(x => x.id === 'region-widen')).toBeUndefined()
    expect(buildWhatIfSuggestions(input).find(x => x.id === 'region-metro')).toBeUndefined()
  })

  it('suggests 수도권 비규제 for non-first-buyer in 규제지역 (LTV 40% → 70%)', () => {
    const input: WhatIfInput = {
      ...baseInput,
      finance: { ...baseFinance, isFirstBuyer: false, isNewlywed: false, income: 15000 },
      buyerType: 'solo',
    }
    const s = buildWhatIfSuggestions(input).find(x => x.id === 'region-metro')
    expect(s).toBeDefined()
    expect(s!.deltaAmount).toBeGreaterThan(0)
  })

  it('does not suggest 수도권 비규제 when metro zone is already active', () => {
    const input: WhatIfInput = { ...baseInput, zone: 'metro' }
    expect(buildWhatIfSuggestions(input).find(x => x.id === 'region-metro')).toBeUndefined()
  })

  it('marriage-register caution mentions individual income entry when incomeSelf is missing', () => {
    const input: WhatIfInput = { ...baseInput, marriageStatus: 'planned', incomeSelf: 0 }
    const s = buildWhatIfSuggestions(input).find(x => x.id === 'marriage-register')
    if (s) {
      expect(s.caution).toContain('개별')
    }
    const withSelf = buildWhatIfSuggestions({ ...input, incomeSelf: 4000 })
      .find(x => x.id === 'marriage-register')
    expect(withSelf).toBeDefined()
    expect(withSelf!.caution).not.toContain('개별')
  })

  it('sorts suggestions by benefit descending', () => {
    const input: WhatIfInput = { ...baseInput, finance: { ...baseFinance, existingLoanPayment: 50 } }
    const suggestions = buildWhatIfSuggestions(input)
    expect(suggestions.length).toBeGreaterThan(1)
    for (let i = 1; i < suggestions.length; i++) {
      expect(suggestions[i - 1].deltaAmount).toBeGreaterThanOrEqual(suggestions[i].deltaAmount)
    }
  })

  it('suggests 처분조건부 매수 for 1주택 mover in 규제지역', () => {
    const input: WhatIfInput = {
      ...baseInput,
      selfHomeStatus: 'one',
      finance: { ...baseFinance, isFirstBuyer: false, isNewlywed: false, ownedHomes: 1 },
      buyerType: 'solo',
    }
    const s = buildWhatIfSuggestions(input).find(x => x.id === 'disposal-condition')
    expect(s).toBeDefined()
    expect(s!.deltaAmount).toBeGreaterThan(0)
  })

  it('does not suggest 처분조건 when already enabled or 다주택', () => {
    const enabled: WhatIfInput = {
      ...baseInput,
      finance: { ...baseFinance, ownedHomes: 1, disposalPlanned: true },
    }
    expect(buildWhatIfSuggestions(enabled).find(x => x.id === 'disposal-condition')).toBeUndefined()
    const multi: WhatIfInput = { ...baseInput, finance: { ...baseFinance, ownedHomes: 2 } }
    expect(buildWhatIfSuggestions(multi).find(x => x.id === 'disposal-condition')).toBeUndefined()
  })
})

// ─── buildAdvisoryNotices ─────────────────────────────────────────────────────

describe('buildAdvisoryNotices', () => {
  it('warns when gift exceeds exemption (solo: 5천만)', () => {
    const input: WhatIfInput = {
      ...baseInput,
      buyerType: 'solo',
      finance: { ...baseFinance, giftAmount: 20000 },
    }
    const n = buildAdvisoryNotices(input).find(x => x.id === 'gift-tax')
    expect(n).toBeDefined()
    expect(n!.tone).toBe('warn')
  })

  it('info tone when gift is within couple exemption (3억)', () => {
    const input: WhatIfInput = { ...baseInput, finance: { ...baseFinance, giftAmount: 20000 } }
    const n = buildAdvisoryNotices(input).find(x => x.id === 'gift-tax')
    expect(n).toBeDefined()
    expect(n!.tone).toBe('info')
  })

  it('no gift notice when giftAmount is 0', () => {
    expect(buildAdvisoryNotices(baseInput).find(x => x.id === 'gift-tax')).toBeUndefined()
  })

  it('subscription notice for 무주택 user includes score', () => {
    const n = buildAdvisoryNotices(baseInput).find(x => x.id === 'subscription-strategy')
    expect(n).toBeDefined()
    expect(n!.title).toContain('점')
  })

  it('no subscription notice for 유주택 user', () => {
    const input: WhatIfInput = { ...baseInput, finance: { ...baseFinance, ownedHomes: 1 } }
    expect(buildAdvisoryNotices(input).find(x => x.id === 'subscription-strategy')).toBeUndefined()
  })

  it('warns about 세대주 when not household head', () => {
    const n = buildAdvisoryNotices({ ...baseInput, householdHead: false })
      .find(x => x.id === 'subscription-strategy')
    expect(n!.points.join()).toContain('세대주')
  })
})

// ─── buildPropertyWhatIf ──────────────────────────────────────────────────────

describe('buildPropertyWhatIf', () => {
  it('returns affordableNow when price is within current max', () => {
    const r = buildPropertyWhatIf(30000, baseInput)
    expect(r).not.toBeNull()
    expect(r!.affordableNow).toBe(true)
  })

  it('finds unlocking strategies for an out-of-reach property', () => {
    // 기존 대출로 한도가 깎인 사용자 — 정리하면 닿는 가격대의 매물
    const input: WhatIfInput = { ...baseInput, finance: { ...baseFinance, existingLoanPayment: 150 } }
    const constrained = buildPropertyWhatIf(999999, input) // 어떤 전략으로도 불가능한 가격
    expect(constrained!.affordableNow).toBe(false)
    expect(constrained!.unlocks).toHaveLength(0)
    expect(constrained!.gap).toBeGreaterThan(0)
  })

  it('excludes region cards (매물 지역은 고정)', () => {
    const input: WhatIfInput = { ...baseInput, finance: { ...baseFinance, existingLoanPayment: 150 } }
    const r = buildPropertyWhatIf(200000, input)
    const all = [...r!.unlocks, ...r!.improvements]
    expect(all.find(s => s.id === 'region-widen')).toBeUndefined()
    expect(all.find(s => s.id === 'region-metro')).toBeUndefined()
  })

  it('returns null without income or price', () => {
    expect(buildPropertyWhatIf(0, baseInput)).toBeNull()
    expect(buildPropertyWhatIf(50000, { ...baseInput, finance: { ...baseFinance, income: 0 } })).toBeNull()
  })
})
