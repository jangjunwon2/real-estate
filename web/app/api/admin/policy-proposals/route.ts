import { createServerClient } from '@/lib/supabase'
import { validateAdminRequest, unauthorized } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const ALLOWED_STATUS = ['pending', 'approved', 'rejected']

export async function GET(req: Request) {
  if (!await validateAdminRequest(req)) return unauthorized()
  const url = new URL(req.url)
  const rawStatus = url.searchParams.get('status') ?? 'pending'
  const status = ALLOWED_STATUS.includes(rawStatus) ? rawStatus : 'pending'

  const db = createServerClient()
  const { data, error } = await db.from('policy_change_proposals')
    .select('*')
    .eq('status', status)
    .order('detected_at', { ascending: false })
    .limit(50)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ proposals: data })
}
