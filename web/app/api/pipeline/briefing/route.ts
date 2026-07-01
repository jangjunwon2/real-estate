import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { validatePipelineKey, unauthorized } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function POST(req: NextRequest) {
  if (!validatePipelineKey(req)) return unauthorized()
  const { run_id, content, signal, signal_reason, articles_count, urgent_count } = await req.json()
  const db = createServerClient()
  const { data, error } = await db.from('briefings')
    .insert({ pipeline_run_id: run_id, content, signal, signal_reason, articles_count, urgent_count })
    .select()
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  revalidatePath('/')
  return Response.json({ briefing: data })
}
