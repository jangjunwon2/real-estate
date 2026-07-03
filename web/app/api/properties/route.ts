import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const url = req.nextUrl
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 20), 100)
  const offset = Number(url.searchParams.get('offset') ?? 0)
  const type = url.searchParams.get('type')
  const sort = url.searchParams.get('sort') ?? 'created_at'
  const sigungu = url.searchParams.get('sigungu')
  const price_min = url.searchParams.get('price_min')
  const price_max = url.searchParams.get('price_max')
  const area_min = url.searchParams.get('area_min')
  const area_max = url.searchParams.get('area_max')

  const db = createServerClient()
  let query = db.from('properties')
    .select('*, complexes(name,sigungu,lat,lng,location_scores(*)), property_scores(*)', { count: 'exact' })
    .eq('status', 'active')
    .range(offset, offset + limit - 1)

  if (sort === 'score') {
    query = query.order('total_score', { ascending: false, foreignTable: 'property_scores' })
  } else if (sort === 'price_asc') {
    query = query.order('price', { ascending: true })
  } else if (sort === 'price_desc') {
    query = query.order('price', { ascending: false })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  if (type) query = query.eq('property_type', type)
  if (sigungu) query = query.eq('complexes.sigungu', sigungu)
  if (price_min) query = query.gte('price', Number(price_min))
  if (price_max) query = query.lte('price', Number(price_max))
  if (area_min) query = query.gte('area_m2', Number(area_min))
  if (area_max) query = query.lte('area_m2', Number(area_max))

  const { data, count, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ properties: data, total: count, limit, offset })
}
