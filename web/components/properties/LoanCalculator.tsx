'use client'
import { useState } from 'react'

interface Props {
  price: number
}

const LOAN_FACTOR = 237 // 연 3%, 30년 원리금균등 역산 계수 (월상환 × 237 ≈ 원금)
const LTV_FIRST_BUYER = 0.8
const LTV_MAX_AMOUNT = 50000 // 생애최초 LTV 5억 한도 (만원)

export default function LoanCalculator({ price }: Props) {
  const [income, setIncome] = useState('')

  const incomeNum = Number(income)
  const maxMonthlyRaw = incomeNum > 0 ? Math.floor((incomeNum * 10000 * 0.4) / 12) : 0
  const dsrMaxLoan = maxMonthlyRaw > 0 ? Math.floor((maxMonthlyRaw * LOAN_FACTOR) / 10000) : 0
  const ltvMax = Math.min(Math.floor(price * LTV_FIRST_BUYER), LTV_MAX_AMOUNT)
  const effectiveLoan = Math.min(dsrMaxLoan, ltvMax)
  const selfFund = Math.max(0, price - effectiveLoan)
  const isShortfall = selfFund > price * 0.5

  return (
    <section className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-800">대출 가능 금액 계산</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          DSR 40% · 생애최초 LTV 80% (5억 한도) · 금리 3%, 30년 기준
        </p>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600 shrink-0 w-14">연소득</label>
        <input
          type="number"
          value={income}
          onChange={e => setIncome(e.target.value)}
          placeholder="5000"
          min="0"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        <span className="text-sm text-gray-500 shrink-0">만원</span>
      </div>

      {incomeNum > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-white border p-2.5 text-center">
            <p className="text-[10px] text-gray-400">월 최대 상환</p>
            <p className="text-sm font-bold text-gray-700 mt-0.5">
              {maxMonthlyRaw.toLocaleString()}원
            </p>
          </div>
          <div className="rounded-lg bg-white border p-2.5 text-center">
            <p className="text-[10px] text-gray-400">최대 대출</p>
            <p className="text-sm font-bold text-indigo-600 mt-0.5">
              {effectiveLoan.toLocaleString()}만원
            </p>
          </div>
          <div className="rounded-lg bg-white border p-2.5 text-center">
            <p className="text-[10px] text-gray-400">필요 자기자금</p>
            <p className={`text-sm font-bold mt-0.5 ${isShortfall ? 'text-red-600' : 'text-green-600'}`}>
              {selfFund.toLocaleString()}만원
            </p>
          </div>
        </div>
      )}

      {incomeNum > 0 && dsrMaxLoan < ltvMax && (
        <p className="text-xs text-amber-600">
          ※ DSR 한도({dsrMaxLoan.toLocaleString()}만원)가 LTV 한도보다 낮아 DSR 기준이 적용됩니다.
        </p>
      )}
    </section>
  )
}
