import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { validatePipelineKey, unauthorized } from '@/lib/auth'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!validatePipelineKey(req)) return unauthorized()
  const db = createServerClient()
  const { data, error } = await db.from('pipeline_runs').insert({}).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ run_id: data.id, started_at: data.started_at })
}
