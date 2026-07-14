import { describe, it, expect } from 'vitest'
import { estimateMarketPrice } from '../lib/priceSync'
import type { MolitDeal } from '../lib/molit'

function deal(overrides: Partial<MolitDeal>): MolitDeal {
  return {
    aptName: '마포래미안푸르지오',
    dealDate: '2026-06-15',
    floor: 10,
    areaSqm: 84.59,
    priceManwon: 180000,
    ...overrides,
  }
}

describe('estimateMarketPrice', () => {
  it('단지명·면적이 일치하는 최근 거래 평균으로 시세를 산출한다', () => {
    const deals = [
      deal({ dealDate: '2026-06-15', priceManwon: 184000 }),
      deal({ dealDate: '2026-05-20', priceManwon: 180000 }),
      deal({ dealDate: '2026-04-10', priceManwon: 176000 }),
    ]
    const est = estimateMarketPrice(deals, '마포래미안푸르지오', 84.95)
    expect(est).not.toBeNull()
    expect(est!.priceManwon).toBe(180000)
    expect(est!.dealCount).toBe(3)
    expect(est!.latestDealDate).toBe('2026-06-15')
  })

  it('최근 3건만 평균에 사용한다', () => {
    const deals = [
      deal({ dealDate: '2026-06-01', priceManwon: 180000 }),
      deal({ dealDate: '2026-05-01', priceManwon: 180000 }),
      deal({ dealDate: '2026-04-01', priceManwon: 180000 }),
      deal({ dealDate: '2026-01-01', priceManwon: 90000 }), // 오래된 거래 — 제외
    ]
    const est = estimateMarketPrice(deals, '마포래미안푸르지오', 84.95)
    expect(est!.priceManwon).toBe(180000)
    expect(est!.dealCount).toBe(3)
  })

  it('입력 순서와 무관하게 날짜 내림차순으로 정렬해 사용한다', () => {
    const deals = [
      deal({ dealDate: '2026-01-01', priceManwon: 90000 }),
      deal({ dealDate: '2026-06-01', priceManwon: 180000 }),
      deal({ dealDate: '2026-05-01', priceManwon: 178000 }),
      deal({ dealDate: '2026-04-01', priceManwon: 182000 }),
    ]
    const est = estimateMarketPrice(deals, '마포래미안푸르지오', 84.95)
    expect(est!.priceManwon).toBe(180000)
    expect(est!.latestDealDate).toBe('2026-06-01')
  })

  it('다른 단지 거래는 제외한다', () => {
    const deals = [deal({ aptName: '송파헬리오시티', priceManwon: 250000 })]
    expect(estimateMarketPrice(deals, '마포래미안푸르지오', 84.95)).toBeNull()
  })

  it('면적 허용 오차(±10%)를 벗어난 거래는 제외한다', () => {
    const deals = [
      deal({ areaSqm: 59.91, priceManwon: 130000 }), // 59타입 — 84 매물과 비교 불가
      deal({ areaSqm: 84.59, priceManwon: 180000 }),
    ]
    const est = estimateMarketPrice(deals, '마포래미안푸르지오', 84.95)
    expect(est!.priceManwon).toBe(180000)
    expect(est!.dealCount).toBe(1)
  })

  it('면적 정보가 없는 거래는 제외한다', () => {
    const deals = [deal({ areaSqm: null, priceManwon: 999999 })]
    expect(estimateMarketPrice(deals, '마포래미안푸르지오', 84.95)).toBeNull()
  })

  it('매물 면적을 모르면 잘못된 비교를 피하기 위해 null을 반환한다', () => {
    const deals = [deal({})]
    expect(estimateMarketPrice(deals, '마포래미안푸르지오', null)).toBeNull()
    expect(estimateMarketPrice(deals, '마포래미안푸르지오', 0)).toBeNull()
  })

  it('일치하는 거래가 없으면 null을 반환한다', () => {
    expect(estimateMarketPrice([], '마포래미안푸르지오', 84.95)).toBeNull()
  })

  it('평균은 정수(만원)로 반올림한다', () => {
    const deals = [
      deal({ dealDate: '2026-06-01', priceManwon: 100001 }),
      deal({ dealDate: '2026-05-01', priceManwon: 100000 }),
    ]
    const est = estimateMarketPrice(deals, '마포래미안푸르지오', 84.95)
    expect(Number.isInteger(est!.priceManwon)).toBe(true)
    expect(est!.priceManwon).toBe(100001)
  })
})
