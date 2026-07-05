import { formatPrice } from '@/lib/formatPrice'
import Link from 'next/link'

const SQM_PER_PYEONG = 3.3058

function sqmToPyeong(sqm: number) {
  return sqm / SQM_PER_PYEONG
}

function pricePerPyeong(price: number, sqm: number) {
  return price / sqmToPyeong(sqm)
}

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
  id: string
  price: number | null
  area_sqm: number | null
  floor: number | null
  property_type: string
}

export interface NearbyProp {
  id: string
  price: number | null
  area_sqm: number | null
  floor: number | null
  property_type: string
  complexes: { name: string; sigungu: string } | null
}

interface Props {
  currentId: string
  currentPrice: number | null
  currentSqm: number | null
  currentFloor: number | null
  sameComplex: SameComplexProp[]
  nearbyProps: NearbyProp[]
  sigungu: string | null
  complexName: string | null
}

export default function PriceComparisonSection({
  currentId,
  currentPrice,
  currentSqm,
  currentFloor,
  sameComplex,
  nearbyProps,
  sigungu,
  complexName,
}: Props) {
  const curFloorBand = floorBand(currentFloor)
  const curSizeBand = sizeBand(currentSqm)
  const curPPP = currentPrice && currentSqm ? pricePerPyeong(currentPrice, currentSqm) : null

  // Build floor stats including current property
  const floorMap: Record<string, number[]> = {}
  const allForFloor = [...sameComplex, ...(currentPrice && currentFloor ? [{ id: currentId, price: currentPrice, area_sqm: currentSqm, floor: currentFloor, property_type: 'sale' }] : [])]
  for (const p of allForFloor) {
    if (!p.price || !p.floor) continue
    const band = floorBand(p.floor)
    if (!band) continue
    if (!floorMap[band]) floorMap[band] = []
    floorMap[band].push(p.price)
  }
  const floorStats = FLOOR_ORDER
    .filter(b => floorMap[b]?.length >= 1)
    .map(b => ({ band: b, avg: floorMap[b].reduce((a, c) => a + c, 0) / floorMap[b].length, count: floorMap[b].length }))

  // Build size stats including current property
  const sizeMap: Record<string, { prices: number[]; sqms: number[] }> = {}
  const allForSize = [...sameComplex, ...(currentPrice && currentSqm ? [{ id: currentId, price: currentPrice, area_sqm: currentSqm, floor: currentFloor, property_type: 'sale' }] : [])]
  for (const p of allForSize) {
    if (!p.price || !p.area_sqm) continue
    const band = sizeBand(p.area_sqm)
    if (!band) continue
    if (!sizeMap[band]) sizeMap[band] = { prices: [], sqms: [] }
    sizeMap[band].prices.push(p.price)
    sizeMap[band].sqms.push(p.area_sqm)
  }
  const sizeStats = SIZE_ORDER
    .filter(b => sizeMap[b]?.prices.length >= 1)
    .map(b => {
      const { prices, sqms } = sizeMap[b]
      const avgPrice = prices.reduce((a, c) => a + c, 0) / prices.length
      const avgSqm = sqms.reduce((a, c) => a + c, 0) / sqms.length
      return { band: b, avgPrice, avgPPP: pricePerPyeong(avgPrice, avgSqm), count: prices.length }
    })

  const hasFloor = floorStats.length >= 2
  const hasSize = sizeStats.length >= 2
  const hasSameComplex = sameComplex.length > 0
  const hasNearby = nearbyProps.length > 0

  if (!hasSameComplex && !hasFloor && !hasSize && !hasNearby) return null

  return (
    <section className="space-y-5">
      <h2 className="font-semibold text-gray-800">가격 비교 분석</h2>

      {/* 단지 내 다른 매물 */}
      {hasSameComplex && (
        <div className="space-y-2.5">
          <p className="text-xs font-medium text-gray-500">단지 내 다른 매물 ({sameComplex.length}건)</p>
          <div className="grid grid-cols-2 gap-2">
            {sameComplex.slice(0, 6).map(p => {
              const pyeong = p.area_sqm ? Math.round(sqmToPyeong(p.area_sqm)) : null
              const ppp = p.price && p.area_sqm ? Math.round(pricePerPyeong(p.price, p.area_sqm) / 10000) : null
              const diffPct = currentPrice && p.price
                ? Math.round(((p.price - currentPrice) / currentPrice) * 100)
                : null
              return (
                <Link
                  key={p.id}
                  href={`/properties/${p.id}`}
                  className="rounded-lg border border-gray-100 p-2.5 hover:border-indigo-200 hover:bg-indigo-50/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-1 text-[10px] text-gray-400">
                    {p.floor && <span>{p.floor}층</span>}
                    {pyeong && <span>{pyeong}평</span>}
                    {diffPct !== null && (
                      <span className={diffPct > 0 ? 'text-red-400' : diffPct < 0 ? 'text-blue-500' : ''}>
                        {diffPct > 0 ? '+' : ''}{diffPct}%
                      </span>
                    )}
                  </div>
                  {p.price && <p className="text-sm font-semibold text-gray-800 mt-1">{formatPrice(p.price)}</p>}
                  {ppp && <p className="text-[10px] text-gray-400 mt-0.5">평당 {ppp.toLocaleString()}만원</p>}
                </Link>
              )
            })}
          </div>
          {curPPP && (
            <p className="text-[10px] text-gray-400">
              현재 매물 평당가: <span className="font-medium text-gray-600">{Math.round(curPPP / 10000).toLocaleString()}만원</span>
            </p>
          )}
        </div>
      )}

      {/* 층별 가격 현황 */}
      {hasFloor && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500">층별 가격 현황 (동일 단지 기준)</p>
          <div className="space-y-1.5">
            {floorStats.map(stat => {
              const isCurrent = stat.band === curFloorBand
              return (
                <div
                  key={stat.band}
                  className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${isCurrent ? 'bg-indigo-50 border border-indigo-200' : 'bg-gray-50'}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-700">{stat.band}</span>
                    {isCurrent && (
                      <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">현재 매물</span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-gray-800">{formatPrice(Math.round(stat.avg))}</span>
                    <span className="text-[10px] text-gray-400 ml-1">({stat.count}건 평균)</span>
                  </div>
                </div>
              )
            })}
          </div>
          {curFloorBand && currentPrice && floorStats.length >= 2 && (() => {
            const others = floorStats.filter(s => s.band !== curFloorBand)
            if (!others.length) return null
            const bestFloor = floorStats.find(s => s.band === '고층 (16층+)') ?? floorStats[floorStats.length - 1]
            const diff = bestFloor && curFloorBand !== bestFloor.band
              ? Math.round(((bestFloor.avg - currentPrice) / currentPrice) * 100)
              : null
            if (!diff) return null
            return (
              <p className="text-[10px] text-gray-500">
                고층 대비 현재 매물은{' '}
                <span className={diff > 0 ? 'text-blue-600 font-medium' : 'text-red-500 font-medium'}>
                  {diff > 0 ? `${diff}% 저렴` : `${Math.abs(diff)}% 비쌈`}
                </span>
              </p>
            )
          })()}
        </div>
      )}

      {/* 평형별 가격 */}
      {hasSize && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500">평형별 가격대 (동일 단지 기준)</p>
          <div className="space-y-1.5">
            {sizeStats.map(stat => {
              const isCurrent = stat.band === curSizeBand
              return (
                <div
                  key={stat.band}
                  className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${isCurrent ? 'bg-indigo-50 border border-indigo-200' : 'bg-gray-50'}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-700">{stat.band}</span>
                    {isCurrent && (
                      <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">현재</span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-gray-800">{formatPrice(Math.round(stat.avgPrice))}</span>
                    <p className="text-[10px] text-gray-400">평당 {Math.round(stat.avgPPP / 10000).toLocaleString()}만원</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 인근 유사 매물 */}
      {hasNearby && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500">인근 유사 매물{sigungu ? ` (${sigungu})` : ''}</p>
          <div className="space-y-1.5">
            {nearbyProps.map(p => {
              const pyeong = p.area_sqm ? Math.round(sqmToPyeong(p.area_sqm)) : null
              const diffPct = currentPrice && p.price
                ? Math.round(((p.price - currentPrice) / currentPrice) * 100)
                : null
              return (
                <Link
                  key={p.id}
                  href={`/properties/${p.id}`}
                  className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2.5 hover:border-indigo-200 hover:bg-indigo-50/40 transition-colors"
                >
                  <div>
                    <p className="text-xs font-medium text-gray-700">{p.complexes?.name ?? '매물'}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {pyeong && <span className="text-[10px] text-gray-400">{pyeong}평</span>}
                      {p.floor && <span className="text-[10px] text-gray-400">{p.floor}층</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    {p.price && <p className="text-sm font-semibold text-gray-800">{formatPrice(p.price)}</p>}
                    {diffPct !== null && (
                      <p className={`text-[10px] font-medium ${diffPct > 0 ? 'text-red-400' : diffPct < 0 ? 'text-blue-500' : 'text-gray-400'}`}>
                        {diffPct > 0 ? '+' : ''}{diffPct}%
                      </p>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* 공공 데이터 */}
      <div className="rounded-xl border border-dashed border-gray-200 p-4 space-y-2">
        <p className="text-xs font-semibold text-gray-600">실거래가 / 공시지가 확인</p>
        <p className="text-[10px] text-gray-400">정부 공개 데이터에서 정확한 실거래가와 공시지가를 확인하세요.</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
          <a
            href="https://rt.molit.go.kr"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-600 hover:underline font-medium"
          >
            국토교통부 실거래가 →
          </a>
          <a
            href="https://www.realtyprice.kr/notice/town/nfSiteLink.htm"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-600 hover:underline font-medium"
          >
            부동산공시가격 알리미 →
          </a>
          {complexName && sigungu && (
            <a
              href={`https://new.land.naver.com/complexes?ms=37.5,127.0,15&a=APT&e=RETAIL&keyword=${encodeURIComponent(complexName)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-600 hover:underline font-medium"
            >
              네이버 실거래가 →
            </a>
          )}
        </div>
      </div>
    </section>
  )
}
