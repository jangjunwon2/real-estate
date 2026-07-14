// 활성 매매 매물의 price를 국토부 실거래가 기반 시세로 갱신하는 공용 로직
// cron 라우트(/api/cron/price-sync)와 관리자 수동 트리거(/api/admin/price-sync)가 공유한다
import type { createServerClient } from '@/lib/supabase'
import { resolveLawdCode } from '@/lib/lawdCodes'
import { recentMonths, type MolitDeal } from '@/lib/molit'
import { getMonthDealsCached } from '@/lib/molitCache'
import { estimateMarketPrice } from '@/lib/priceSync'
import { logError } from '@/lib/logger'

const LOOKBACK_MONTHS = 6

type Db = ReturnType<typeof createServerClient>

interface SyncTarget {
  id: string
  price: number | null
  area_sqm: number | null
  complexes: { name: string; sigungu: string; road_address: string | null } | null
}

export interface PriceSyncReport {
  total: number
  updated: number
  unmatched: number
  skipped: number
  failedRegions: number
  changes: Array<{ id: string; title: string | null; before: number | null; after: number }>
  at: string
}

export async function runPriceSync(db: Db): Promise<PriceSyncReport> {
  const { data, error } = await db
    .from('properties')
    .select('id, price, area_sqm, title, complexes(name, sigungu, road_address)')
    .eq('status', 'active')
    .eq('property_type', 'sale')
  if (error) throw new Error(error.message)

  const properties = (data ?? []) as unknown as (SyncTarget & { title: string | null })[]
  const months = recentMonths(LOOKBACK_MONTHS)

  // 지역(법정동코드) 단위로 묶어 실거래 조회를 재사용한다
  const byLawd = new Map<string, (SyncTarget & { title: string | null })[]>()
  let skipped = 0
  for (const p of properties) {
    const lawdCd = p.complexes
      ? resolveLawdCode(p.complexes.sigungu, p.complexes.road_address)
      : null
    if (!lawdCd) { skipped++; continue }
    byLawd.set(lawdCd, [...(byLawd.get(lawdCd) ?? []), p])
  }

  let updated = 0
  let unmatched = 0
  let failedRegions = 0
  const changes: PriceSyncReport['changes'] = []

  for (const [lawdCd, targets] of byLawd) {
    let deals: MolitDeal[]
    try {
      const settled = await Promise.allSettled(
        months.map(m => getMonthDealsCached(db, lawdCd, m)),
      )
      const fulfilled = settled.filter(
        (r): r is PromiseFulfilledResult<MolitDeal[]> => r.status === 'fulfilled',
      )
      if (fulfilled.length === 0) throw new Error(`${lawdCd} 전체 월 조회 실패`)
      deals = fulfilled.flatMap(r => r.value)
    } catch (e) {
      logError('runPriceSync', e, { lawdCd })
      failedRegions++
      continue
    }

    for (const p of targets) {
      const estimate = p.complexes
        ? estimateMarketPrice(deals, p.complexes.name, p.area_sqm)
        : null
      if (!estimate) { unmatched++; continue }
      if (estimate.priceManwon === p.price) continue

      const { error: updateError } = await db
        .from('properties')
        .update({ price: estimate.priceManwon })
        .eq('id', p.id)
      if (updateError) {
        logError('runPriceSync', new Error(updateError.message), { propertyId: p.id })
        continue
      }
      updated++
      changes.push({ id: p.id, title: p.title, before: p.price, after: estimate.priceManwon })
    }
  }

  return {
    total: properties.length,
    updated,
    unmatched,
    skipped,
    failedRegions,
    changes,
    at: new Date().toISOString(),
  }
}
