import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { logError } from '@/lib/logger'
export const dynamic = 'force-dynamic'

async function getAuthUser() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const db = createServerClient()
  const { data, error } = await db.from('favorites')
    .select('id, property_id, created_at, properties(*, complexes(name, sigungu), property_scores(total_score))')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    logError('favorites/GET', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json({ favorites: data })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const { property_id } = await req.json()
  if (!property_id) return Response.json({ error: 'property_id required' }, { status: 400 })

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(String(property_id))) {
    return Response.json({ error: 'invalid property_id' }, { status: 400 })
  }

  const db = createServerClient()
  const { data, error } = await db.from('favorites')
    .insert({ user_id: user.id, property_id })
    .select('id, property_id, created_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return Response.json({ error: '이미 즐겨찾기에 추가된 매물입니다.' }, { status: 409 })
    }
    logError('favorites/POST', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json({ favorite: data }, { status: 201 })
}
