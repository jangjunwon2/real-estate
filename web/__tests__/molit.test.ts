import { describe, it, expect } from 'vitest'
import {
  parseMolitXml, normalizeAptName, matchesComplex,
  summarizeDeals, recentMonths, MolitApiError,
} from '../lib/molit'

const OK_XML = `<?xml version="1.0" encoding="UTF-8"?>
<response>
  <header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header>
  <body><items>
    <item><aptNm>마포래미안푸르지오</aptNm><dealAmount> 184,000</dealAmount><dealYear>2026</dealYear><dealMonth>6</dealMonth><dealDay>15</dealDay><excluUseAr>84.59</excluUseAr><floor>12</floor></item>
    <item><aptNm>취소된아파트</aptNm><dealAmount>100,000</dealAmount><dealYear>2026</dealYear><dealMonth>6</dealMonth><dealDay>2</dealDay><cdealType>O</cdealType></item>
    <item><aptNm>층없는아파트</aptNm><dealAmount>50,000</dealAmount><dealYear>2026</dealYear><dealMonth>5</dealMonth><dealDay>3</dealDay></item>
  </items></body>
</response>`

const EMPTY_XML = `<?xml version="1.0" encoding="UTF-8"?>
<response><header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header><body><items></items></body></response>`

const AUTH_ERROR_XML = `<OpenAPI_ServiceResponse><cmmMsgHeader><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg><returnReasonCode>30</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>`

describe('parseMolitXml', () => {
  it('거래 항목을 파싱한다', () => {
    const deals = parseMolitXml(OK_XML)
    expect(deals).toHaveLength(2)
    expect(deals[0]).toEqual({
      aptName: '마포래미안푸르지오',
      dealDate: '2026-06-15',
      floor: 12,
      areaSqm: 84.59,
      priceManwon: 184000,
    })
  })

  it('해제(취소) 거래는 제외한다', () => {
    const names = parseMolitXml(OK_XML).map(d => d.aptName)
    expect(names).not.toContain('취소된아파트')
  })

  it('층/면적이 없으면 null로 파싱한다', () => {
    const deal = parseMolitXml(OK_XML).find(d => d.aptName === '층없는아파트')
    expect(deal?.floor).toBeNull()
    expect(deal?.areaSqm).toBeNull()
  })

  it('빈 결과는 빈 배열', () => {
    expect(parseMolitXml(EMPTY_XML)).toEqual([])
  })

  it('인증 오류 응답이면 MolitApiError를 던진다', () => {
    expect(() => parseMolitXml(AUTH_ERROR_XML)).toThrow(MolitApiError)
    expect(() => parseMolitXml(AUTH_ERROR_XML)).toThrow(/SERVICE_KEY/)
  })
})

describe('normalizeAptName / matchesComplex', () => {
  it('공백·괄호·특수문자를 제거해 정규화한다', () => {
    expect(normalizeAptName('마포 래미안-푸르지오 (1단지)')).toBe('마포래미안푸르지오')
  })

  it('부분일치를 허용한다 (양방향)', () => {
    expect(matchesComplex('래미안푸르지오', '마포래미안푸르지오')).toBe(true)
    expect(matchesComplex('마포래미안푸르지오', '래미안푸르지오')).toBe(true)
  })

  it('무관한 단지는 매칭하지 않는다', () => {
    expect(matchesComplex('송파헬리오시티', '마포래미안푸르지오')).toBe(false)
  })

  it('빈 문자열은 매칭하지 않는다', () => {
    expect(matchesComplex('', '마포래미안푸르지오')).toBe(false)
  })
})

describe('summarizeDeals', () => {
  const deals = [
    { aptName: 'a', dealDate: '2026-06-01', floor: 1, areaSqm: 84, priceManwon: 80000 },
    { aptName: 'a', dealDate: '2026-05-01', floor: 2, areaSqm: 84, priceManwon: 90000 },
  ]

  it('건수·평균가·현재가 대비 %를 계산한다', () => {
    const s = summarizeDeals(deals, 90000)
    expect(s.count).toBe(2)
    expect(s.avgPriceManwon).toBe(85000)
    expect(s.vsCurrentPct).toBeCloseTo(5.9, 1)
  })

  it('현재가가 없으면 vsCurrentPct는 null', () => {
    expect(summarizeDeals(deals, null).vsCurrentPct).toBeNull()
  })

  it('거래가 없으면 모두 null/0', () => {
    expect(summarizeDeals([], 90000)).toEqual({ count: 0, avgPriceManwon: null, vsCurrentPct: null })
  })
})

describe('recentMonths', () => {
  it('현재 월부터 과거로 YYYYMM 목록을 만든다', () => {
    expect(recentMonths(3, new Date(2026, 6, 13))).toEqual(['202607', '202606', '202605'])
  })

  it('연도 경계를 넘는다', () => {
    expect(recentMonths(3, new Date(2026, 0, 5))).toEqual(['202601', '202512', '202511'])
  })
})
