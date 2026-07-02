import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

const PREF_ID = '00000000-0000-0000-0000-000000000001'

export const dynamic = 'force-dynamic'

const DEFAULT_PREFS = {
  regions: ['서울'],
  budget_min: 30000,
  budget_max: 60000,
  property_types: ['sale', 'subscription'],
  monthly_income: 0,
  assets: 0,
  is_newlywed: false,
  is_first_buyer: false,
  no_home_years: 0,
  num_children: 0,
  deposit_to_recover: 0,
  gift_amount: 0,
  existing_loan_payment: 0,
  renovation_budget: 0,
  credit_score_range: '800-900',
  birth_year: null as number | null,
}

export async function GET() {
  const db = createServerClient()
  const { data } = await db.from('user_preferences').select('*').eq('id', PREF_ID).single()
  return Response.json(data ?? DEFAULT_PREFS)
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
    is_newlywed: Boolean(body.is_newlywed),
    is_first_buyer: Boolean(body.is_first_buyer),
    no_home_years: Number(body.no_home_years) || 0,
    num_children: Number(body.num_children) || 0,
    deposit_to_recover: Number(body.deposit_to_recover) || 0,
    gift_amount: Number(body.gift_amount) || 0,
    existing_loan_payment: Number(body.existing_loan_payment) || 0,
    renovation_budget: Number(body.renovation_budget) || 0,
    credit_score_range: body.credit_score_range ?? '800-900',
    birth_year: body.birth_year ? Number(body.birth_year) : null,
    updated_at: new Date().toISOString(),
  })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
