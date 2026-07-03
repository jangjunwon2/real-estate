import { createServerClient } from '@/lib/supabase'
import { validateAdminRequest, unauthorized } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  if (!await validateAdminRequest(req)) return unauthorized()
  const db = createServerClient()
  const today = new Date().toISOString().slice(0, 10)

  const [artRes, urgentRes, hiddenRes, runRes] = await Promise.all([
    db.from('articles').select('id', { count: 'exact', head: true })
      .eq('status', 'active').gte('created_at', `${today}T00:00:00+09:00`),
    db.from('articles').select('id', { count: 'exact', head: true })
      .eq('urgent', true).gte('created_at', `${today}T00:00:00+09:00`),
    db.from('articles').select('id', { count: 'exact', head: true })
      .eq('status', 'hidden'),
    db.from('pipeline_runs').select('status,started_at,finished_at')
      .order('started_at', { ascending: false }).limit(1).single(),
  ])

  return Response.json({
    articles: {
      today: artRes.count ?? 0,
      urgent_today: urgentRes.count ?? 0,
      hidden: hiddenRes.count ?? 0,
    },
    pipeline: {
      last_run_status: runRes.data?.status ?? null,
      last_run_at: runRes.data?.started_at ?? null,
    },
  })
}
