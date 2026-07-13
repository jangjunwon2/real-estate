import { buildPropertyWhatIf, type WhatIfInput, type WhatIfSuggestion } from '@/lib/advisor/whatIfAdvisor'
import { formatPrice } from '@/lib/formatPrice'
import Link from 'next/link'

interface Props {
  price: number
  input: WhatIfInput
}

function StrategyRow({ s, price, unlocked }: { s: WhatIfSuggestion; price: number; unlocked: boolean }) {
  const remaining = price - s.variantMax
  return (
    <div className={`rounded-lg border p-3 ${unlocked ? 'border-emerald-200 bg-white' : 'border-gray-100 bg-white/60'}`}>
      <div className="flex items-start gap-2">
        <span className="text-base shrink-0">{s.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-800">{s.title}</p>
            {unlocked ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">구매 가능 ✓</span>
            ) : (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                그래도 {formatPrice(remaining)} 부족
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            한도 {formatPrice(s.currentMax)} → <span className={unlocked ? 'font-semibold text-emerald-700' : 'font-medium text-gray-700'}>{formatPrice(s.variantMax)}</span>
            <span className="text-emerald-600 font-medium"> (+{formatPrice(s.deltaAmount)})</span>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function PropertyStrategyPanel({ price, input }: Props) {
  const result = buildPropertyWhatIf(price, input)
  if (!result) return null

  // 이미 구매 가능하면 별도 전략 패널이 불필요 — 대출 적격성 패널이 충분히 설명한다
  if (result.affordableNow) return null

  const hasContent = result.unlocks.length > 0 || result.improvements.length > 0
  if (!hasContent) return null

  return (
    <section className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-800">💡 이 매물, 이렇게 하면 가능해요</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          현재 조건 최대 {formatPrice(result.currentMax)} — <span className="font-semibold text-red-500">{formatPrice(result.gap)} 부족</span>.
          조건을 바꾸면 아래처럼 달라집니다.
        </p>
      </div>

      <div className="space-y-2">
        {result.unlocks.map(s => <StrategyRow key={s.id} s={s} price={price} unlocked />)}
        {result.improvements.map(s => <StrategyRow key={s.id} s={s} price={price} unlocked={false} />)}
      </div>

      <p className="text-[11px] text-gray-400">
        전략별 상세 근거와 주의사항은 <Link href="/settings" className="underline text-indigo-500">분석 및 추천</Link>에서 확인하세요.
      </p>
    </section>
  )
}
