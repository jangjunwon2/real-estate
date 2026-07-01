import { createServerClient } from '@/lib/supabase'
import PropertyGrid from '@/components/PropertyGrid'
import type { Property } from '@/types'

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

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; sort?: string }>
}) {
  const { type, sort } = await searchParams
  const properties = await getProperties(type, sort)

  const buildHref = (params: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    if (params.type) p.set('type', params.type)
    if (params.sort) p.set('sort', params.sort)
    const s = p.toString()
    return `/properties${s ? `?${s}` : ''}`
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-xl font-bold">매물 분석</h1>

      <div className="flex flex-wrap items-center gap-4">
        {/* 매물 유형 탭 */}
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

        {/* 정렬 */}
        <div className="flex gap-2 ml-auto">
          <a
            href={buildHref({ type, sort: undefined })}
            className={`px-3 py-1 rounded text-sm ${!sort ? 'bg-gray-100 font-medium' : 'text-gray-500 hover:text-gray-800'}`}
          >
            최신순
          </a>
          <a
            href={buildHref({ type, sort: 'score' })}
            className={`px-3 py-1 rounded text-sm ${sort === 'score' ? 'bg-gray-100 font-medium' : 'text-gray-500 hover:text-gray-800'}`}
          >
            AI 점수순
          </a>
        </div>
      </div>

      <div className="text-sm text-gray-400">{properties.length}건</div>
      <PropertyGrid properties={properties} />
    </main>
  )
}
