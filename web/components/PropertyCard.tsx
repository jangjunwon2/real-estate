import Link from 'next/link'
import type { Property } from '@/types'
import { formatPrice } from '@/lib/formatPrice'

const SQM_PER_PYEONG = 3.3058

const TYPE_CONFIG: Record<string, { label: string; badge: string; bar: string; hover: string }> = {
  sale: {
    label: '매매',
    badge: 'bg-indigo-600 text-white',
    bar: 'bg-indigo-500',
    hover: 'hover:border-indigo-300 hover:shadow-indigo-100',
  },
  auction: {
    label: '경매',
    badge: 'bg-orange-500 text-white',
    bar: 'bg-orange-400',
    hover: 'hover:border-orange-300 hover:shadow-orange-100',
  },
  subscription: {
    label: '청약',
    badge: 'bg-emerald-600 text-white',
    bar: 'bg-emerald-500',
    hover: 'hover:border-emerald-300 hover:shadow-emerald-100',
  },
}

function scoreStyle(score: number) {
  if (score >= 80) return { text: 'text-emerald-700', bg: 'bg-emerald-50', bar: 'bg-emerald-500', label: '우수' }
  if (score >= 65) return { text: 'text-indigo-700', bg: 'bg-indigo-50', bar: 'bg-indigo-500', label: '양호' }
  if (score >= 50) return { text: 'text-amber-700', bg: 'bg-amber-50', bar: 'bg-amber-400', label: '보통' }
  return { text: 'text-red-600', bg: 'bg-red-50', bar: 'bg-red-400', label: '주의' }
}

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

export default function PropertyCard({ property }: { property: Property }) {
  const complex = property.complexes
  const score = property.property_scores
  const tc = TYPE_CONFIG[property.property_type] ?? TYPE_CONFIG.sale
  const ss = score ? scoreStyle(score.total_score) : null
  const sqm = property.area_sqm ? Number(property.area_sqm) : null
  const pyeong = sqm ? Math.round(sqm / SQM_PER_PYEONG) : null
  const ppp = property.price && sqm ? Math.round((property.price / (sqm / SQM_PER_PYEONG)) / 10000) : null

  let dateCtx: string | null = null
  if (property.property_type === 'auction' && property.auction_date) {
    dateCtx = `경매 ${new Date(property.auction_date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}`
  } else if (property.property_type === 'subscription' && property.subscription_end) {
    const days = daysUntil(property.subscription_end)
    dateCtx = days > 0 ? `청약 D-${days}` : days === 0 ? '오늘 마감' : '청약 종료'
  }

  return (
    <Link
      href={`/properties/${property.id}`}
      className={`group block rounded-2xl border border-gray-200 bg-white overflow-hidden hover:shadow-lg transition-all duration-200 ${tc.hover}`}
    >
      {/* Score progress bar — top strip */}
      <div className="h-1.5 bg-gray-100 w-full">
        {score && (
          <div className={`h-full ${ss!.bar}`} style={{ width: `${score.total_score}%` }} />
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Type badge + date context + score badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className={`shrink-0 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${tc.badge}`}>
              {tc.label}
            </span>
            {dateCtx && (
              <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                dateCtx.startsWith('오늘') ? 'bg-red-50 text-red-600' :
                dateCtx.startsWith('청약 D-') ? 'bg-emerald-50 text-emerald-700' :
                'bg-gray-100 text-gray-500'
              }`}>
                {dateCtx}
              </span>
            )}
          </div>
          {score && ss && (
            <div className={`shrink-0 rounded-xl px-2.5 py-1.5 ${ss.bg} flex flex-col items-center`}>
              <span className={`text-lg font-black leading-none ${ss.text}`}>{score.total_score}</span>
              <span className="text-[9px] text-gray-400 mt-0.5 font-medium">{ss.label}</span>
            </div>
          )}
        </div>

        {/* Name + location */}
        <div>
          <p className="font-bold text-gray-900 leading-snug group-hover:text-indigo-700 transition-colors truncate text-[15px]">
            {complex?.name ?? property.title ?? '매물'}
          </p>
          {complex?.sigungu && (
            <p className="text-xs text-gray-400 mt-0.5">{complex.sigungu}</p>
          )}
        </div>

        {/* Price */}
        {property.price && (
          <div>
            <p className="text-2xl font-black text-gray-900 tracking-tight leading-none">
              {formatPrice(property.price)}
            </p>
            {ppp && (
              <p className="text-[10px] text-gray-400 mt-0.5">평당 {ppp.toLocaleString()}만원</p>
            )}
          </div>
        )}

        {/* Info pills */}
        {(sqm || property.floor) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {sqm && (
              <span className="text-[11px] bg-gray-50 border border-gray-100 rounded-full px-2.5 py-0.5 text-gray-600 font-medium">
                {sqm.toFixed(0)}m²{pyeong ? ` · ${pyeong}평` : ''}
              </span>
            )}
            {property.floor && (
              <span className="text-[11px] bg-gray-50 border border-gray-100 rounded-full px-2.5 py-0.5 text-gray-600 font-medium">
                {property.floor}층
              </span>
            )}
          </div>
        )}

        {/* AI summary */}
        {score?.ai_summary && (
          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
            {score.ai_summary}
          </p>
        )}

        {/* Pros chips */}
        {score?.pros && score.pros.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {(score.pros as string[]).slice(0, 3).map((pro, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-100">
                +{pro}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}
