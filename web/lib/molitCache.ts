// molit_deals_cache 테이블을 통한 (법정동코드, 거래년월) 단위 실거래가 캐시 조회
// 캐시는 최적화 수단일 뿐이므로 테이블 부재 등 캐시 계층 오류는 API 직접 조회로 폴백

import type { createServerClient } from '@/lib/supabase'
import { fetchMonthDeals, type MolitDeal } from '@/lib/molit'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000

type Db = ReturnType<typeof createServerClient>

export async function getMonthDealsCached(
  db: Db,
  lawdCd: string,
  dealYm: string,
): Promise<MolitDeal[]> {
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
