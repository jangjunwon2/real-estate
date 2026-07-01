import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { ArticleQuerySchema } from '@/lib/validators'

export const revalidate = 1800

export async function GET(req: NextRequest) {
  const url = req.nextUrl
  const parsed = ArticleQuerySchema.safeParse({
    limit: url.searchParams.get('limit'),
    offset: url.searchParams.get('offset'),
    category: url.searchParams.get('category'),
    date: url.searchParams.get('date'),
    urgent: url.searchParams.get('urgent'),
  })
  if (!parsed.success) return Response.json({ error: 'invalid params' }, { status: 400 })

  const { limit, offset, category, date, urgent } = parsed.data
  const db = createServerClient()
  let query = db.from('articles')
    .select('*', { count: 'exact' })
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (category) query = query.eq('category', category)
  if (date) {
    query = query
      .gte('created_at', `${date}T00:00:00+09:00`)
      .lte('created_at', `${date}T23:59:59+09:00`)
  }
  if (urgent !== undefined) query = query.eq('urgent', urgent)

  const { data, count, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ articles: data, total: count, limit, offset })
}
