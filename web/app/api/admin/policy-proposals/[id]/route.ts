import { createServerClient } from '@/lib/supabase'
import { validateAdminRequest, unauthorized } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const ALLOWED_STATUS = ['approved', 'rejected'] as const

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await validateAdminRequest(req)) return unauthorized()
  const { id } = await params
  const { status } = await req.json()
  if (!(ALLOWED_STATUS as readonly string[]).includes(status)) {
    return Response.json({ error: `status must be one of: ${ALLOWED_STATUS.join(', ')}` }, { status: 400 })
  }
  const db = createServerClient()
  const { error } = await db.from('policy_change_proposals')
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
