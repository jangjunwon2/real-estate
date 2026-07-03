import { createServerClient } from '@/lib/supabase'
import { validateAdminRequest, unauthorized } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  if (!await validateAdminRequest(req)) return unauthorized()
  const url = new URL((req as Request).url)
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 30), 100)
  const offset = Number(url.searchParams.get('offset') ?? 0)
  const status = url.searchParams.get('status') ?? 'active'
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
