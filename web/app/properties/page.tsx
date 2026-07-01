import { createServerClient } from '@/lib/supabase'
import PropertyGrid from '@/components/PropertyGrid'
import type { Property } from '@/types'
import Link from 'next/link'

export const revalidate = 1800

const TYPE_TABS = [
  { value: '', label: '전체' },
  { value: 'sale', label: '매매' },
  { value: 'auction', label: '경매' },
  { value: 'subscription', label: '청약' },
]

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
    .limit(10)
  return data ?? []
}

async function getPreferences() {
  const db = createServerClient()
  const { data } = await db.from('user_preferences')
    .select('regions,budget_min,budget_max,property_types')
    .eq('id', '00000000-0000-0000-0000-000000000001')
    .single()
  return data
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; sort?: string }>
}) {
  const { type, sort } = await searchParams
  const [properties, subscriptionArticles, prefs] = await Promise.all([
    getProperties(type, sort),
    getSubscriptionArticles(),
    getPreferences().catch(() => null),
  ])

  const buildHref = (params: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    if (params.type) p.set('type', params.type)
    if (params.sort) p.set('sort', params.sort)
    const s = p.toString()
    return `/properties${s ? `?${s}` : ''}`
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">매물 분석</h1>
          {prefs ? (
            <p className="text-sm text-gray-500 mt-0.5">
              관심 지역: {(prefs.regions as string[]).join(', ')} · 예산: {prefs.budget_min.toLocaleString()}~{prefs.budget_max.toLocaleString()}만원
            </p>
          ) : (
            <p className="text-sm text-amber-600 mt-0.5">내 정보를 설정하면 맞춤 추천을 받을 수 있어요</p>
          )}
        </div>
        <Link href="/settings" className="text-xs text-indigo-600 hover:underline mt-1">
          {prefs ? '내 정보 수정 →' : '내 정보 설정하기 →'}
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-2">
          {TYPE_TABS.map(tab => (
            <a
              key={tab.value}
              href={buildHref({ type: tab.value || undefined, sort })}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                (type ?? '') === tab.value
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'border-gray-200 text-gray-600 hover:border-gray-400'
              }`}
            >
              {tab.label}
            </a>
          ))}
        </div>
        <div className="flex gap-2 ml-auto">
          <a href={buildHref({ type, sort: undefined })} className={`px-3 py-1 rounded text-sm ${!sort ? 'bg-gray-100 font-medium' : 'text-gray-500 hover:text-gray-800'}`}>최신순</a>
          <a href={buildHref({ type, sort: 'score' })} className={`px-3 py-1 rounded text-sm ${sort === 'score' ? 'bg-gray-100 font-medium' : 'text-gray-500 hover:text-gray-800'}`}>AI 점수순</a>
        </div>
      </div>

      {properties.length > 0 ? (
        <>
          <div className="text-sm text-gray-400">{properties.length}건</div>
          <PropertyGrid properties={properties} />
        </>
      ) : (
        <div className="space-y-6">
          <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center space-y-2">
            <p className="text-gray-500 text-sm">실시간 매물 데이터를 수집 중입니다.</p>
            <p className="text-gray-400 text-xs">경매·청약 매물은 데이터 소스 연동 후 표시됩니다.</p>
          </div>

          {subscriptionArticles.length > 0 && (
            <section>
              <h2 className="text-base font-semibold mb-3 text-gray-800">📢 최신 청약 뉴스</h2>
              <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                {subscriptionArticles.map(article => (
                  <a
                    key={article.id}
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 line-clamp-2">{article.title}</p>
                      {article.summary && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-1">{article.summary}</p>
                      )}
                      {(article.regions as string[]).length > 0 && (
                        <div className="flex gap-1 mt-1.5">
                          {(article.regions as string[]).slice(0, 3).map((r: string) => (
                            <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">{r}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 shrink-0 mt-0.5">
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
