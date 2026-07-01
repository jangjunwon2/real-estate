import { createServerClient } from '@/lib/supabase'
import BriefingCard from '@/components/BriefingCard'
import ArticleList from '@/components/ArticleList'
import PropertyGrid from '@/components/PropertyGrid'
import UrgentBanner from '@/components/articles/UrgentBanner'
import { TITLE_KEYWORD_FILTER } from '@/lib/articleFilter'
import Link from 'next/link'

export const dynamic = 'force-dynamic'


async function getData() {
  const db = createServerClient()
  const today = new Date().toISOString().slice(0, 10)

  const [briefingRes, articlesRes, propertiesRes, prefsRes] = await Promise.all([
    db.from('briefings')
      .select('id,content,signal,signal_reason,articles_count,urgent_count,generated_at')
      .gte('generated_at', `${today}T00:00:00+09:00`)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single(),
    db.from('articles')
      .select('id,title,url,source,category,importance,urgent,summary,published_at,created_at,status,regions')
      .eq('status', 'active')
      .or(TITLE_KEYWORD_FILTER)
      .order('created_at', { ascending: false })
      .limit(20),
    db.from('properties')
      .select('id,title,price,property_type,source_url,created_at,complex_id,source,floor,area_sqm,auction_date,bid_count,subscription_start,subscription_end,status,complexes(name,sigungu,lat,lng),property_scores(total_score,ai_summary)')
      .eq('status', 'active')
      .gte('created_at', `${today}T00:00:00+09:00`)
      .limit(6),
    db.from('user_preferences')
      .select('regions,budget_max,is_newlywed,is_first_buyer')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .single(),
  ])

  return {
    briefing: briefingRes.data ?? null,
    articles: articlesRes.data ?? [],
    properties: propertiesRes.data ?? [],
    prefs: prefsRes.data ?? null,
  }
}

export default async function HomePage() {
  const { briefing, articles, properties, prefs } = await getData()

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <h1 className="sr-only">부동산AI 홈</h1>

      <UrgentBanner articles={articles as any} />

      {/* 설정 배너 — 내 정보 미입력 시 */}
      {!prefs && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-indigo-900 text-sm">맞춤 매물·뉴스 추천을 받으려면 내 정보를 입력해주세요</p>
            <p className="text-xs text-indigo-600 mt-0.5">신혼부부·생애최초 여부, 관심 지역, 예산을 설정하면 딱 맞는 청약·경매를 알려드립니다</p>
          </div>
          <Link
            href="/settings"
            className="shrink-0 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            내 정보 입력 →
          </Link>
        </div>
      )}

      {/* 내 정보 요약 */}
      {prefs && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-5 py-3 flex items-center justify-between gap-4">
          <p className="text-sm text-gray-600">
            {(prefs as any).is_newlywed && <span className="mr-1">💍신혼</span>}
            {(prefs as any).is_first_buyer && <span className="mr-1">🏠생애최초</span>}
            관심 지역: {((prefs as any).regions as string[]).join(', ')} · 예산 {((prefs as any).budget_max as number).toLocaleString()}만원 이하
          </p>
          <Link href="/settings" className="text-xs text-indigo-600 hover:underline shrink-0">수정</Link>
        </div>
      )}

      {briefing
        ? <BriefingCard briefing={briefing} />
        : (
          <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-gray-400">
            오늘 브리핑이 아직 생성되지 않았습니다.
          </div>
        )}

      {properties.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4">오늘의 추천 매물</h2>
          <PropertyGrid properties={properties as any} />
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-4">최신 뉴스</h2>
        <ArticleList articles={articles as any} />
      </section>
    </main>
  )
}
