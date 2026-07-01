import type { Property } from '@/types'

const TYPE_LABEL: Record<string, string> = {
  sale: '매매',
  auction: '경매',
  subscription: '청약',
}

const SCORE_COLOR = (score: number) => {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-indigo-600'
  if (score >= 40) return 'text-yellow-600'
  return 'text-gray-500'
}

export default function PropertyCard({ property }: { property: Property }) {
  const complex = property.complexes
  const score = property.property_scores
  const typeLabel = TYPE_LABEL[property.property_type] ?? property.property_type

  return (
    <a
      href={property.source_url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-gray-300 transition-all"
    >
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate">
            {complex?.name ?? property.title ?? '매물'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{complex?.sigungu}</p>
        </div>
        {score && (
          <div className="shrink-0 text-right">
            <p className={`text-xl font-bold ${SCORE_COLOR(score.total_score)}`}>
              {score.total_score}
            </p>
            <p className="text-[10px] text-gray-400">AI 점수</p>
          </div>
        )}
      </div>

      {/* 메타 */}
      <div className="flex items-center gap-2 text-xs text-gray-600 mb-3">
        <span className="px-1.5 py-0.5 rounded bg-gray-100 font-medium">{typeLabel}</span>
        {property.price && <span className="font-medium">{property.price.toLocaleString()}만원</span>}
        {property.area_sqm && <span>{property.area_sqm}m²</span>}
        {property.floor && <span>{property.floor}층</span>}
      </div>

      {/* AI 요약 */}
      {score?.ai_summary && (
        <p className="text-xs text-gray-500 line-clamp-2 mb-3">{score.ai_summary}</p>
      )}

      {/* 장점 */}
      {score?.pros && score.pros.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {score.pros.slice(0, 3).map((pro, i) => (
            <span key={i} className="text-[11px] px-1.5 py-0.5 rounded bg-green-50 text-green-700">
              + {pro}
            </span>
          ))}
        </div>
      )}
    </a>
  )
}
