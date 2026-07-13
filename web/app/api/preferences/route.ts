import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { logError } from '@/lib/logger'

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
  income_mode: 'combined' as 'combined' | 'individual',
  income_self: 0,
  income_spouse: 0,
  buyer_type: 'solo' as 'solo' | 'couple',
  marriage_status: null as 'registered' | 'planned' | 'undetermined' | null,
  self_home_status: 'none' as 'none' | 'one' | 'multiple',
  spouse_home_status: null as 'none' | 'one' | 'multiple' | null,
  household_head: true,
  subscription_account_years: 0,
  disposal_planned: false,
}

async function getUser() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await getUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const db = createServerClient()
  const { data, error } = await db.from('user_preferences')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    logError('preferences/GET', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json(data ?? DEFAULT_PREFS)
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const db = createServerClient()

  // 부분 저장(예: 매물 목록의 간편 설정 위젯)이 나머지 필드를 0으로 덮어쓰지 않도록
  // 기존 값을 먼저 읽어와 body에 명시적으로 들어온 키만 갱신합니다.
  const { data: existing } = await db.from('user_preferences')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  const base = { ...DEFAULT_PREFS, ...(existing ?? {}) }
  const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key)

  const payload: Record<string, unknown> = {
    user_id: user.id,
    regions: has('regions') ? body.regions : base.regions,
    budget_min: has('budget_min') ? Number(body.budget_min) || 0 : base.budget_min,
    budget_max: has('budget_max') ? Number(body.budget_max) || 0 : base.budget_max,
    property_types: has('property_types') ? body.property_types : base.property_types,
    monthly_income: has('monthly_income') ? Number(body.monthly_income) || 0 : base.monthly_income,
    assets: has('assets') ? Number(body.assets) || 0 : base.assets,
    is_newlywed: has('is_newlywed') ? Boolean(body.is_newlywed) : base.is_newlywed,
    is_first_buyer: has('is_first_buyer') ? Boolean(body.is_first_buyer) : base.is_first_buyer,
    no_home_years: has('no_home_years') ? Number(body.no_home_years) || 0 : base.no_home_years,
    num_children: has('num_children') ? Number(body.num_children) || 0 : base.num_children,
    deposit_to_recover: has('deposit_to_recover') ? Number(body.deposit_to_recover) || 0 : base.deposit_to_recover,
    gift_amount: has('gift_amount') ? Number(body.gift_amount) || 0 : base.gift_amount,
    existing_loan_payment: has('existing_loan_payment') ? Number(body.existing_loan_payment) || 0 : base.existing_loan_payment,
    renovation_budget: has('renovation_budget') ? Number(body.renovation_budget) || 0 : base.renovation_budget,
    credit_score_range: has('credit_score_range') ? body.credit_score_range : base.credit_score_range,
    birth_year: has('birth_year') ? (body.birth_year ? Number(body.birth_year) : null) : base.birth_year,
    income_mode: has('income_mode') ? body.income_mode : base.income_mode,
    income_self: has('income_self') ? Number(body.income_self) || 0 : base.income_self,
    income_spouse: has('income_spouse') ? Number(body.income_spouse) || 0 : base.income_spouse,
    buyer_type: has('buyer_type') ? body.buyer_type : base.buyer_type,
    marriage_status: has('marriage_status') ? body.marriage_status : base.marriage_status,
    self_home_status: has('self_home_status') ? body.self_home_status : base.self_home_status,
    spouse_home_status: has('spouse_home_status') ? body.spouse_home_status : base.spouse_home_status,
    household_head: has('household_head') ? Boolean(body.household_head) : base.household_head,
    subscription_account_years: has('subscription_account_years') ? Number(body.subscription_account_years) || 0 : base.subscription_account_years,
    disposal_planned: has('disposal_planned') ? Boolean(body.disposal_planned) : base.disposal_planned,
    updated_at: new Date().toISOString(),
  }

  let { error } = await db.from('user_preferences').upsert(payload, { onConflict: 'user_id' })

  // 마이그레이션(014_disposal_planned)이 아직 적용되지 않은 DB 보호:
  // 신규 컬럼 미존재 오류면 해당 필드를 제외하고 재시도해 저장 자체는 성공시킨다
  if (error && error.message.includes('disposal_planned')) {
    logError('preferences/POST', new Error('disposal_planned 컬럼 없음 — 014 마이그레이션 적용 필요. 필드 제외 후 재시도'))
    delete payload.disposal_planned
    ;({ error } = await db.from('user_preferences').upsert(payload, { onConflict: 'user_id' }))
  }

  if (error) {
    logError('preferences/POST', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json({ ok: true })
}
