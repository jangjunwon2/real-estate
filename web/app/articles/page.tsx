import { createServerClient } from '@/lib/supabase'
import ArticleList from '@/components/ArticleList'
import CategoryFilter from '@/components/articles/CategoryFilter'
import { TITLE_KEYWORD_FILTER } from '@/lib/articleFilter'
import type { Article } from '@/types'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '부동산 뉴스',
  description: '청약·경매·정책·금리 등 신혼부부 생애최초 주택 구매에 필요한 부동산 뉴스를 AI가 선별해 드립니다.',
}


async function getArticles(category?: string, date?: string) {
  const db = createServerClient()
  let query = db.from('articles')
    .select('*')
    .eq('status', 'active')
    .or(TITLE_KEYWORD_FILTER)
    .order('created_at', { ascending: false })
    .limit(50)

  if (category) query = query.eq('category', category)
  if (date) {
    query = query
      .gte('created_at', `${date}T00:00:00+09:00`)
      .lte('created_at', `${date}T23:59:59+09:00`)
  }

  const { data } = await query
  return (data ?? []) as unknown as Article[]
}

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; date?: string }>
}) {
  const { category, date } = await searchParams
  const articles = await getArticles(category, date)

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="space-y-4">
        <h1 className="text-xl font-bold">부동산 뉴스</h1>
        <CategoryFilter currentCategory={category} currentDate={date} />
      </div>
      <div className="text-sm text-gray-400">{articles.length}건</div>
      <ArticleList articles={articles} />
    </main>
  )
}
