import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { logError } from '@/lib/logger'
export const dynamic = 'force-dynamic'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const db = createServerClient()

  const { error } = await db.from('favorites')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    logError('favorites/DELETE', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json({ ok: true })
}
