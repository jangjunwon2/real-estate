import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@/lib/supabase'
import { validateAdminRequest, unauthorized } from '@/lib/auth'
export const dynamic = 'force-dynamic'

function parseAIJson(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()
  return JSON.parse(cleaned)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await validateAdminRequest(req)) return unauthorized()
  const { id } = await params
  const db = createServerClient()

  const { data: property } = await db.from('properties')
    .select('*, complexes(name, sigungu)')
    .eq('id', id)
    .single()

  if (!property) return Response.json({ error: 'not found' }, { status: 404 })

  // 프롬프트 인젝션 방지: 신뢰할 수 없는 DB 데이터는 system 턴이 아닌 별도 user 턴으로 분리
  const safeData = {
    price: property.price,
    property_type: property.property_type,
    area_sqm: property.area_sqm,
    floor: property.floor,
    source: property.source,
    auction_date: property.auction_date,
    bid_count: property.bid_count,
    subscription_start: property.subscription_start,
    subscription_end: property.subscription_end,
    complex_name: (property.complexes as { name?: string } | null)?.name,
    sigungu: (property.complexes as { sigungu?: string } | null)?.sigungu,
  }
  const anthropic = new Anthropic()
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: '부동산 매물 데이터를 분석하여 JSON 점수를 반환하는 AI입니다. 아래 형식 외 다른 응답은 하지 않습니다: {"price_score":0-20,"location_score":0-25,"complex_score":0-20,"demand_score":0-20,"regulatory_score":0-15,"pros":["장점"],"cons":["단점"],"ai_summary":"2줄 요약","personalized_reason":"맞춤 이유 1줄"}',
    messages: [{
      role: 'user',
      content: `다음 매물 데이터를 분석하여 JSON만 응답하세요:\n${JSON.stringify(safeData)}`,
    }],
  })

  let result: unknown
  try {
    result = parseAIJson((msg.content[0] as Anthropic.TextBlock).text)
  } catch {
    return Response.json({ error: 'AI 응답 파싱 실패' }, { status: 502 })
  }
  const r = result as Record<string, unknown>
  const clamp = (v: unknown, max: number) => Math.min(Math.max(Number(v) || 0, 0), max)
  const price_score = clamp(r.price_score, 20)
  const location_score = clamp(r.location_score, 25)
  const complex_score = clamp(r.complex_score, 20)
  const demand_score = clamp(r.demand_score, 20)
  const regulatory_score = clamp(r.regulatory_score, 15)
  const total = price_score + location_score + complex_score + demand_score + regulatory_score

  const { data, error } = await db.from('property_scores')
    .upsert({
      property_id: id,
      price_score, location_score, complex_score, demand_score, regulatory_score,
      pros: Array.isArray(r.pros) ? r.pros.slice(0, 5) : [],
      cons: Array.isArray(r.cons) ? r.cons.slice(0, 5) : [],
      ai_summary: typeof r.ai_summary === 'string' ? r.ai_summary.slice(0, 500) : '',
      personalized_reason: typeof r.personalized_reason === 'string' ? r.personalized_reason.slice(0, 200) : '',
      total_score: total, scored_at: new Date().toISOString(),
    })
    .select().single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ score: data })
}
