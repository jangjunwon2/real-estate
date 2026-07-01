import { createServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const db = createServerClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await db.from('briefings')
    .select('id,content,signal,signal_reason,articles_count,urgent_count,generated_at,pipeline_run_id')
    .gte('generated_at', `${today}T00:00:00+09:00`)
    .order('generated_at', { ascending: false })
    .limit(1)
    .single()
  return Response.json({ briefing: data ?? null })
}
