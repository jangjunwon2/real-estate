import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const db = createServerClient()
  const { data, error } = await db.from('articles')
    .select('*')
    .eq('id', id)
    .eq('status', 'active')
    .single()

  if (error || !data) return Response.json({ error: 'not found' }, { status: 404 })
  return Response.json({ article: data })
}
