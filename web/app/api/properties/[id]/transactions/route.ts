import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { resolveLawdCode } from '@/lib/lawdCodes'
import {
  fetchMonthDeals, matchesComplex, recentMonths, summarizeDeals,
  MolitApiError, type MolitDeal,
} from '@/lib/molit'

export const dynamic = 'force-dynamic'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const LOOKBACK_MONTHS = 6
const MAX_DEALS = 30

type Db = ReturnType<typeof createServerClient>

async function getMonthDealsCached(db: Db, lawdCd: string, dealYm: string): Promise<MolitDeal[]> {
  // 캐시는 최적화 수단일 뿐이므로 테이블 부재 등 캐시 계층 오류는 API 직접 조회로 폴백
  const { data: cached } = await db
    .from('molit_deals_cache')
    .select('deals, fetched_at')
    .eq('lawd_cd', lawdCd)
    .eq('deal_ym', dealYm)
    .maybeSingle()

  if (cached && Date.now() - new Date(cached.fetched_at).getTime() < CACHE_TTL_MS) {
    return cached.deals as MolitDeal[]
  }

  const deals = await fetchMonthDeals(lawdCd, dealYm)
  await db.from('molit_deals_cache').upsert({
    lawd_cd: lawdCd,
    deal_ym: dealYm,
    deals,
    fetched_at: new Date().toISOString(),
  })
  return deals
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!process.env.MOLIT_API_KEY) {
    return Response.json({ error: '실거래가 조회가 설정되지 않았습니다' }, { status: 503 })
  }

  const db = createServerClient()
  const { data: property, error } = await db
    .from('properties')
    .select('id, price, complexes(name, sigungu, road_address)')
    .eq('id', id)
    .single()
  if (error || !property) return Response.json({ error: '매물을 찾을 수 없습니다' }, { status: 404 })

  const complex = property.complexes as unknown as
    { name: string; sigungu: string; road_address: string | null } | null
  if (!complex?.name) {
    return Response.json({ error: '단지 정보가 없는 매물입니다' }, { status: 404 })
  }

  const lawdCd = resolveLawdCode(complex.sigungu, complex.road_address)
  if (!lawdCd) {
    return Response.json({ error: '지원하지 않는 지역입니다' }, { status: 422 })
  }

  try {
    const settled = await Promise.allSettled(
      recentMonths(LOOKBACK_MONTHS).map(m => getMonthDealsCached(db, lawdCd, m)),
    )
    const fulfilled = settled.filter(
      (r): r is PromiseFulfilledResult<MolitDeal[]> => r.status === 'fulfilled',
    )
    if (fulfilled.length === 0) {
      const firstReason = settled.find(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      )?.reason
      const message = firstReason instanceof MolitApiError
        ? firstReason.message
        : '실거래가 조회에 실패했습니다. 잠시 후 다시 시도해 주세요.'
      return Response.json({ error: message }, { status: 502 })
    }

    const matched = fulfilled
      .flatMap(r => r.value)
      .filter(d => matchesComplex(d.aptName, complex.name))
      .sort((a, b) => b.dealDate.localeCompare(a.dealDate))

    return Response.json({
      deals: matched.slice(0, MAX_DEALS),
      summary: summarizeDeals(matched, property.price ?? null),
      months: LOOKBACK_MONTHS,
    })
  } catch (e: unknown) {
    const message = e instanceof MolitApiError
      ? e.message
      : '실거래가 조회에 실패했습니다. 잠시 후 다시 시도해 주세요.'
    return Response.json({ error: message }, { status: 502 })
  }
}
