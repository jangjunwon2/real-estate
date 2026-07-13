'use client'

import { useState } from 'react'
import { formatPrice } from '@/lib/formatPrice'

const SQM_PER_PYEONG = 3.3058
const MAX_ROWS = 15

interface Deal {
  aptName: string
  dealDate: string
  floor: number | null
  areaSqm: number | null
  priceManwon: number
}

interface Summary {
  count: number
  avgPriceManwon: number | null
  vsCurrentPct: number | null
}

type Status = 'idle' | 'loading' | 'loaded' | 'error'

export default function TransactionHistorySection({ propertyId }: { propertyId: string }) {
  const [status, setStatus] = useState<Status>('idle')
  const [deals, setDeals] = useState<Deal[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  async function load() {
    setStatus('loading')
    try {
      const res = await fetch(`/api/properties/${propertyId}/transactions`)
      const json = await res.json()
      if (!res.ok) {
        setErrorMsg(json.error ?? '조회에 실패했습니다')
        setStatus('error')
        return
      }
      setDeals(json.deals)
      setSummary(json.summary)
      setStatus('loaded')
    } catch {
      setErrorMsg('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.')
      setStatus('error')
    }
  }

  if (status === 'idle' || status === 'loading') {
    return (
      <button
        onClick={load}
        disabled={status === 'loading'}
        className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold px-3 py-2.5 hover:bg-indigo-700 transition-colors disabled:opacity-60"
      >
        {status === 'loading' ? '실거래가 조회 중...' : '⚡ 이 단지 실거래가 바로보기'}
      </button>
    )
  }

  if (status === 'error') {
    return (
      <div className="rounded-xl bg-red-50 border border-red-100 px-3 py-2.5 space-y-1">
        <p className="text-xs text-red-500">{errorMsg}</p>
        <button onClick={load} className="text-[10px] text-red-400 underline">다시 시도</button>
      </div>
    )
  }

  if (deals.length === 0) {
    return (
      <div className="rounded-xl bg-white border border-gray-200 px-3 py-2.5">
        <p className="text-xs text-gray-500">최근 6개월 내 이 단지의 실거래 내역이 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-white border border-gray-200 p-3 space-y-2.5">
      {summary?.avgPriceManwon != null && (
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-800">
            최근 6개월 {summary.count}건 · 평균 {formatPrice(summary.avgPriceManwon)}
          </p>
          {summary.vsCurrentPct !== null && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${summary.vsCurrentPct > 0 ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-600'}`}>
              현재가 {summary.vsCurrentPct > 0 ? '+' : ''}{summary.vsCurrentPct}%
            </span>
          )}
        </div>
      )}
      <div className="space-y-1">
        {deals.slice(0, MAX_ROWS).map((d, i) => (
          <div key={i} className="flex items-center justify-between text-xs border-b border-gray-50 last:border-0 py-1.5">
            <div className="flex gap-2 text-gray-500">
              <span>{d.dealDate.slice(0, 7).replace('-', '.')}</span>
              {d.floor !== null && <span>{d.floor}층</span>}
              {d.areaSqm !== null && <span>{Math.round(d.areaSqm / SQM_PER_PYEONG)}평</span>}
            </div>
            <span className="font-bold text-gray-900">{formatPrice(d.priceManwon)}</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-gray-400">국토교통부 실거래가 공개시스템 제공</p>
    </div>
  )
}
