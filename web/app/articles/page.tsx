import { createServerClient } from '@/lib/supabase'
import ArticleList from '@/components/ArticleList'
import CategoryFilter from '@/components/articles/CategoryFilter'
import type { Article } from '@/types'

export const dynamic = 'force-dynamic'


async function getArticles(category?: string, date?: string) {
  const db = createServerClient()
  let query = db.from('articles')
    .select('*')
    .eq('status', 'active')
    .gte('importance', 5)
    .neq('category', '기타')
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
