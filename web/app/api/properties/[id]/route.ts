import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const db = createServerClient()
  const { data, error } = await db.from('properties')
    .select('*, complexes(id,name,sigungu,road_address,lat,lng,built_year,total_units,builder,location_scores(*)), property_scores(*)')
    .eq('id', id)
    .single()

  if (error || !data) return Response.json({ error: 'not found' }, { status: 404 })
  return Response.json({ property: data })
}
