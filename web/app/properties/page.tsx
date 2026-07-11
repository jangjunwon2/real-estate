import { createServerClient } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import PropertyGrid from '@/components/PropertyGrid'
import QuickPrefsPanel from '@/components/properties/QuickPrefsPanel'
import type { Property } from '@/types'
import Link from 'next/link'
import type { Metadata } from 'next'
import { formatPrice } from '@/lib/formatPrice'

export const metadata: Metadata = {
  title: '매물 분석',
  description: '청약·경매·매매 매물을 AI 점수로 분석. 신혼부부·생애최초 대출 적격성을 한눈에 확인하세요.',
}

export const dynamic = 'force-dynamic'

const TYPE_LABEL: Record<string, string> = {
  sale: '매매', auction: '경매', subscription: '청약',
}

const TYPE_TABS = [
  { value: '', label: '전체' },
  { value: 'sale', label: '매매' },
  { value: 'auction', label: '경매' },
  { value: 'subscription', label: '청약' },
]

const TYPE_TAB_ACTIVE: Record<string, string> = {
  '': 'bg-white text-gray-900 shadow-sm',
  sale: 'bg-indigo-600 text-white shadow-sm',
  auction: 'bg-orange-500 text-white shadow-sm',
  subscription: 'bg-emerald-600 text-white shadow-sm',
}

function scoreColor(score: number) {
  if (score >= 80) return 'text-emerald-600'
  if (score >= 65) return 'text-indigo-600'
  if (score >= 50) return 'text-amber-600'
  return 'text-red-500'
}

async function getProperties(type?: string, sort?: string) {
  const db = createServerClient()
  let query = db.from('properties')
    .select('id,title,price,property_type,source_url,created_at,complex_id,source,floor,area_sqm,auction_date,bid_count,subscription_start,subscription_end,status,complexes(name,sigungu,lat,lng),property_scores(total_score,ai_summary,pros,cons,personalized_reason)')
    .eq('status', 'active')
    .limit(30)
  if (type) query = query.eq('property_type', type)
  if (sort === 'score') {
    query = query.order('total_score', { ascending: false, foreignTable: 'property_scores' })
  } else {
    query = query.order('created_at', { ascending: false })
  }
  const { data } = await query
  return (data ?? []) as unknown as Property[]
}

async function getSubscriptionArticles() {
  const db = createServerClient()
  const { data } = await db.from('articles')
    .select('id,title,url,summary,published_at,regions,importance')
    .eq('status', 'active')
    .eq('category', '청약')
    .order('published_at', { ascending: false })
    .limit(8)
  return data ?? []
}

