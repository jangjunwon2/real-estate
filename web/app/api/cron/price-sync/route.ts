// 매물 가격 실거래가 동기화: 활성 매매 매물의 price를
// 동일 단지·유사 면적 최근 실거래 평균으로 갱신한다 (Vercel Cron 매일 실행)
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { validateAdminKey } from '@/lib/auth'
import { resolveLawdCode } from '@/lib/lawdCodes'
import { recentMonths, type MolitDeal } from '@/lib/molit'
import { getMonthDealsCached } from '@/lib/molitCache'
import { estimateMarketPrice } from '@/lib/priceSync'
import { logError } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const LOOKBACK_MONTHS = 6

interface SyncTarget {
  id: string
  price: number | null
  area_sqm: number | null
  complexes: { name: string; sigungu: string; road_address: string | null } | null
}

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.get('authorization') === `Bearer ${cronSecret}`) return true
  return validateAdminKey(req)
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!process.env.MOLIT_API_KEY) {
    return Response.json({ error: 'MOLIT_API_KEY not configured' }, { status: 503 })
  }

  const db = createServerClient()
  const { data, error } = await db
    .from('properties')
    .select('id, price, area_sqm, complexes(name, sigungu, road_address)')
    .eq('status', 'active')
    .eq('property_type', 'sale')
  if (error) {
    logError('cron/price-sync', new Error(error.message))
    return Response.json({ error: error.message }, { status: 500 })
  }

  const properties = (data ?? []) as unknown as SyncTarget[]
  const months = recentMonths(LOOKBACK_MONTHS)

  // 지역(법정동코드) 단위로 묶어 실거래 조회를 재사용한다
  const byLawd = new Map<string, SyncTarget[]>()
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
  const changes: Array<{ id: string; before: number | null; after: number }> = []

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
      logError('cron/price-sync', e, { lawdCd })
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
        logError('cron/price-sync', new Error(updateError.message), { propertyId: p.id })
        continue
      }
      updated++
      changes.push({ id: p.id, before: p.price, after: estimate.priceManwon })
    }
  }

  return Response.json({
    total: properties.length,
    updated,
    unmatched,
    skipped,
    failedRegions,
    changes,
    at: new Date().toISOString(),
  })
}
