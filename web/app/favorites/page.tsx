import { createServerClient } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatPrice } from '@/lib/formatPrice'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '즐겨찾기',
  description: '저장한 관심 매물 목록',
}

export const dynamic = 'force-dynamic'

const TYPE_LABEL: Record<string, string> = { sale: '매매', auction: '경매', subscription: '청약' }

interface FavoriteRow {
  id: string
  property_id: string
  created_at: string
  properties: {
    id: string
    title: string | null
    price: number | null
    property_type: string
    status: string
    complexes: { name: string; sigungu: string } | null
    property_scores: { total_score: number; ai_summary: string | null } | null
  } | null
}

export default async function FavoritesPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = createServerClient()
  const { data: favorites } = await db.from('favorites')
    .select('id, property_id, created_at, properties(id, title, price, property_type, status, complexes(name, sigungu), property_scores(total_score, ai_summary))')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const items = (favorites ?? []) as unknown as FavoriteRow[]

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">즐겨찾기</h1>
          <p className="text-sm text-gray-500 mt-0.5">저장한 관심 매물 {items.length}건</p>
        </div>
        <Link href="/properties" className="text-sm text-indigo-600 hover:underline">매물 더 보기 →</Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center space-y-3">
          <p className="text-2xl">🏠</p>
          <p className="text-sm font-medium text-gray-600">저장한 매물이 없습니다</p>
          <p className="text-xs text-gray-400">매물 상세 페이지에서 즐겨찾기를 추가해보세요</p>
          <Link href="/properties" className="inline-block mt-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 transition-colors">
            매물 보러 가기
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((fav) => {
            const p = fav.properties
            if (!p) return null
            const complex = p.complexes
            const score = p.property_scores

            return (
              <Link
                key={fav.id}
                href={`/properties/${p.id}`}
                className="group block rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all overflow-hidden bg-white"
              >
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate group-hover:text-indigo-700 transition-colors">
                        {complex?.name ?? p.title ?? '매물'}
                      </p>
                      {complex?.sigungu && (
                        <p className="text-xs text-gray-400 mt-0.5">{complex.sigungu}</p>
                      )}
                    </div>
                    <span className="shrink-0 px-1.5 py-0.5 rounded bg-gray-100 text-xs text-gray-500">
                      {TYPE_LABEL[p.property_type] ?? p.property_type}
                    </span>
                  </div>

                  {p.price && (
                    <p className="text-base font-bold text-gray-900">{formatPrice(p.price)}</p>
                  )}

                  {score && (
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>AI 점수</span>
                      <span className="font-semibold text-indigo-600">{score.total_score}점</span>
                    </div>
                  )}

                  <p className="text-[11px] text-gray-300">
                    저장: {new Date(fav.created_at).toLocaleDateString('ko-KR')}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
