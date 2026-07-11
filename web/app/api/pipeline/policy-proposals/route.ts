import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { validatePipelineKey, unauthorized } from '@/lib/auth'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!validatePipelineKey(req)) return unauthorized()
  const { proposals } = await req.json()
  if (!Array.isArray(proposals))
    return Response.json({ error: 'proposals must be an array' }, { status: 400 })
  if (proposals.length === 0) return Response.json({ saved: 0 })

  const db = createServerClient()
  const rows = proposals.map((p: Record<string, unknown>) => ({
    article_url: p.article_url ?? null,
    article_title: p.article_title ?? '',
    regulation_path: p.regulation_path ?? '',
    ai_summary: p.ai_summary ?? '',
    proposed_diff: p.proposed_diff ?? '',
    status: 'pending',
  }))

  const { data, error } = await db.from('policy_change_proposals').insert(rows).select('id')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ saved: data?.length ?? 0 })
}
