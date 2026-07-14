// 매물 가격 실거래가 동기화 (Vercel Cron 매일 실행)
// 인증: CRON_SECRET Bearer(Vercel 자동 주입) 또는 x-admin-key 헤더
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { validateAdminKey } from '@/lib/auth'
import { runPriceSync } from '@/lib/runPriceSync'
import { logError } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

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

  try {
    const report = await runPriceSync(createServerClient())
    return Response.json(report)
  } catch (e) {
    logError('cron/price-sync', e)
    const message = e instanceof Error ? e.message : 'internal error'
    return Response.json({ error: message }, { status: 500 })
  }
}
