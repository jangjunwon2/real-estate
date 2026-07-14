// 관리자 수동 트리거: 매물 가격 실거래가 동기화
// 관리자 세션 쿠키 또는 x-admin-key로 인증 (validateAdminRequest)
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { validateAdminRequest, unauthorized } from '@/lib/auth'
import { runPriceSync } from '@/lib/runPriceSync'
import { logError } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  if (!await validateAdminRequest(req)) return unauthorized()
  if (!process.env.MOLIT_API_KEY) {
    return Response.json({ error: 'MOLIT_API_KEY가 설정되지 않았습니다' }, { status: 503 })
  }

  try {
    const report = await runPriceSync(createServerClient())
    return Response.json(report)
  } catch (e) {
    logError('admin/price-sync', e)
    const message = e instanceof Error ? e.message : '동기화에 실패했습니다'
    return Response.json({ error: message }, { status: 500 })
  }
}
