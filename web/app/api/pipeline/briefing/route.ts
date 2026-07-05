import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { validatePipelineKey, unauthorized } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
export const dynamic = 'force-dynamic'

const VALID_SIGNALS = ['buy', 'wait', 'avoid'] as const

export async function POST(req: NextRequest) {
  if (!validatePipelineKey(req)) return unauthorized()
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 })
  }
  const { run_id, content, signal, signal_reason, articles_count, urgent_count } = body
  if (signal && !(VALID_SIGNALS as readonly string[]).includes(signal)) {
    return Response.json({ error: `signal must be one of: ${VALID_SIGNALS.join(', ')}` }, { status: 400 })
  }
  const db = createServerClient()
  const { data, error } = await db.from('briefings')
    .insert({ pipeline_run_id: run_id, content, signal, signal_reason, articles_count, urgent_count })
    .select()
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  revalidatePath('/')
  return Response.json({ briefing: data })
}
