import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

const PREF_ID = '00000000-0000-0000-0000-000000000001'

export const dynamic = 'force-dynamic'

export async function GET() {
  const db = createServerClient()
  const { data } = await db.from('user_preferences').select('*').eq('id', PREF_ID).single()
  return Response.json(data ?? {
    regions: ['서울'],
    budget_min: 30000,
    budget_max: 60000,
    property_types: ['sale', 'subscription'],
    monthly_income: 0,
    assets: 0,
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const db = createServerClient()
  const { error } = await db.from('user_preferences').upsert({
    id: PREF_ID,
    regions: body.regions ?? ['서울'],
    budget_min: Number(body.budget_min) || 30000,
    budget_max: Number(body.budget_max) || 60000,
    property_types: body.property_types ?? ['sale', 'subscription'],
    monthly_income: Number(body.monthly_income) || 0,
    assets: Number(body.assets) || 0,
    updated_at: new Date().toISOString(),
  })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
