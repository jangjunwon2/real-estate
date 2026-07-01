import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
export const dynamic = 'force-dynamic'


export async function GET(req: NextRequest) {
  const url = req.nextUrl
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 20), 100)
  const offset = Number(url.searchParams.get('offset') ?? 0)
  const type = url.searchParams.get('type')
  const sort = url.searchParams.get('sort') ?? 'created_at'

  const db = createServerClient()
  let query = db.from('properties')
    .select('*, complexes(name,sigungu,lat,lng,location_scores(*)), property_scores(*)', { count: 'exact' })
    .eq('status', 'active')
    .range(offset, offset + limit - 1)

  if (sort === 'score') {
    query = query.order('total_score', { ascending: false, foreignTable: 'property_scores' })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  if (type) query = query.eq('property_type', type)

  const { data, count, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ properties: data, total: count, limit, offset })
}
