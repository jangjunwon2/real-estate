import { createServerClient } from '@/lib/supabase'
import { validateAdminRequest, unauthorized } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  if (!await validateAdminRequest(req)) return unauthorized()
  const url = new URL((req as Request).url)
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 10), 30)
  const db = createServerClient()
  const { data, error } = await db.from('briefings')
    .select('*')
    .order('generated_at', { ascending: false })
    .limit(limit)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ briefings: data })
}
