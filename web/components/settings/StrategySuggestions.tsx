'use client'
import { useMemo } from 'react'
import { buildWhatIfSuggestions, buildAdvisoryNotices, type WhatIfInput, type AdvisoryNotice } from '@/lib/advisor/whatIfAdvisor'
import { formatPrice } from '@/lib/formatPrice'

interface StrategySuggestionsProps {
  input: WhatIfInput
}

function NoticeCard({ notice }: { notice: AdvisoryNotice }) {
  const isWarn = notice.tone === 'warn'
  return (
    <div className={`rounded-xl border p-4 space-y-2 ${
      isWarn ? 'border-amber-200 bg-amber-50/50' : 'border-gray-200 bg-gray-50/50'
    }`}>
      <div className="flex items-start gap-2">
        <span className="text-lg shrink-0">{notice.icon}</span>
        <div>
          <p className="text-sm font-semibold text-gray-800 leading-snug">{notice.title}</p>
          <p className={`text-xs mt-0.5 ${isWarn ? 'text-amber-800' : 'text-gray-600'}`}>{notice.body}</p>
        </div>
      </div>
      <ul className="space-y-1">
        {notice.points.map((p, i) => (
          <li key={i} className="text-xs text-gray-600 flex gap-1.5 leading-relaxed">
            <span className={`shrink-0 ${isWarn ? 'text-amber-400' : 'text-gray-400'}`}>·</span><span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function StrategySuggestions({ input }: StrategySuggestionsProps) {
  const suggestions = useMemo(() => buildWhatIfSuggestions(input), [input])
  const notices = useMemo(() => buildAdvisoryNotices(input), [input])

  // 소득·자기자본 미입력이면 시뮬레이션 불가 — 섹션 자체를 숨김 (부모에서도 가드하지만 이중 안전)
  if (input.finance.income <= 0 || input.selfFunds <= 0) return null

  if (suggestions.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="font-semibold text-gray-800">전략 추천</h2>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 flex items-start gap-2.5">
          <span className="text-lg">✅</span>
          <div>
            <p className="text-sm font-semibold text-gray-800">현재 조건이 이미 최적에 가깝습니다</p>
            <p className="text-xs text-gray-500 mt-0.5">
              혼인신고·출산·대출 정리 등 조건을 바꿔 시뮬레이션해도 지금보다 구매력이 늘어나는 시나리오가 없습니다.
              정보가 바뀌면 다시 계산해 알려드릴게요.
            </p>
          </div>
        </div>
        {notices.map(n => <NoticeCard key={n.id} notice={n} />)}
      </section>
    )
  }

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

      {notices.length > 0 && (
        <div className="space-y-3 pt-1">
          <h3 className="text-sm font-semibold text-gray-700">체크포인트</h3>
          {notices.map(n => <NoticeCard key={n.id} notice={n} />)}
        </div>
      )}

      <p className="text-[11px] text-gray-400">
        ※ 최대 구매가는 자기자본 + 적격 대출 상품 중 가장 유리한 상품 기준. 참고용이며 실제 세무·법무 판단은 전문가 상담을 권장합니다.
      </p>
    </section>
  )
}
