'use client'
import { useEffect, useState } from 'react'
import { formatPrice } from '@/lib/formatPrice'

interface ForecastYear { change_low: number; change_high: number }
interface Forecast {
  year1: ForecastYear; year2: ForecastYear; year3: ForecastYear
  confidence: 'low' | 'medium' | 'high'
  upside: string[]; risks: string[]; summary: string
}
interface Props { propertyId: string; currentPrice: number | null }

const CONFIDENCE = {
  low: { label: '낮음', color: 'text-orange-500', bg: 'bg-orange-50' },
  medium: { label: '보통', color: 'text-amber-600', bg: 'bg-amber-50' },
  high: { label: '높음', color: 'text-emerald-600', bg: 'bg-emerald-50' },
}

function profit(base: number, pct: number) {
  return Math.round(base * (pct / 100))
}

function formatProfit(amount: number) {
  const abs = Math.abs(amount)
  const sign = amount >= 0 ? '+' : '-'
  if (abs >= 10000) return `${sign}${(abs / 10000).toFixed(1)}억`
  if (abs >= 1) return `${sign}${Math.round(abs).toLocaleString()}만원`
  return `${sign}0만원`
}

// Map pct in [-30, +50] range to 0-100 bar position
const SCALE_MIN = -30
const SCALE_MAX = 50
function toBarPct(pct: number) {
  return Math.max(0, Math.min(100, ((pct - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100))
}
const ZERO_POS = toBarPct(0) // where 0% sits on the bar

interface RangeBarProps { low: number; high: number }
function RangeBar({ low, high }: RangeBarProps) {
  const leftPct = toBarPct(low)
  const rightPct = toBarPct(high)
  const avg = (low + high) / 2
  const isPositive = avg > 0
  const barColor = isPositive ? 'bg-emerald-400' : 'bg-blue-400'

  return (
    <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
      {/* Zero line */}
      <div className="absolute top-0 bottom-0 w-0.5 bg-gray-300 z-10" style={{ left: `${ZERO_POS}%` }} />
      {/* Range fill */}
      <div
        className={`absolute top-0 bottom-0 ${barColor} opacity-60`}
        style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
      />
      {/* Low marker */}
      <div className="absolute top-0 bottom-0 w-1 bg-current rounded-full" style={{ left: `${leftPct}%`, color: isPositive ? '#10b981' : '#3b82f6' }} />
      {/* High marker */}
      <div className="absolute top-0 bottom-0 w-1 bg-current rounded-full" style={{ left: `${rightPct}%`, color: isPositive ? '#10b981' : '#3b82f6' }} />
    </div>
  )
}

export default function AIPriceForecastCard({ propertyId, currentPrice }: Props) {
  const [forecast, setForecast] = useState<Forecast | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch(`/api/properties/${propertyId}/forecast`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setForecast(d.forecast as Forecast); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [propertyId])

  const years = forecast ? [
    { label: '1년 후', data: forecast.year1 },
    { label: '2년 후', data: forecast.year2 },
    { label: '3년 후', data: forecast.year3 },
  ] : []

  // Best case gain at 3 years
  const maxGain = forecast && currentPrice
    ? profit(currentPrice, forecast.year3.change_high)
    : null

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">📈</span>
        <h2 className="font-bold text-gray-800">AI 시세 전망</h2>
        <span className="ml-auto text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-semibold">AI 추정</span>
      </div>

      {loading && (
        <div className="rounded-2xl border border-gray-100 p-5 space-y-4 animate-pulse">
          <div className="h-4 bg-gray-100 rounded-full w-4/5" />
          <div className="h-4 bg-gray-100 rounded-full w-3/5" />
          {[1, 2, 3].map(n => <div key={n} className="h-16 bg-gray-50 rounded-xl" />)}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-gray-100 p-5 text-center text-sm text-gray-400">
          시세 전망을 불러올 수 없습니다.
        </div>
      )}

      {forecast && !loading && (
        <div className="space-y-4">
          {/* Summary + max gain callout */}
          <div className="rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-100 p-4 space-y-2">
            {forecast.summary && (
              <p className="text-sm text-gray-700 leading-relaxed">{forecast.summary}</p>
            )}
            {maxGain !== null && maxGain > 0 && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-gray-500">3년 후 최대 예상 시세차익</span>
                <span className="text-base font-black text-emerald-600">{formatProfit(maxGain)}</span>
              </div>
            )}
          </div>

          {/* Year forecasts */}
          <div className="space-y-3">
            {years.map(({ label, data }) => {
              const avgPct = (data.change_low + data.change_high) / 2
              const isUp = avgPct > 0
              const lowProfit = currentPrice ? profit(currentPrice, data.change_low) : null
              const highProfit = currentPrice ? profit(currentPrice, data.change_high) : null
              return (
                <div key={label} className="rounded-2xl border border-gray-100 p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">{label}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-black tabular-nums ${isUp ? 'text-emerald-600' : 'text-blue-600'}`}>
                        {data.change_low >= 0 ? '+' : ''}{data.change_low}%
                        {' ~ '}
                        {data.change_high >= 0 ? '+' : ''}{data.change_high}%
                      </span>
                    </div>
                  </div>

                  <RangeBar low={data.change_low} high={data.change_high} />

                  {currentPrice && lowProfit !== null && highProfit !== null && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">예상 시세차익</span>
                      <span className={`font-bold tabular-nums ${isUp ? 'text-emerald-600' : 'text-blue-600'}`}>
                        {formatProfit(lowProfit)} ~ {formatProfit(highProfit)}
                      </span>
                    </div>
                  )}

                  {currentPrice && (
                    <div className="flex items-center justify-between text-[10px] text-gray-400">
                      <span>예상 가격 범위</span>
                      <span>
                        {formatPrice(Math.round(currentPrice * (1 + data.change_low / 100)))}
                        {' ~ '}
                        {formatPrice(Math.round(currentPrice * (1 + data.change_high / 100)))}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Confidence + factors */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-gray-100 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">↑</span>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">상승 요인</p>
              </div>
              <ul className="space-y-1">
                {forecast.upside.map((item, i) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                    <span className="text-emerald-400 shrink-0 mt-0.5 font-bold">·</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-gray-100 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">↓</span>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">위험 요인</p>
              </div>
              <ul className="space-y-1">
                {forecast.risks.map((item, i) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                    <span className="text-blue-400 shrink-0 mt-0.5 font-bold">·</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${CONFIDENCE[forecast.confidence].bg}`}>
            <span className="text-xs text-gray-500">예측 신뢰도</span>
            <span className={`text-xs font-bold ${CONFIDENCE[forecast.confidence].color}`}>
              {CONFIDENCE[forecast.confidence].label}
            </span>
          </div>

          <p className="text-[10px] text-gray-400 leading-relaxed">
            ※ AI가 현재 매물 정보 기반으로 생성한 추정치입니다. 실제 시장·정책·금리에 따라 달라질 수 있으며 투자 결정의 근거로 사용하지 마세요.
          </p>
        </div>
      )}
    </section>
  )
}
