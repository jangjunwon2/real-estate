import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { validatePipelineKey, unauthorized } from '@/lib/auth'
export const dynamic = 'force-dynamic'

const VALID_STATUSES = ['success', 'failed', 'partial'] as const

export async function POST(req: NextRequest) {
  if (!validatePipelineKey(req)) return unauthorized()
  const { run_id, status, articles_fetched, articles_saved, articles_skipped, error_message } =
    await req.json()
  if (!(VALID_STATUSES as readonly string[]).includes(status)) {
    return Response.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 })
  }
  const db = createServerClient()
  const { error } = await db.from('pipeline_runs').update({
    status,
    articles_fetched,
    articles_saved,
    articles_skipped,
    error_message,
    finished_at: new Date().toISOString(),
  }).eq('id', run_id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
