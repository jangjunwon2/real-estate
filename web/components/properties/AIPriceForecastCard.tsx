'use client'
import { useEffect, useState } from 'react'
import { formatPrice } from '@/lib/formatPrice'

interface ForecastYear {
  change_low: number
  change_high: number
}

interface Forecast {
  year1: ForecastYear
  year2: ForecastYear
  year3: ForecastYear
  confidence: 'low' | 'medium' | 'high'
  upside: string[]
  risks: string[]
  summary: string
}

interface Props {
  propertyId: string
  currentPrice: number | null
}

const CONFIDENCE_LABEL = { low: '낮음', medium: '보통', high: '높음' }
const CONFIDENCE_COLOR = { low: 'text-orange-500', medium: 'text-yellow-600', high: 'text-green-600' }

function estimatedPrice(base: number, pct: number) {
  return Math.round(base * (1 + pct / 100))
}

function PctBadge({ low, high }: { low: number; high: number }) {
  const avg = (low + high) / 2
  const isUp = avg > 0
  const isDown = high < 0
  return (
    <span className={`text-sm font-bold tabular-nums ${isDown ? 'text-blue-600' : isUp ? 'text-red-500' : 'text-gray-600'}`}>
      {low >= 0 ? '+' : ''}{low}% ~ {high >= 0 ? '+' : ''}{high}%
    </span>
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

  const years: { label: string; data: ForecastYear }[] = forecast
    ? [
        { label: '1년 후', data: forecast.year1 },
        { label: '2년 후', data: forecast.year2 },
        { label: '3년 후', data: forecast.year3 },
      ]
    : []

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">AI 시세 전망</h2>
        <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium tracking-wide">AI 추정치</span>
      </div>

      {loading && (
        <div className="rounded-xl border border-gray-100 p-4 space-y-3 animate-pulse">
          <div className="h-3 bg-gray-100 rounded-full w-4/5" />
          <div className="h-3 bg-gray-100 rounded-full w-3/5" />
          <div className="space-y-2 pt-1">
            {[1, 2, 3].map(n => (
              <div key={n} className="h-10 bg-gray-50 rounded-lg" />
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-gray-100 p-4 text-sm text-gray-400 text-center">
          시세 전망을 불러올 수 없습니다.
        </div>
      )}

      {forecast && !loading && (
        <div className="space-y-3">
          {forecast.summary && (
            <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2.5 leading-relaxed">
              {forecast.summary}
            </p>
          )}

          {/* Year-by-year forecast */}
          <div className="space-y-2">
            {years.map(({ label, data }) => (
              <div key={label} className="rounded-lg border border-gray-100 px-3 py-2.5 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">{label}</span>
                  <PctBadge low={data.change_low} high={data.change_high} />
                </div>
                {currentPrice && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400">예상 가격 범위</span>
                    <span className="text-xs text-gray-500 tabular-nums">
                      {formatPrice(estimatedPrice(currentPrice, data.change_low))}
                      {' ~ '}
                      {formatPrice(estimatedPrice(currentPrice, data.change_high))}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Confidence */}
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span>예측 신뢰도</span>
            <span className={`font-semibold ${CONFIDENCE_COLOR[forecast.confidence]}`}>
              {CONFIDENCE_LABEL[forecast.confidence]}
            </span>
          </div>

          {/* Factors */}
          {(forecast.upside.length > 0 || forecast.risks.length > 0) && (
            <div className="grid grid-cols-2 gap-3 pt-0.5">
              {forecast.upside.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">상승 요인</p>
                  <ul className="space-y-1">
                    {forecast.upside.map((item, i) => (
                      <li key={i} className="flex items-start gap-1 text-xs text-gray-600">
                        <span className="text-red-400 shrink-0 mt-0.5 font-bold">↑</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {forecast.risks.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">위험 요인</p>
                  <ul className="space-y-1">
                    {forecast.risks.map((item, i) => (
                      <li key={i} className="flex items-start gap-1 text-xs text-gray-600">
                        <span className="text-blue-400 shrink-0 mt-0.5 font-bold">↓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <p className="text-[10px] text-gray-400 leading-relaxed pt-1 border-t border-gray-100">
            ※ AI가 현재 매물 정보 기반으로 생성한 추정치로, 실제 시장 상황·정책·금리에 따라 달라질 수 있습니다. 투자 결정의 근거로 사용하지 마세요.
          </p>
        </div>
      )}
    </section>
  )
}
