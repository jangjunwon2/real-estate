import { createServerClient } from '@/lib/supabase'
export const dynamic = 'force-dynamic'


export async function GET() {
  const db = createServerClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await db.from('properties')
    .select('*, complexes(name,sigungu,lat,lng), property_scores(*)')
    .eq('status', 'active')
    .gte('created_at', `${today}T00:00:00+09:00`)
    .order('total_score', { ascending: false, foreignTable: 'property_scores' })
    .limit(3)
  return Response.json({ properties: data ?? [] })
}
