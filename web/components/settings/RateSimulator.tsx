'use client'
import { useMemo, useState } from 'react'
import { calcGeneralMortgageAtRate, type UserFinance, type ZoneType } from '@/lib/koreanRealEstate'
import { formatPrice } from '@/lib/formatPrice'

interface RateSimulatorProps {
  finance: UserFinance
  selfFunds: number
  zone: ZoneType
}

const RATE_MIN = 3.0
const RATE_MAX = 7.5
const RATE_STEP = 0.25
const RATE_DEFAULT = 5.0

export default function RateSimulator({ finance, selfFunds, zone }: RateSimulatorProps) {
  const [rate, setRate] = useState(RATE_DEFAULT)

  const scenario = useMemo(
    () => calcGeneralMortgageAtRate(selfFunds, finance, zone, rate),
    [selfFunds, finance, zone, rate],
  )
  const baseline = useMemo(
    () => calcGeneralMortgageAtRate(selfFunds, finance, zone, RATE_DEFAULT),
    [selfFunds, finance, zone],
  )

  if (scenario.blocked) return null

  const diff = scenario.maxPrice - baseline.maxPrice

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-semibold text-gray-800">금리 시뮬레이션</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          일반 주담대 금리가 바뀌면 DSR 한도와 구매 가능 금액이 어떻게 달라지는지 확인하세요.
          {zone !== 'none' && ' 스트레스DSR 가산(+3.0%p)은 자동 반영됩니다.'}
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">대출 금리</span>
          <span className="text-lg font-bold text-gray-900">연 {rate.toFixed(2)}%</span>
        </div>
        <input
          type="range"
          min={RATE_MIN}
          max={RATE_MAX}
          step={RATE_STEP}
          value={rate}
          onChange={e => setRate(Number(e.target.value))}
          className="w-full accent-indigo-600"
          aria-label="대출 금리 선택"
        />
        <div className="flex justify-between text-[10px] text-gray-400">
          <span>{RATE_MIN}%</span>
          <span>현재 대표금리 {RATE_DEFAULT}%</span>
          <span>{RATE_MAX}%</span>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="rounded-lg bg-gray-50 px-3 py-2.5">
            <p className="text-[10px] text-gray-400">최대 구매가</p>
            <p className="text-sm font-bold text-gray-900">{formatPrice(scenario.maxPrice)}</p>
            {diff !== 0 && (
              <p className={`text-[10px] font-medium ${diff > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {diff > 0 ? '+' : '-'}{formatPrice(Math.abs(diff))}
              </p>
            )}
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2.5">
            <p className="text-[10px] text-gray-400">대출액</p>
            <p className="text-sm font-bold text-gray-900">{formatPrice(scenario.loanAmount)}</p>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2.5">
            <p className="text-[10px] text-gray-400">월 상환 (30년)</p>
            <p className="text-sm font-bold text-gray-900">{scenario.monthlyPayment.toLocaleString()}만원</p>
          </div>
        </div>

        <p className="text-[11px] text-gray-400">
          ※ 일반 주담대(시중은행) 기준. 금리가 오르면 DSR로 인정되는 대출 한도가 줄어 구매력이 감소합니다.
        </p>
      </div>
    </section>
  )
}
