import { formatPrice } from '@/lib/formatPrice'
import Link from 'next/link'

const SQM_PER_PYEONG = 3.3058

function toPyeong(sqm: number) { return sqm / SQM_PER_PYEONG }
function pricePer(price: number, sqm: number) { return price / toPyeong(sqm) }

type FloorBand = '저층 (1~5층)' | '중층 (6~15층)' | '고층 (16층+)'
function floorBand(floor: number | null): FloorBand | null {
  if (!floor) return null
  if (floor <= 5) return '저층 (1~5층)'
  if (floor <= 15) return '중층 (6~15층)'
  return '고층 (16층+)'
}

type SizeBand = '소형 (~59m²)' | '중소형 (59~84m²)' | '중형 (84~115m²)' | '대형 (115m²+)'
function sizeBand(sqm: number | null): SizeBand | null {
  if (!sqm) return null
  if (sqm < 59) return '소형 (~59m²)'
  if (sqm < 84) return '중소형 (59~84m²)'
  if (sqm < 115) return '중형 (84~115m²)'
  return '대형 (115m²+)'
}

const FLOOR_ORDER: FloorBand[] = ['저층 (1~5층)', '중층 (6~15층)', '고층 (16층+)']
const SIZE_ORDER: SizeBand[] = ['소형 (~59m²)', '중소형 (59~84m²)', '중형 (84~115m²)', '대형 (115m²+)']

export interface SameComplexProp {
  id: string; price: number | null; area_sqm: number | null; floor: number | null; property_type: string
}
export interface NearbyProp {
  id: string; price: number | null; area_sqm: number | null; floor: number | null; property_type: string
  complexes: { name: string; sigungu: string } | null
}

interface Props {
  currentId: string; currentPrice: number | null; currentSqm: number | null; currentFloor: number | null
  sameComplex: SameComplexProp[]; nearbyProps: NearbyProp[]; sigungu: string | null; complexName: string | null
}

function DiffBadge({ pct }: { pct: number }) {
  if (pct === 0) return null
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${pct > 0 ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-600'}`}>
      {pct > 0 ? '+' : ''}{pct}%
    </span>
  )
}

