'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const REGIONS_PRESET = ['서울', '경기 성남', '경기 수원', '경기 용인', '경기 화성', '인천']

export default function QuickPrefsPanel() {
  const router = useRouter()
  const [regions, setRegions] = useState<string[]>(['서울'])
  const [budgetMax, setBudgetMax] = useState(60000)
  const [isNewlywed, setIsNewlywed] = useState(false)
  const [isFirstBuyer, setIsFirstBuyer] = useState(false)
  const [saving, setSaving] = useState(false)

  const toggleRegion = (r: string) =>
    setRegions(prev =>
      prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]
    )

  const save = async () => {
    setSaving(true)
    await fetch('/api/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        regions,
        budget_min: 0,
        budget_max: budgetMax,
        property_types: ['sale', 'subscription', 'auction'],
        monthly_income: 0,
        assets: 0,
        is_newlywed: isNewlywed,
        is_first_buyer: isFirstBuyer,
        no_home_years: 0,
        num_children: 0,
      }),
    })
    setSaving(false)
    router.refresh()
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-5">
      <div>
        <p className="font-semibold text-gray-800">맞춤 매물 추천을 위해 조건을 입력해주세요</p>
        <p className="text-xs text-gray-500 mt-0.5">상세 설정은 <a href="/settings" className="text-indigo-600 underline">내 정보</a>에서 변경할 수 있어요</p>
      </div>

      {/* 내 상태 */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">내 상태</p>
        <div className="flex gap-2">
          <button
            onClick={() => setIsNewlywed(v => !v)}
            className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
              isNewlywed ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 bg-white hover:border-gray-400'
            }`}
          >
            💍 신혼부부
          </button>
          <button
            onClick={() => setIsFirstBuyer(v => !v)}
            className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
              isFirstBuyer ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 bg-white hover:border-gray-400'
            }`}
          >
            🏠 생애최초
          </button>
        </div>
      </div>

      {/* 관심 지역 */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">관심 지역 (복수 선택)</p>
        <div className="flex flex-wrap gap-1.5">
          {REGIONS_PRESET.map(r => (
            <button
              key={r}
              onClick={() => toggleRegion(r)}
              className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                regions.includes(r)
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-gray-200 text-gray-600 bg-white hover:border-gray-400'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* 예산 */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
          최대 예산: <span className="text-gray-900 font-semibold">{budgetMax.toLocaleString()}만원</span>
          {budgetMax >= 10000 && <span className="text-gray-500"> ({(budgetMax / 10000).toFixed(1)}억)</span>}
        </p>
        <input
          type="range"
          min={10000}
          max={150000}
          step={5000}
          value={budgetMax}
          onChange={e => setBudgetMax(Number(e.target.value))}
          className="w-full accent-indigo-600"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>1억</span><span>5억</span><span>10억</span><span>15억</span>
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving || regions.length === 0}
        className="w-full py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
      >
        {saving ? '저장 중...' : '맞춤 추천 받기'}
      </button>
    </div>
  )
}
