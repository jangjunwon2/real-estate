import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
export const dynamic = 'force-dynamic'

function parseAIJson(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()
  return JSON.parse(cleaned)
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const db = createServerClient()

  const { data: property } = await db.from('properties')
    .select('id, price, area_sqm, floor, property_type, complexes(name, sigungu, built_year), property_scores(total_score, ai_summary)')
    .eq('id', id)
    .single()

  if (!property) return Response.json({ error: 'not found' }, { status: 404 })

  const complex = property.complexes as { name?: string; sigungu?: string; built_year?: number } | null
  const score = property.property_scores as { total_score?: number; ai_summary?: string } | null
  const sqm = property.area_sqm as number | null
  const price = property.price as number | null
  const pyeong = sqm ? Math.round(sqm / 3.3058) : null
  const builtYear = complex?.built_year
  const age = builtYear ? new Date().getFullYear() - builtYear : null
  const typeLabel = property.property_type === 'sale' ? '매매' : property.property_type === 'auction' ? '경매' : '청약'

  const systemPrompt = `당신은 한국 부동산 시장 전문가입니다. 매물 정보를 분석하여 시세 전망을 JSON으로만 응답하세요.
응답 형식 (반드시 이 JSON만 출력):
{"year1":{"change_low":-5,"change_high":8},"year2":{"change_low":-3,"change_high":15},"year3":{"change_low":2,"change_high":22},"confidence":"medium","upside":["요인1","요인2"],"risks":["위험1","위험2"],"summary":"2문장 요약"}
- change_low/high: 현재가 대비 % 변화율 (정수)
- confidence: "low" | "medium" | "high"
- upside/risks: 각 2~3개 항목
- summary: 50자 이내`

  const userContent = `매물 정보:
- 위치: ${complex?.sigungu ?? '미상'}
- 단지: ${complex?.name ?? '미상'}
- 유형: ${typeLabel}
- 현재가: ${price ? (price / 10000).toFixed(0) + '만원' : '미상'}
- 전용면적: ${sqm ? sqm + 'm² (' + pyeong + '평)' : '미상'}
- 층수: ${property.floor ? property.floor + '층' : '미상'}
- 준공연도: ${builtYear ?? '미상'}${age ? ' (약 ' + age + '년차)' : ''}
- AI 점수: ${score?.total_score ?? '미상'}/100
${score?.ai_summary ? '- AI 분석: ' + score.ai_summary.slice(0, 100) : ''}`

  try {
    const anthropic = new Anthropic()
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    })

    const text = (msg.content[0] as Anthropic.TextBlock).text
    const forecast = parseAIJson(text) as Record<string, unknown>

    // Validate and clamp
    const safeYear = (v: unknown) => {
      const obj = v as Record<string, unknown>
      return {
        change_low: Math.max(-50, Math.min(100, Number(obj?.change_low) || 0)),
        change_high: Math.max(-50, Math.min(100, Number(obj?.change_high) || 0)),
      }
    }

    return Response.json({
      forecast: {
        year1: safeYear(forecast.year1),
        year2: safeYear(forecast.year2),
        year3: safeYear(forecast.year3),
        confidence: ['low', 'medium', 'high'].includes(forecast.confidence as string)
          ? forecast.confidence
          : 'medium',
        upside: Array.isArray(forecast.upside) ? (forecast.upside as string[]).slice(0, 3) : [],
        risks: Array.isArray(forecast.risks) ? (forecast.risks as string[]).slice(0, 3) : [],
        summary: typeof forecast.summary === 'string' ? forecast.summary.slice(0, 100) : '',
      },
      price,
    })
  } catch {
    return Response.json({ error: 'forecast unavailable' }, { status: 500 })
  }
}