async function getPreferences(userId: string | null) {
  if (!userId) return null
  const db = createServerClient()
  const { data } = await db.from('user_preferences')
    .select('regions,budget_min,budget_max,property_types')
    .eq('user_id', userId)
    .maybeSingle()
  return data
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; sort?: string }>
}) {
  const { type, sort } = await searchParams
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const [properties, subscriptionArticles, prefs] = await Promise.all([
    getProperties(type, sort),
    getSubscriptionArticles(),
    getPreferences(user?.id ?? null).catch(() => null),
  ])

  const buildHref = (params: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    if (params.type) p.set('type', params.type)
    if (params.sort) p.set('sort', params.sort)
    const s = p.toString()
    return `/properties${s ? `?${s}` : ''}`
  }

  // Aggregate stats
  const scoredProps = properties.filter(p => p.property_scores)
  const avgScore = scoredProps.length > 0
    ? Math.round(scoredProps.reduce((a, p) => a + (p.property_scores?.total_score ?? 0), 0) / scoredProps.length)
    : null
  const pricedProps = properties.filter(p => p.price)
  const avgPrice = pricedProps.length > 0
    ? Math.round(pricedProps.reduce((a, p) => a + (p.price ?? 0), 0) / pricedProps.length)
    : null

  const regions = (prefs?.regions as string[] | null) ?? []
  const activeBg = TYPE_TAB_ACTIVE[type ?? ''] ?? TYPE_TAB_ACTIVE['']

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">

      {/* ── 헤더 카드 ── */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-50 via-white to-indigo-50/60 border border-gray-200 p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-gray-900 leading-tight">매물 분석</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              AI가 분석한 {type ? TYPE_LABEL[type] + ' ' : ''}매물
              {properties.length > 0 && (
                <> · <span className="font-semibold text-gray-600">{properties.length}건</span></>
              )}
            </p>
          </div>
          {prefs && (
            <Link href="/settings" className="shrink-0 text-xs text-indigo-600 hover:text-indigo-800 transition-colors mt-1">
              설정 수정 →
            </Link>
          )}
        </div>

        {/* Aggregate stats */}
        {properties.length > 0 && (
          <div className="flex gap-5 flex-wrap">
            <div>
              <p className="text-3xl font-black text-gray-900 leading-none">{properties.length}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">총 매물</p>
            </div>
            {avgScore !== null && (
              <div>
                <p className={`text-3xl font-black leading-none ${scoreColor(avgScore)}`}>{avgScore}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">평균 AI 점수</p>
              </div>
            )}
            {avgPrice !== null && (
              <div>
                <p className="text-3xl font-black text-gray-900 leading-none">{formatPrice(avgPrice)}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">평균 가격</p>
              </div>
            )}
          </div>
        )}

        {/* Prefs summary or CTA */}
        {prefs ? (
          <div className="flex flex-wrap gap-1.5">
            {regions.length > 0 ? regions.map(r => (
              <span key={r} className="text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-0.5 rounded-full font-medium">{r}</span>
            )) : (
              <span className="text-[11px] text-gray-400">관심 지역 미설정</span>
            )}
            {(prefs.budget_min || prefs.budget_max) && (
              <span className="text-[11px] bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full font-medium">
                예산 {prefs.budget_min ? formatPrice(prefs.budget_min as number) : '0'}~{prefs.budget_max ? formatPrice(prefs.budget_max as number) : '∞'}
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
            <p className="text-xs text-amber-700">내 정보를 설정하면 대출 적격성·맞춤 추천을 받을 수 있어요</p>
            <Link href="/settings" className="shrink-0 text-xs font-bold text-amber-700 underline ml-3">설정하기</Link>
          </div>
        )}
      </div>

      {/* QuickPrefsPanel (prefs 없을 때) */}
      {!prefs && <QuickPrefsPanel />}

      {/* ── 필터 + 정렬 ── */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        {/* Type pill group */}
        <div className="flex bg-gray-100 rounded-full p-1 gap-0.5">
          {TYPE_TABS.map(tab => {
            const isActive = (type ?? '') === tab.value
            return (
              <a
                key={tab.value}
                href={buildHref({ type: tab.value || undefined, sort })}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  isActive ? activeBg : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </a>
            )
          })}
        </div>

        {/* Sort pills */}
        <div className="flex gap-1.5">
          <a
            href={buildHref({ type, sort: undefined })}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${
              !sort
                ? 'bg-gray-900 text-white'
                : 'text-gray-500 border border-gray-200 hover:text-gray-800 hover:border-gray-400'
            }`}
          >
            최신순
          </a>
          <a
            href={buildHref({ type, sort: 'score' })}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${
              sort === 'score'
                ? 'bg-gray-900 text-white'
                : 'text-gray-500 border border-gray-200 hover:text-gray-800 hover:border-gray-400'
            }`}
          >
            AI 점수순
          </a>
        </div>
      </div>

      {/* ── 매물 목록 or 빈 상태 ── */}
      {properties.length > 0 ? (
        <PropertyGrid properties={properties} />
      ) : (
        <div className="space-y-6 py-4">
          <div className="rounded-2xl border border-dashed border-gray-200 py-16 text-center space-y-3">
            <p className="text-5xl">🏠</p>
            <h2 className="text-base font-semibold text-gray-700">매물을 수집 중입니다</h2>
            <p className="text-sm text-gray-400 leading-relaxed max-w-xs mx-auto">
              경매·청약·매매 데이터를 연동하고 있습니다.<br />잠시 후 다시 확인해 주세요.
            </p>
          </div>

          {/* 청약 뉴스 fallback */}
          {subscriptionArticles.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <span>📢</span> 최신 청약 뉴스
              </h2>
              <div className="space-y-2">
                {subscriptionArticles.map(article => (
                  <a
                    key={article.id}
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 rounded-2xl border border-gray-100 p-4 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-indigo-700 transition-colors">
                        {article.title}
                      </p>
                      {article.summary && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-1">{article.summary}</p>
                      )}
                      {((article.regions ?? []) as string[]).length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {((article.regions ?? []) as string[]).slice(0, 3).map((r: string) => (
                            <span key={r} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium border border-indigo-100">
                              {r}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] text-gray-400 shrink-0 mt-0.5 font-medium">
                      {new Date(article.published_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                    </span>
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  )
}
