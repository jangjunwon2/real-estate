import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { validatePipelineKey, unauthorized } from '@/lib/auth'

export async function POST(req: NextRequest) {
  if (!validatePipelineKey(req)) return unauthorized()
  const { run_id, articles } = await req.json()
  if (!Array.isArray(articles) || articles.length === 0)
    return Response.json({ error: 'articles array required' }, { status: 400 })

  const db = createServerClient()
  const rows = articles.map((a: Record<string, unknown>) => ({
    source: a.source,
    title: a.title,
    url: a.url,
    published_at: a.published_at ?? null,
    category: a.category ?? null,
    regions: a.regions ?? [],
    importance: a.importance ?? 5,
    urgent: a.urgent ?? false,
    summary: a.summary ?? null,
    status: 'active',
    pipeline_run_id: run_id,
  }))

  const { data, error } = await db.from('articles')
    .upsert(rows, { onConflict: 'url', ignoreDuplicates: true })
    .select('id')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  const saved = data?.length ?? 0
  return Response.json({ saved, skipped: articles.length - saved, run_id })
}
