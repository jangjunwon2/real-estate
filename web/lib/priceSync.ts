// 매물 가격을 국토부 실거래가 기반 시세로 동기화하기 위한 산출 로직
// 단지명 + 유사 면적(±10%) 거래만 비교군으로 사용해 최근 거래 평균을 계산한다

import { matchesComplex, type MolitDeal } from './molit'

export interface PriceEstimate {
  priceManwon: number
  dealCount: number
  latestDealDate: string
}

const AREA_TOLERANCE_PCT = 10
const RECENT_DEALS_USED = 3

export function estimateMarketPrice(
  deals: MolitDeal[],
  complexName: string,
  areaSqm: number | null,
): PriceEstimate | null {
  // 매물 면적을 모르면 다른 평형 거래와 섞여 왜곡되므로 산출하지 않는다
  if (!areaSqm || !Number.isFinite(areaSqm) || areaSqm <= 0) return null

  const minArea = areaSqm * (1 - AREA_TOLERANCE_PCT / 100)
  const maxArea = areaSqm * (1 + AREA_TOLERANCE_PCT / 100)
  const comparable = deals
    .filter(d =>
      matchesComplex(d.aptName, complexName) &&
      d.areaSqm !== null && d.areaSqm >= minArea && d.areaSqm <= maxArea,
    )
    .sort((a, b) => b.dealDate.localeCompare(a.dealDate))
    .slice(0, RECENT_DEALS_USED)

  if (comparable.length === 0) return null

  const avg = comparable.reduce((sum, d) => sum + d.priceManwon, 0) / comparable.length
  return {
    priceManwon: Math.round(avg),
    dealCount: comparable.length,
    latestDealDate: comparable[0].dealDate,
  }
}
