'use client'
import { useEffect, useState } from 'react'

const REGIONS_PRESET = [
  '서울', '경기 성남', '경기 수원', '경기 용인', '경기 화성', '경기 고양',
  '인천', '경기 부천', '경기 안양', '경기 의정부',
]

const PROPERTY_TYPE_OPTIONS = [
  { value: 'sale', label: '매매' },
  { value: 'subscription', label: '청약' },
  { value: 'auction', label: '경매' },
]

interface Prefs {
  regions: string[]
  budget_min: number
  budget_max: number
  property_types: string[]
  monthly_income: number
  assets: number
}

export default function SettingsPage() {
  const [prefs, setPrefs] = useState<Prefs>({
    regions: ['서울'],
    budget_min: 30000,
    budget_max: 60000,
    property_types: ['sale', 'subscription'],
    monthly_income: 0,
    assets: 0,
  })
  const [regionInput, setRegionInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/preferences')
      .then(r => r.json())
      .then(data => { setPrefs(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const addRegion = (region: string) => {
    const r = region.trim()
    if (!r || prefs.regions.includes(r)) return
    setPrefs(p => ({ ...p, regions: [...p.regions, r] }))
    setRegionInput('')
  }

  const removeRegion = (r: string) =>
    setPrefs(p => ({ ...p, regions: p.regions.filter(x => x !== r) }))

  const toggleType = (type: string) =>
    setPrefs(p => ({
      ...p,
      property_types: p.property_types.includes(type)
        ? p.property_types.filter(t => t !== type)
        : [...p.property_types, type],
    }))

  const save = async () => {
    setSaving(true)
    setSaved(false)
    await fetch('/api/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return <main className="max-w-xl mx-auto px-4 py-12 text-gray-400">불러오는 중...</main>

  return (
    <main className="max-w-xl mx-auto px-4 py-10 space-y-10">
      <div>
        <h1 className="text-xl font-bold text-gray-900">내 정보 설정</h1>
        <p className="text-sm text-gray-500 mt-1">설정한 정보를 바탕으로 맞춤 매물과 뉴스를 추천합니다.</p>
      </div>

      {/* 관심 지역 */}
      <section className="space-y-3">
        <h2 className="font-semibold text-gray-800">관심 지역</h2>
        <div className="flex flex-wrap gap-2">
          {prefs.regions.map(r => (
            <span key={r} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-sm">
              {r}
              <button onClick={() => removeRegion(r)} className="text-indigo-400 hover:text-indigo-700 ml-0.5">×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={regionInput}
            onChange={e => setRegionInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addRegion(regionInput)}
            placeholder="지역 입력 후 Enter (예: 경기 하남)"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
          />
          <button
            onClick={() => addRegion(regionInput)}
            className="px-3 py-2 rounded-lg bg-gray-100 text-sm text-gray-700 hover:bg-gray-200"
          >추가</button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {REGIONS_PRESET.filter(r => !prefs.regions.includes(r)).map(r => (
            <button
              key={r}
              onClick={() => addRegion(r)}
              className="px-2 py-0.5 rounded-full border border-gray-200 text-xs text-gray-500 hover:border-indigo-300 hover:text-indigo-600"
            >
              + {r}
            </button>
          ))}
        </div>
      </section>

      {/* 예산 범위 */}
      <section className="space-y-3">
        <h2 className="font-semibold text-gray-800">예산 범위</h2>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">최소 (만원)</label>
            <input
              type="number"
              value={prefs.budget_min}
              onChange={e => setPrefs(p => ({ ...p, budget_min: Number(e.target.value) }))}
              step={1000}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
            />
          </div>
          <span className="text-gray-400 mt-5">~</span>
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">최대 (만원)</label>
            <input
              type="number"
              value={prefs.budget_max}
              onChange={e => setPrefs(p => ({ ...p, budget_max: Number(e.target.value) }))}
              step={1000}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
            />
          </div>
        </div>
        <p className="text-xs text-gray-400">
          {prefs.budget_min.toLocaleString()}만원 ~ {prefs.budget_max.toLocaleString()}만원
          ({Math.round(prefs.budget_max / 10000 * 10) / 10}억 이하)
        </p>
      </section>

      {/* 매물 유형 */}
      <section className="space-y-3">
        <h2 className="font-semibold text-gray-800">관심 매물 유형</h2>
        <div className="flex gap-3">
          {PROPERTY_TYPE_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => toggleType(value)}
              className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                prefs.property_types.includes(value)
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-gray-200 text-gray-600 hover:border-gray-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* 재무 정보 */}
      <section className="space-y-3">
        <h2 className="font-semibold text-gray-800">재무 정보 <span className="text-xs text-gray-400 font-normal">(대출 한도 계산용, 선택)</span></h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">부부합산 연소득 (만원)</label>
            <input
              type="number"
              value={prefs.monthly_income || ''}
              onChange={e => setPrefs(p => ({ ...p, monthly_income: Number(e.target.value) }))}
              placeholder="예: 8000"
              step={100}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">현재 보유 자산 (만원)</label>
            <input
              type="number"
              value={prefs.assets || ''}
              onChange={e => setPrefs(p => ({ ...p, assets: Number(e.target.value) }))}
              placeholder="예: 15000"
              step={100}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
            />
          </div>
        </div>
        {prefs.monthly_income > 0 && prefs.budget_max > 0 && (
          <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800 space-y-1">
            <p className="font-medium">📊 생애최초 대출 가능 추정</p>
            <p>DSR 40% 기준 최대 대출: 약 {Math.round(prefs.monthly_income * 0.4 / 12 * 300).toLocaleString()}만원</p>
            <p>필요 자기자본: {Math.max(0, prefs.budget_max - Math.round(prefs.monthly_income * 0.4 / 12 * 300)).toLocaleString()}만원 이상</p>
          </div>
        )}
      </section>

      {/* 저장 */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {saving ? '저장 중...' : '저장'}
        </button>
        {saved && <span className="text-sm text-green-600">✓ 저장되었습니다</span>}
      </div>
    </main>
  )
}
