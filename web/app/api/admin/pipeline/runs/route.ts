import { createServerClient } from '@/lib/supabase'
import { validateAdminRequest, unauthorized } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  if (!await validateAdminRequest(req)) return unauthorized()
  const db = createServerClient()
  const { data, error } = await db.from('pipeline_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(20)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ runs: data })
}
