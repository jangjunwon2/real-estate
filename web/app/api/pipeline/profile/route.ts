import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { validatePipelineKey, unauthorized } from '@/lib/auth'
export const dynamic = 'force-dynamic'

// 파이프라인(매물 AI 점수)용 사용자 프로필 요약.
// 단일 사용자 MVP 기준 — 가장 최근 갱신된 user_preferences를 대표 프로필로 사용한다.
export async function GET(req: NextRequest) {
  if (!validatePipelineKey(req)) return unauthorized()
  const db = createServerClient()
  const { data, error } = await db.from('user_preferences')
    .select('regions,budget_max,monthly_income,is_newlywed,is_first_buyer,num_children,self_home_status,spouse_home_status,marriage_status,buyer_type')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!data) return Response.json({ profile: null })

  const homeCount = (s: string | null) => (s === 'one' ? 1 : s === 'multiple' ? 2 : 0)
  return Response.json({
    profile: {
      regions: data.regions ?? [],
      budget_max: data.budget_max ?? 0,
      income: data.monthly_income ?? 0,
      is_newlywed: data.is_newlywed ?? false,
      is_first_buyer: data.is_first_buyer ?? false,
      num_children: data.num_children ?? 0,
      owned_homes: homeCount(data.self_home_status) + homeCount(data.spouse_home_status),
      marriage_status: data.marriage_status ?? null,
      buyer_type: data.buyer_type ?? 'solo',
    },
  })
}