function PriceBar({ value, max, isCurrent }: { value: number; max: number; isCurrent: boolean }) {
  const pct = Math.round((value / max) * 100)
  return (
    <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${isCurrent ? 'bg-indigo-500' : 'bg-gray-300'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export default function PriceComparisonSection({
  currentId, currentPrice, currentSqm, currentFloor,
  sameComplex, nearbyProps, sigungu, complexName,
}: Props) {
  const curFloorBand = floorBand(currentFloor)
  const curSizeBand = sizeBand(currentSqm)
  const curPPP = currentPrice && currentSqm ? pricePer(currentPrice, currentSqm) : null

  // Floor stats
  const floorMap: Record<string, number[]> = {}
  const allUnits = [
    ...sameComplex,
    ...(currentPrice && currentFloor ? [{ id: currentId, price: currentPrice, area_sqm: currentSqm, floor: currentFloor, property_type: 'sale' }] : []),
  ]
  for (const p of allUnits) {
    if (!p.price || !p.floor) continue
    const b = floorBand(p.floor)
    if (!b) continue
    if (!floorMap[b]) floorMap[b] = []
    floorMap[b].push(p.price)
  }
  const floorStats = FLOOR_ORDER
    .filter(b => floorMap[b]?.length >= 1)
    .map(b => ({ band: b, avg: floorMap[b].reduce((a, c) => a + c, 0) / floorMap[b].length, count: floorMap[b].length }))

  // Size stats
  const sizeMap: Record<string, { prices: number[]; sqms: number[] }> = {}
  for (const p of allUnits) {
    if (!p.price || !p.area_sqm) continue
    const b = sizeBand(p.area_sqm)
    if (!b) continue
    if (!sizeMap[b]) sizeMap[b] = { prices: [], sqms: [] }
    sizeMap[b].prices.push(p.price)
    sizeMap[b].sqms.push(p.area_sqm)
  }
  const sizeStats = SIZE_ORDER
    .filter(b => sizeMap[b]?.prices.length >= 1)
    .map(b => {
      const { prices, sqms } = sizeMap[b]
      const avgPrice = prices.reduce((a, c) => a + c, 0) / prices.length
      const avgSqm = sqms.reduce((a, c) => a + c, 0) / sqms.length
      return { band: b, avgPrice, avgPPP: pricePer(avgPrice, avgSqm), count: prices.length }
    })

  const maxFloorAvg = Math.max(...floorStats.map(s => s.avg), 1)
  const maxSizeAvg = Math.max(...sizeStats.map(s => s.avgPrice), 1)
  const hasFloor = floorStats.length >= 2
  const hasSize = sizeStats.length >= 2
  const hasSameComplex = sameComplex.length > 0
  const hasNearby = nearbyProps.length > 0

  if (!hasSameComplex && !hasFloor && !hasSize && !hasNearby) return null

  return (
    <section className="space-y-5">
      <div className="flex items-center gap-2">
        <span className="text-lg">📊</span>
        <h2 className="font-bold text-gray-800">가격 비교 분석</h2>
      </div>

      {/* 층별 가격 바 차트 */}
      {hasFloor && (
        <div className="rounded-2xl border border-gray-100 p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">층별 가격 현황</p>
          <div className="space-y-2.5">
            {floorStats.map(stat => {
              const isCurrent = stat.band === curFloorBand
              const diffPct = currentPrice ? Math.round(((stat.avg - currentPrice) / currentPrice) * 100) : null
              return (
                <div key={stat.band} className={`rounded-xl p-3 space-y-1.5 ${isCurrent ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'bg-gray-50'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-700">{stat.band}</span>
                      {isCurrent && <span className="text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-full font-medium">현재</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {!isCurrent && diffPct !== null && <DiffBadge pct={diffPct} />}
                      <span className="text-sm font-bold text-gray-900">{formatPrice(Math.round(stat.avg))}</span>
                    </div>
                  </div>
                  <PriceBar value={stat.avg} max={maxFloorAvg} isCurrent={isCurrent} />
                  <p className="text-[10px] text-gray-400">{stat.count}건 평균</p>
                </div>
              )
            })}
          </div>
          <p className="text-[10px] text-gray-400">* 동일 단지 등록 매물 기준</p>
        </div>
      )}

      {/* 평형별 가격 바 차트 */}
      {hasSize && (
        <div className="rounded-2xl border border-gray-100 p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">평형별 가격대</p>
          <div className="space-y-2.5">
            {sizeStats.map(stat => {
              const isCurrent = stat.band === curSizeBand
              const diffPct = currentPrice ? Math.round(((stat.avgPrice - currentPrice) / currentPrice) * 100) : null
              return (
                <div key={stat.band} className={`rounded-xl p-3 space-y-1.5 ${isCurrent ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'bg-gray-50'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-700">{stat.band}</span>
                      {isCurrent && <span className="text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-full font-medium">현재</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {!isCurrent && diffPct !== null && <DiffBadge pct={diffPct} />}
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">{formatPrice(Math.round(stat.avgPrice))}</p>
                        <p className="text-[10px] text-gray-400">평당 {Math.round(stat.avgPPP / 10000).toLocaleString()}만원</p>
                      </div>
                    </div>
                  </div>
                  <PriceBar value={stat.avgPrice} max={maxSizeAvg} isCurrent={isCurrent} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 단지 내 다른 매물 */}
      {hasSameComplex && (
        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">단지 내 다른 매물 ({sameComplex.length}건)</p>
          <div className="grid grid-cols-2 gap-2">
            {sameComplex.slice(0, 6).map(p => {
              const pyeong = p.area_sqm ? Math.round(toPyeong(p.area_sqm)) : null
              const ppp = p.price && p.area_sqm ? Math.round(pricePer(p.price, p.area_sqm) / 10000) : null
              const diffPct = currentPrice && p.price ? Math.round(((p.price - currentPrice) / currentPrice) * 100) : null
              const cheaper = diffPct !== null && diffPct < 0
              return (
                <Link key={p.id} href={`/properties/${p.id}`}
                  className={`rounded-xl border p-3 hover:shadow-sm transition-all ${cheaper ? 'border-blue-100 bg-blue-50/50' : 'border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/30'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex gap-1 flex-wrap">
                      {p.floor && <span className="text-[10px] text-gray-400">{p.floor}층</span>}
                      {pyeong && <span className="text-[10px] text-gray-400">{pyeong}평</span>}
                    </div>
                    {diffPct !== null && <DiffBadge pct={diffPct} />}
                  </div>
                  {p.price && <p className="text-sm font-bold text-gray-900">{formatPrice(p.price)}</p>}
                  {ppp && <p className="text-[10px] text-gray-400 mt-0.5">평당 {ppp.toLocaleString()}만</p>}
                </Link>
              )
            })}
          </div>
          {curPPP && (
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
              현재 매물 평당가 <span className="font-semibold text-gray-700">{Math.round(curPPP / 10000).toLocaleString()}만원</span>
            </p>
          )}
        </div>
      )}

      {/* 인근 유사 매물 */}
      {hasNearby && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">인근 유사 매물{sigungu ? ` · ${sigungu}` : ''}</p>
          <div className="space-y-1.5">
            {nearbyProps.map(p => {
              const pyeong = p.area_sqm ? Math.round(toPyeong(p.area_sqm)) : null
              const diffPct = currentPrice && p.price ? Math.round(((p.price - currentPrice) / currentPrice) * 100) : null
              return (
                <Link key={p.id} href={`/properties/${p.id}`}
                  className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2.5 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group">
                  <div>
                    <p className="text-xs font-semibold text-gray-800 group-hover:text-indigo-700 transition-colors">{p.complexes?.name ?? '매물'}</p>
                    <div className="flex gap-1.5 mt-0.5">
                      {pyeong && <span className="text-[10px] text-gray-400">{pyeong}평</span>}
                      {p.floor && <span className="text-[10px] text-gray-400">{p.floor}층</span>}
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    {diffPct !== null && <DiffBadge pct={diffPct} />}
                    {p.price && <p className="text-sm font-bold text-gray-900">{formatPrice(p.price)}</p>}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* 공공 데이터 */}
      <div className="rounded-2xl bg-gray-50 p-4 space-y-2.5">
        <p className="text-xs font-semibold text-gray-600">실거래가 · 공시지가 공공 데이터</p>
        <div className="grid grid-cols-1 gap-2">
          <a href="https://rt.molit.go.kr" target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between rounded-xl bg-white border border-gray-200 px-3 py-2.5 hover:border-indigo-300 hover:shadow-sm transition-all">
            <div>
              <p className="text-xs font-semibold text-gray-800">국토교통부 실거래가</p>
              <p className="text-[10px] text-gray-400">아파트 실제 거래 내역 조회</p>
            </div>
            <span className="text-gray-300 text-sm">→</span>
          </a>
          <a href="https://www.realtyprice.kr/notice/town/nfSiteLink.htm" target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between rounded-xl bg-white border border-gray-200 px-3 py-2.5 hover:border-indigo-300 hover:shadow-sm transition-all">
            <div>
              <p className="text-xs font-semibold text-gray-800">부동산공시가격 알리미</p>
              <p className="text-[10px] text-gray-400">개별 공시지가 · 주택 공시가격</p>
            </div>
            <span className="text-gray-300 text-sm">→</span>
          </a>
          {complexName && (
            <a href={`https://new.land.naver.com/complexes?ms=37.5,127.0,15&a=APT&e=RETAIL&keyword=${encodeURIComponent(complexName)}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between rounded-xl bg-white border border-gray-200 px-3 py-2.5 hover:border-indigo-300 hover:shadow-sm transition-all">
              <div>
                <p className="text-xs font-semibold text-gray-800">네이버 부동산 실거래가</p>
                <p className="text-[10px] text-gray-400">{complexName} 단지 내 거래 이력</p>
              </div>
              <span className="text-gray-300 text-sm">→</span>
            </a>
          )}
        </div>
      </div>
    </section>
  )
}
