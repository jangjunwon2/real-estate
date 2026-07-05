import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { logError } from '@/lib/logger'
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const db = createServerClient()
  const { data, error } = await db.from('user_profiles')
    .select('notify_email, notify_kakao')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    logError('notifications/settings GET', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json({
    notify_email: data?.notify_email ?? true,
    notify_kakao: data?.notify_kakao ?? false,
  })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const patch: Record<string, boolean> = {}
  if (typeof body.notify_email === 'boolean') patch.notify_email = body.notify_email
  if (typeof body.notify_kakao === 'boolean') patch.notify_kakao = body.notify_kakao
  if (Object.keys(patch).length === 0) {
    return Response.json({ error: 'notify_email 또는 notify_kakao 값을 보내주세요.' }, { status: 400 })
  }

  const db = createServerClient()
  const { error } = await db.from('user_profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) {
    logError('notifications/settings PATCH', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json({ ok: true, ...patch })
}
