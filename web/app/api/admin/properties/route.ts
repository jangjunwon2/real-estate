import { createServerClient } from '@/lib/supabase'
import { validateAdminKey, unauthorized } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  if (!validateAdminKey(req)) return unauthorized()
  const url = new URL((req as Request).url)
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 20), 100)
  const offset = Number(url.searchParams.get('offset') ?? 0)
  const db = createServerClient()
  const { data, count, error } = await db.from('properties')
    .select('*, property_scores(total_score)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ properties: data, total: count, limit, offset })
}

export async function PATCH(req: Request) {
  if (!validateAdminKey(req)) return unauthorized()
  const { id, status } = await req.json()
  if (!id || !status) return Response.json({ error: 'id and status required' }, { status: 400 })
  const db = createServerClient()
  const { error } = await db.from('properties').update({ status }).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
