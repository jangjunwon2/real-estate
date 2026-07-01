import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@/lib/supabase'
import { validateAdminKey, unauthorized } from '@/lib/auth'

const anthropic = new Anthropic()

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateAdminKey(req)) return unauthorized()
  const { id } = await params
  const db = createServerClient()
  const { data: article } = await db.from('articles')
    .select('title, summary')
    .eq('id', id)
    .single()
  if (!article) return Response.json({ error: 'not found' }, { status: 404 })

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: `부동산 뉴스를 분류하고 JSON으로만 응답. 카테고리: 정책/금리/시세/청약/세금/경매/재개발/기타\n제목: ${article.title}\n내용: ${article.summary ?? ''}\n{"category":"...","importance":1-10,"urgent":true/false,"summary":"한 줄 요약","regions":["서울"]}`,
    }],
  })
  const result = JSON.parse((msg.content[0] as Anthropic.TextBlock).text)
  const { data, error } = await db.from('articles')
    .update({ ...result, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ article: data })
}
