// 국토교통부 아파트 매매 실거래가 API 클라이언트
// 엔드포인트는 XML만 반환하므로 의존성 없이 정규식으로 파싱한다

export interface MolitDeal {
  aptName: string
  dealDate: string // 'YYYY-MM-DD'
  floor: number | null
  areaSqm: number | null
  priceManwon: number
}

export interface DealSummary {
  count: number
  avgPriceManwon: number | null
  vsCurrentPct: number | null
}

export class MolitApiError extends Error {}

const MOLIT_ENDPOINT =
  'https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade'
const FETCH_TIMEOUT_MS = 8000
const SUCCESS_CODES = ['000', '00']

function tagValue(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))
  const value = m?.[1].trim()
  return value ? value : null
}

export function parseMolitXml(xml: string): MolitDeal[] {
  const resultCode = tagValue(xml, 'resultCode')
  if (!resultCode || !SUCCESS_CODES.includes(resultCode)) {
    const msg =
      tagValue(xml, 'resultMsg') ?? tagValue(xml, 'returnAuthMsg') ?? '알 수 없는 오류'
    throw new MolitApiError(`국토부 API 오류: ${msg}`)
  }

  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? []
  const deals: MolitDeal[] = []
  for (const block of items) {
    if (tagValue(block, 'cdealType') === 'O') continue // 해제(취소)된 거래
    const aptName = tagValue(block, 'aptNm')
    const amountRaw = tagValue(block, 'dealAmount')
    const year = tagValue(block, 'dealYear')
    const month = tagValue(block, 'dealMonth')
    if (!aptName || !amountRaw || !year || !month) continue

    const priceManwon = Number(amountRaw.replace(/,/g, ''))
    if (!Number.isFinite(priceManwon) || priceManwon <= 0) continue

    const day = tagValue(block, 'dealDay') ?? '1'
    const floorRaw = tagValue(block, 'floor')
    const areaRaw = tagValue(block, 'excluUseAr')
    deals.push({
      aptName,
      dealDate: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
      floor: floorRaw !== null ? Number(floorRaw) : null,
      areaSqm: areaRaw !== null ? Number(areaRaw) : null,
      priceManwon,
    })
  }
  return deals
}

export function normalizeAptName(name: string): string {
  return name
    .replace(/\([^)]*\)/g, '')
    .replace(/[^가-힣a-zA-Z0-9]/g, '')
    .toLowerCase()
}

export function matchesComplex(aptName: string, complexName: string): boolean {
  const a = normalizeAptName(aptName)
  const c = normalizeAptName(complexName)
  if (!a || !c) return false
  return a.includes(c) || c.includes(a)
}

export function summarizeDeals(
  deals: MolitDeal[],
  currentPriceManwon: number | null,
): DealSummary {
  if (deals.length === 0) return { count: 0, avgPriceManwon: null, vsCurrentPct: null }
  const avg = deals.reduce((sum, d) => sum + d.priceManwon, 0) / deals.length
  const vsCurrentPct =
    currentPriceManwon && currentPriceManwon > 0
      ? Math.round(((currentPriceManwon - avg) / avg) * 1000) / 10
      : null
  return { count: deals.length, avgPriceManwon: Math.round(avg), vsCurrentPct }
}

export function recentMonths(count: number, now: Date = new Date()): string[] {
  const months: string[] = []
  const cursor = new Date(now.getFullYear(), now.getMonth(), 1)
  for (let i = 0; i < count; i++) {
    months.push(`${cursor.getFullYear()}${String(cursor.getMonth() + 1).padStart(2, '0')}`)
    cursor.setMonth(cursor.getMonth() - 1)
  }
  return months
}

export async function fetchMonthDeals(lawdCd: string, dealYm: string): Promise<MolitDeal[]> {
  const key = process.env.MOLIT_API_KEY
  if (!key) throw new MolitApiError('MOLIT_API_KEY가 설정되지 않았습니다')
  const url = `${MOLIT_ENDPOINT}?serviceKey=${encodeURIComponent(key)}&LAWD_CD=${lawdCd}&DEAL_YMD=${dealYm}&numOfRows=1000&pageNo=1`
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!res.ok) throw new MolitApiError(`국토부 API HTTP ${res.status}`)
  return parseMolitXml(await res.text())
}
