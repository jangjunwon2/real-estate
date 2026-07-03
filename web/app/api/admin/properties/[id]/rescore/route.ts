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

  const anthropic = new Anthropic()
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `부동산 매물 AI 점수 분석 후 JSON만 응답:\n매물: ${JSON.stringify(property)}\n{"price_score":0-20,"location_score":0-25,"complex_score":0-20,"demand_score":0-20,"regulatory_score":0-15,"pros":["장점"],"cons":["단점"],"ai_summary":"2줄 요약","personalized_reason":"맞춤 이유 1줄"}`,
    }],
  })

  let result: unknown
  try {
    result = parseAIJson((msg.content[0] as Anthropic.TextBlock).text)
  } catch {
    return Response.json({ error: 'AI 응답 파싱 실패' }, { status: 502 })
  }
  const r = result as Record<string, unknown>
  const total =
    (Number(r.price_score) || 0) +
    (Number(r.location_score) || 0) +
    (Number(r.complex_score) || 0) +
    (Number(r.demand_score) || 0) +
    (Number(r.regulatory_score) || 0)

  const { data, error } = await db.from('property_scores')
    .upsert({ property_id: id, ...r, total_score: total, scored_at: new Date().toISOString() })
    .select().single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ score: data })
}
