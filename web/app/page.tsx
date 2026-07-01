import { createServerClient } from '@/lib/supabase'
import BriefingCard from '@/components/BriefingCard'
import ArticleList from '@/components/ArticleList'
import PropertyGrid from '@/components/PropertyGrid'
import UrgentBanner from '@/components/articles/UrgentBanner'

export const revalidate = 3600

async function getData() {
  const db = createServerClient()
  const today = new Date().toISOString().slice(0, 10)

  const [briefingRes, articlesRes, propertiesRes] = await Promise.all([
    db.from('briefings')
      .select('id,content,signal,signal_reason,articles_count,urgent_count,generated_at')
      .gte('generated_at', `${today}T00:00:00+09:00`)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single(),
    db.from('articles')
      .select('id,title,url,source,category,importance,urgent,summary,published_at,created_at,status,regions')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(20),
    db.from('properties')
      .select('id,title,price,property_type,source_url,created_at,complex_id,source,floor,area_sqm,auction_date,bid_count,subscription_start,subscription_end,status,complexes(name,sigungu,lat,lng),property_scores(total_score,ai_summary)')
      .eq('status', 'active')
      .gte('created_at', `${today}T00:00:00+09:00`)
      .limit(6),
  ])

  return {
    briefing: briefingRes.data ?? null,
    articles: articlesRes.data ?? [],
    properties: propertiesRes.data ?? [],
  }
}

export default async function HomePage() {
  const { briefing, articles, properties } = await getData()

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">
      <h1 className="sr-only">부동산AI 홈</h1>

      <UrgentBanner articles={articles as any} />

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
