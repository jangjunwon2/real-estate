'use client'
import { useMemo } from 'react'
import { buildWhatIfSuggestions, type WhatIfInput } from '@/lib/advisor/whatIfAdvisor'
import { formatPrice } from '@/lib/formatPrice'

interface StrategySuggestionsProps {
  input: WhatIfInput
}

export default function StrategySuggestions({ input }: StrategySuggestionsProps) {
  const suggestions = useMemo(() => buildWhatIfSuggestions(input), [input])

  if (suggestions.length === 0) return null

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-semibold text-gray-800">전략 추천</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          지금 조건에서 이렇게 바꾸면 구매력이 늘어나요 — 실제 대출 규제(DSR·LTV·스트레스DSR) 기준으로 계산한 수치입니다.
        </p>
      </div>

      <div className="space-y-3">
        {suggestions.map(s => (
          <div key={s.id} className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 min-w-0">
                <span className="text-lg shrink-0">{s.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-800 leading-snug">{s.title}</p>
                  <p className="text-xs text-emerald-800 mt-0.5">{s.conclusion}</p>
                </div>
              </div>
              <div className="shrink-0 text-right rounded-lg bg-emerald-600 text-white px-2.5 py-1.5">
                <p className="text-[10px] text-emerald-100 leading-none">구매력</p>
                <p className="text-sm font-black leading-tight">+{formatPrice(s.deltaAmount)}</p>
              </div>
            </div>

            {/* 전/후 비교 */}
            <div className="flex items-center gap-2 text-xs bg-white/70 border border-emerald-100 rounded-lg px-3 py-2">
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400">{s.currentLabel}</p>
                <p className="font-semibold text-gray-600">{formatPrice(s.currentMax)}</p>
              </div>
              <span className="text-emerald-500 font-bold shrink-0">→</span>
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400">{s.variantLabel}</p>
                <p className="font-bold text-emerald-700">{formatPrice(s.variantMax)}</p>
              </div>
            </div>

            <ul className="space-y-1">
              {s.reasons.map((r, i) => (
                <li key={i} className="text-xs text-gray-600 flex gap-1.5 leading-relaxed">
                  <span className="text-emerald-400 shrink-0">·</span><span>{r}</span>
                </li>
              ))}
            </ul>

            {s.caution && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                ⚠ {s.caution}
              </p>
            )}
          </div>
        ))}
      </div>

      <p className="text-[11px] text-gray-400">
        ※ 최대 구매가는 자기자본 + 적격 대출 상품 중 가장 유리한 상품 기준. 참고용이며 실제 세무·법무 판단은 전문가 상담을 권장합니다.
      </p>
    </section>
  )
}
