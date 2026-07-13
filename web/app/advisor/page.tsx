import { createServerClient } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { recommendPurchaseStrategy } from '@/lib/advisor'
import type { AdvisorProfile } from '@/lib/advisor/types'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '구매 전략 추천',
  description: '혼인신고 시점·명의 구성·매수 방식을 내 조건에 맞춰 추천합니다.',
}
export const dynamic = 'force-dynamic'

export default async function AdvisorPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/advisor')

  const db = createServerClient()
  const { data: prefs } = await db.from('user_preferences').select('*').eq('user_id', user.id).maybeSingle()

  if (!prefs || !prefs.budget_max) {
    return (
      <main className="max-w-xl mx-auto px-4 py-12 text-center space-y-3">
        <p className="text-gray-600 font-medium">추천을 받으려면 먼저 정보를 입력해주세요</p>
        <a href="/settings" className="inline-block px-4 py-2 rounded-lg bg-gray-900 text-white text-sm">분석 및 추천에서 정보 입력하기 →</a>
      </main>
    )
  }

  const profile: AdvisorProfile = {
    buyerType: prefs.buyer_type ?? 'solo',
    marriageStatus: prefs.marriage_status ?? null,
    selfHomeStatus: prefs.self_home_status ?? 'none',
    spouseHomeStatus: prefs.spouse_home_status ?? null,
    householdHead: prefs.household_head ?? true,
    subscriptionAccountYears: prefs.subscription_account_years ?? 0,
    noHomeYears: prefs.no_home_years ?? 0,
    numChildren: prefs.num_children ?? 0,
    income: prefs.monthly_income ?? 0,
    assets: prefs.assets ?? 0,
    budgetMax: prefs.budget_max ?? 0,
    sigungu: null,
  }

  const report = recommendPurchaseStrategy(profile)

  return (
    <main className="max-w-2xl mx-auto px-4 py-10 space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">구매 전략 추천</h1>
        <p className="text-sm text-gray-500 mt-1">입력하신 정보를 기반으로 한 참고용 추천입니다. 실제 세무·법무 판단은 전문가 상담을 권장합니다.</p>
      </div>

      <div className="space-y-4">
        {report.cards.map(card => (
          <div key={card.id} className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-5 space-y-2">
            <h2 className="font-semibold text-gray-800">{card.title}</h2>
            <p className="text-sm font-medium text-indigo-900">{card.conclusion}</p>
            <ul className="space-y-1">
              {card.reasons.map((r, i) => (
                <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                  <span className="text-indigo-400">·</span><span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {report.tables.length > 0 && (
        <details className="rounded-xl border border-gray-200 p-4">
          <summary className="text-sm font-medium text-gray-700 cursor-pointer">상세 비교표 보기</summary>
          <div className="mt-4 space-y-6">
            {report.tables.map(table => (
              <div key={table.id} className="space-y-2">
                <p className="text-sm font-medium text-gray-700">{table.title}</p>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-3 py-2 text-left font-medium text-gray-500"> </th>
                        {Object.entries(table.scenarioLabels).map(([key, label]) => (
                          <th key={key} className="px-3 py-2 text-left font-medium text-gray-500">{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {table.rows.map(row => (
                        <tr key={row.label}>
                          <td className="px-3 py-2 text-gray-600">{row.label}</td>
                          {Object.keys(table.scenarioLabels).map(key => (
                            <td key={key} className="px-3 py-2 text-gray-800">{row.values[key] ?? '—'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      <p className="text-[11px] text-gray-400 text-center">
        ※ 참고용 정보이며 실제 세무·법무 상담이 필요합니다. 종합부동산세는 매매가 기준 공시가격 추정치로 계산된 근사값입니다.
      </p>
    </main>
  )
}
