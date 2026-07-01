import type { Briefing, BuyingSignal } from '@/types'

const SIGNAL_CONFIG: Record<BuyingSignal, { emoji: string; label: string; color: string }> = {
  buy:   { emoji: '🔴', label: '매수 적기', color: 'bg-red-50 border-red-200 text-red-700' },
  wait:  { emoji: '🟡', label: '관망',      color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
  avoid: { emoji: '🔵', label: '매수 자제', color: 'bg-blue-50 border-blue-200 text-blue-700' },
}

export default function BriefingCard({ briefing }: { briefing: Briefing }) {
  const signal = briefing.signal ? SIGNAL_CONFIG[briefing.signal] : null
  const date = new Date(briefing.generated_at).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <article className="rounded-xl border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">{date} 브리핑</h2>
        <span className="text-xs text-gray-400">
          {briefing.articles_count}건 분석 · 긴급 {briefing.urgent_count}건
        </span>
      </div>

      {signal && (
        <div className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium ${signal.color}`}>
          {signal.emoji} {signal.label}
          {briefing.signal_reason && (
            <span className="font-normal opacity-80">— {briefing.signal_reason}</span>
          )}
        </div>
      )}

      <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{briefing.content}</p>
    </article>
  )
}
