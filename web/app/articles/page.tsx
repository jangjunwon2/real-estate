import { createServerClient } from '@/lib/supabase'
import ArticleList from '@/components/ArticleList'
import type { Article, Category } from '@/types'

export const revalidate = 1800

const CATEGORIES: Category[] = ['정책', '금리', '시세', '청약', '세금', '경매', '재개발', '기타']

async function getArticles(category?: string, date?: string) {
  const db = createServerClient()
  let query = db.from('articles')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(50)

  if (category) query = query.eq('category', category)
  if (date) {
    query = query
      .gte('created_at', `${date}T00:00:00+09:00`)
      .lte('created_at', `${date}T23:59:59+09:00`)
  }

  const { data } = await query
  return (data ?? []) as Article[]
}

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; date?: string }>
}) {
  const { category, date } = await searchParams
  const articles = await getArticles(category, date)
  const today = new Date().toISOString().slice(0, 10)

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="space-y-4">
        <h1 className="text-xl font-bold">부동산 뉴스</h1>

        {/* 카테고리 탭 */}
        <div className="flex flex-wrap gap-2">
          <a
            href="/articles"
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              !category ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-400'
            }`}
          >
            전체
          </a>
          {CATEGORIES.map(cat => (
            <a
              key={cat}
              href={`/articles?category=${encodeURIComponent(cat)}${date ? `&date=${date}` : ''}`}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                category === cat
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'border-gray-200 text-gray-600 hover:border-gray-400'
              }`}
            >
              {cat}
            </a>
          ))}
        </div>

        {/* 날짜 필터 */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">날짜:</span>
          <a
            href={`/articles${category ? `?category=${encodeURIComponent(category)}` : ''}`}
            className={`text-sm px-2 py-1 rounded ${!date ? 'bg-gray-100 font-medium' : 'text-gray-500 hover:text-gray-800'}`}
          >
            전체
          </a>
          <a
            href={`/articles?${category ? `category=${encodeURIComponent(category)}&` : ''}date=${today}`}
            className={`text-sm px-2 py-1 rounded ${date === today ? 'bg-gray-100 font-medium' : 'text-gray-500 hover:text-gray-800'}`}
          >
            오늘
          </a>
        </div>
      </div>

      <div className="text-sm text-gray-400">{articles.length}건</div>
      <ArticleList articles={articles} />
    </main>
  )
}
