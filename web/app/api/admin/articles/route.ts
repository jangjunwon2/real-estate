import { createServerClient } from '@/lib/supabase'
import { validateAdminRequest, unauthorized } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  if (!await validateAdminRequest(req)) return unauthorized()
  const url = new URL((req as Request).url)
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 30), 1), 100)
  const offset = Math.max(Number(url.searchParams.get('offset') ?? 0), 0)
  const ALLOWED_STATUS = ['active', 'hidden', 'deleted']
  const rawStatus = url.searchParams.get('status') ?? 'active'
  const status = ALLOWED_STATUS.includes(rawStatus) ? rawStatus : 'active'
  const date = url.searchParams.get('date')

  const db = createServerClient()
  let query = db.from('articles')
    .select('*', { count: 'exact' })
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (date) {
    query = query
      .gte('created_at', `${date}T00:00:00+09:00`)
      .lte('created_at', `${date}T23:59:59+09:00`)
  }

  const { data, count, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ articles: data, total: count, limit, offset })
}
