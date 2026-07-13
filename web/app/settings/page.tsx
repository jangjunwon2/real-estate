'use client'
import { useEffect, useState, useMemo } from 'react'
import {
  calcAffordableScenarios,
  calcNoHomeYears,
  detectStrictestZone,
  type UserFinance,
  type AffordableScenario,
} from '@/lib/koreanRealEstate'
import NumInput from '@/components/settings/NumInput'
import EokManInput from '@/components/settings/EokManInput'
import AdvisorProfileSection, { type AdvisorProfileFields } from '@/components/settings/AdvisorProfileSection'
import StrategySuggestions from '@/components/settings/StrategySuggestions'
import type { WhatIfInput } from '@/lib/advisor/whatIfAdvisor'

const CURRENT_YEAR = new Date().getFullYear()

const REGIONS_PRESET = [
  '서울', '경기 성남', '경기 수원', '경기 용인', '경기 화성', '경기 고양',
  '인천', '경기 부천', '경기 안양', '경기 의정부',
]

const PROPERTY_TYPE_OPTIONS = [
  { value: 'sale', label: '매매' },
  { value: 'subscription', label: '청약' },
  { value: 'auction', label: '경매' },
]

const CREDIT_SCORE_OPTIONS = [
  { value: '900+', label: '900점 이상', desc: '최우량' },
  { value: '800-900', label: '800~900점', desc: '우량' },
  { value: '700-800', label: '700~800점', desc: '일반' },
  { value: '700-', label: '700점 미만', desc: '관리 필요' },
]

type IncomeMode = 'combined' | 'individual'

interface Prefs {
  regions: string[]
  budget_min: number
  budget_max: number
  property_types: string[]
  monthly_income: number
  assets: number
  is_newlywed: boolean
  is_first_buyer: boolean
  no_home_years: number
  num_children: number
  deposit_to_recover: number
  gift_amount: number
  existing_loan_payment: number
  renovation_budget: number
  credit_score_range: string
  birth_year: number | null
  income_mode: IncomeMode
  income_self: number
  income_spouse: number
  buyer_type: 'solo' | 'couple'
  marriage_status: 'registered' | 'planned' | 'undetermined' | null
  self_home_status: 'none' | 'one' | 'multiple'
  spouse_home_status: 'none' | 'one' | 'multiple' | null
  household_head: boolean
  subscription_account_years: number
}

const DEFAULT_PREFS: Prefs = {
  regions: ['서울'],
  budget_min: 30000,
  budget_max: 60000,
  property_types: ['sale', 'subscription'],
  monthly_income: 0,
  assets: 0,
  is_newlywed: false,
  is_first_buyer: false,
  no_home_years: 0,
  num_children: 0,
  deposit_to_recover: 0,
  gift_amount: 0,
  existing_loan_payment: 0,
  renovation_budget: 0,
  credit_score_range: '800-900',
  birth_year: null,
  income_mode: 'combined',
  income_self: 0,
  income_spouse: 0,
  buyer_type: 'solo',
  marriage_status: null,
  self_home_status: 'none',
  spouse_home_status: null,
  household_head: true,
  subscription_account_years: 0,
}

function priceLabel(p: number): string {
  if (p <= 0) return '—'
  const eok = Math.floor(p / 10000)
  const man = p % 10000
  return eok > 0
    ? `${eok}억${man > 0 ? ` ${man.toLocaleString()}만` : ''}`
    : `${p.toLocaleString()}만`
}

interface NotifSettings { notify_email: boolean; notify_kakao: boolean }

export default function SettingsPage() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)
  const [regionInput, setRegionInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [notif, setNotif] = useState<NotifSettings>({ notify_email: true, notify_kakao: false })
  const [savingNotif, setSavingNotif] = useState(false)
  const [savedNotif, setSavedNotif] = useState(false)
  const [notifError, setNotifError] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/preferences').then(r => r.ok ? r.json() : Promise.reject()),
      fetch('/api/notifications/settings').then(r => r.ok ? r.json() : Promise.reject()),
    ])
      .then(([data, notifData]) => {
        const merged = { ...DEFAULT_PREFS, ...data }
        // 신혼부부 여부와 매수 형태가 어긋난 기존 데이터 보정 (예: buyer_type 필드 도입 이전에 저장된 값)
        if (merged.is_newlywed && merged.buyer_type !== 'couple') merged.buyer_type = 'couple'
        if (!merged.is_newlywed && merged.buyer_type === 'couple') merged.buyer_type = 'solo'
        setPrefs(merged)
        setNotif({ notify_email: notifData.notify_email ?? true, notify_kakao: notifData.notify_kakao ?? false })
        setLoading(false)
      })
      .catch(() => { setLoadError(true); setLoading(false) })
  }, [])

  const saveNotif = async () => {
    setSavingNotif(true); setNotifError(false)
    try {
      const r = await fetch('/api/notifications/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notif),
      })
      if (!r.ok) throw new Error()
      setSavedNotif(true)
      setTimeout(() => setSavedNotif(false), 3000)
    } catch {
      setNotifError(true)
    } finally {
      setSavingNotif(false)
    }
  }

  const set = <K extends keyof Prefs>(k: K) => (v: Prefs[K]) =>
    setPrefs(p => ({ ...p, [k]: v }))

  // AdvisorProfileSection's onChange is generic over AdvisorProfileFields (a subset of Prefs
  // with identical field names/types). It isn't structurally assignable from `set` above because
  // TS can't prove indexed-access equality across two independently-generic function signatures,
  // so this dedicated adapter implements the same update directly against setPrefs.
  const setAdvisorField = <K extends keyof AdvisorProfileFields>(k: K) => (v: AdvisorProfileFields[K]) =>
    setPrefs(p => ({ ...p, [k]: v }))

  const setIncomeMode = (mode: IncomeMode) =>
    setPrefs(p => ({
      ...p,
      income_mode: mode,
      monthly_income: mode === 'individual' ? p.income_self + p.income_spouse : p.monthly_income,
    }))

  const setIndividualIncome = (who: 'income_self' | 'income_spouse') => (v: number) =>
    setPrefs(p => {
      const next = { ...p, [who]: v }
      return { ...next, monthly_income: next.income_self + next.income_spouse }
    })

  const addRegion = (r: string) => {
    const t = r.trim()
    if (!t || prefs.regions.includes(t)) return
    setPrefs(p => ({ ...p, regions: [...p.regions, t] }))
    setRegionInput('')
  }
  const toggleType = (type: string) =>
    setPrefs(p => ({
      ...p,
      property_types: p.property_types.includes(type)
        ? p.property_types.filter(t => t !== type)
        : [...p.property_types, type],
    }))

  // ── 자동 계산 ──────────────────────────────────────────────────────────
  const age = prefs.birth_year ? CURRENT_YEAR - prefs.birth_year : null
  const selfFunds = prefs.assets + prefs.deposit_to_recover + prefs.gift_amount

  // 세대(본인+배우자) 보유 주택 수 — 유주택자 대출 규제(수도권·규제지역 주담대 금지) 판정에 사용
  const HOME_COUNT: Record<string, number> = { none: 0, one: 1, multiple: 2 }
  const ownedHomes = (HOME_COUNT[prefs.self_home_status] ?? 0) + (HOME_COUNT[prefs.spouse_home_status ?? 'none'] ?? 0)

  const finance: UserFinance = useMemo(() => ({
    income: prefs.monthly_income,
    assets: prefs.assets,
    depositToRecover: prefs.deposit_to_recover,
    giftAmount: prefs.gift_amount,
    existingLoanPayment: prefs.existing_loan_payment,
    isNewlywed: prefs.is_newlywed,
    isFirstBuyer: prefs.is_first_buyer,
    noHomeYears: prefs.no_home_years,
    numChildren: prefs.num_children,
    ownedHomes,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [prefs.monthly_income, prefs.assets, prefs.deposit_to_recover, prefs.gift_amount,
       prefs.existing_loan_payment, prefs.is_newlywed, prefs.is_first_buyer,
       prefs.no_home_years, prefs.num_children, ownedHomes])

  const zone = useMemo(() => detectStrictestZone(prefs.regions), [prefs.regions])

  const affordableScenarios = useMemo<AffordableScenario[]>(() => {
    if (selfFunds === 0 && prefs.monthly_income === 0) return []
    if (selfFunds === 0) return []   // 자기자본 없으면 LTV 계산 불가
    return calcAffordableScenarios(selfFunds, finance, zone)
  }, [selfFunds, finance, prefs.monthly_income, zone])

  const bestEligible = affordableScenarios.find(s => s.eligible && s.maxPrice > 0)

  // What-if 전략 시뮬레이션 입력 — 조건을 바꿨을 때 구매력 변화를 비교
  const whatIfInput: WhatIfInput = useMemo(() => ({
    finance,
    selfFunds,
    zone,
    buyerType: prefs.buyer_type,
    marriageStatus: prefs.marriage_status,
    selfHomeStatus: prefs.self_home_status,
    spouseHomeStatus: prefs.spouse_home_status,
    incomeSelf: prefs.income_mode === 'individual' ? prefs.income_self : 0,
  }), [finance, selfFunds, zone, prefs.buyer_type, prefs.marriage_status,
       prefs.self_home_status, prefs.spouse_home_status, prefs.income_mode, prefs.income_self])

  const save = async () => {
    setSaving(true); setSaveError(false)
    try {
      const r = await fetch('/api/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      })
      if (!r.ok) throw new Error()
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setSaveError(true)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <main className="max-w-xl mx-auto px-4 py-12 text-gray-400 text-sm">불러오는 중...</main>
  }
  if (loadError) {
    return (
      <main className="max-w-xl mx-auto px-4 py-12 text-center space-y-3">
        <p className="text-gray-600 font-medium">설정을 불러오지 못했습니다</p>
        <p className="text-sm text-gray-400">네트워크 오류가 발생했습니다. 새로고침 후 다시 시도해주세요.</p>
        <button onClick={() => location.reload()} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm">새로고침</button>
      </main>
    )
  }

  return (
    <main className="max-w-xl mx-auto px-4 py-10 space-y-10">
      <div>
        <h1 className="text-xl font-bold text-gray-900">분석 및 추천</h1>
        <p className="text-sm text-gray-500 mt-1">
          실제 자금과 상태를 입력하면 구매 가능 금액을 계산하고, 조건을 바꿨을 때 더 유리해지는 전략까지 추천합니다.
        </p>
      </div>

      {/* ══ 1. 내 상태 ═══════════════════════════════════════════════════ */}
      <section className="space-y-4">
        <h2 className="font-semibold text-gray-800">내 상태</h2>

        <div className="grid grid-cols-2 gap-3">
          {([
            { key: 'is_newlywed' as const, icon: '💍', label: '신혼부부', desc: '혼인 7년 이내' },
            { key: 'is_first_buyer' as const, icon: '🏠', label: '생애최초', desc: '현재 주택 미보유' },
          ] as const).map(({ key, icon, label, desc }) => (
            <button key={key} onClick={() => setPrefs(p => {
              const next = !p[key]
              return key === 'is_newlywed'
                ? { ...p, is_newlywed: next, buyer_type: next ? 'couple' : 'solo' }
                : { ...p, [key]: next }
            })}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium transition-colors text-left ${
                prefs[key] ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 bg-white hover:border-gray-400'
              }`}>
              <span className="text-base">{icon}</span>
              <div>
                <p>{label}</p>
                <p className={`text-xs font-normal ${prefs[key] ? 'text-indigo-200' : 'text-gray-400'}`}>{desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* 출생연도 + 무주택 기간 */}
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">무주택 기간</p>

          {/* 출생연도 */}
          <div className="space-y-1">
            <label className="text-xs text-gray-500 block">출생연도 (입력 시 자동 계산)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={prefs.birth_year || ''}
                onChange={e => {
                  const year = e.target.value ? Number(e.target.value) : null
                  setPrefs(p => ({
                    ...p,
                    birth_year: year,
                    no_home_years: year ? calcNoHomeYears(year) : p.no_home_years,
                  }))
                }}
                placeholder="예: 1990"
                min={1950}
                max={CURRENT_YEAR - 18}
                className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
              />
              {age !== null && (
                <span className="text-sm text-gray-500">만 {age}세</span>
              )}
            </div>
          </div>

          {/* 무주택 기간 (자동 계산 + 직접 수정 가능) */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">무주택 기간</label>
              {prefs.birth_year && (
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-600">자동 계산됨 · 직접 수정 가능</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={prefs.no_home_years || ''}
                onChange={e => setPrefs(p => ({ ...p, no_home_years: Number(e.target.value) }))}
                placeholder="0"
                min={0}
                max={32}
                step={1}
                className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
              />
              <span className="text-xs text-gray-400">년</span>
              {prefs.no_home_years >= 15 && (
                <span className="text-xs font-medium text-green-600">청약 가점 만점 (32점)</span>
              )}
              {prefs.no_home_years > 0 && prefs.no_home_years < 15 && (
                <span className="text-xs text-gray-400">{15 - prefs.no_home_years}년 더 유지하면 만점</span>
              )}
            </div>
            <p className="text-[11px] text-gray-400">출생연도 입력 시 만 30세 이후 기간으로 자동 계산. 직접 수정하면 입력값이 우선 적용됩니다.</p>
          </div>
        </div>

        <NumInput
          label="자녀 수"
          value={prefs.num_children}
          onChange={set('num_children')}
          unit="명" step={1} placeholder="0"
          sub="자녀 1명 이상 시 신생아 특례 대출 (금리 1.6~3.3%) 자격 검토"
        />

        {(prefs.is_newlywed || prefs.is_first_buyer || prefs.num_children > 0) && (
          <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3 space-y-1">
            <p className="text-sm font-semibold text-indigo-900">✓ 적용 가능한 우대</p>
            {prefs.is_newlywed && prefs.is_first_buyer && (
              <p className="text-xs text-indigo-700">· 디딤돌 신혼생애최초 LTV 80%, 금리 2.15~3.0%, 한도 4억</p>
            )}
            {prefs.is_first_buyer && (
              <p className="text-xs text-indigo-700">· 생애최초 취득세 감면 최대 200만원</p>
            )}
            {prefs.num_children > 0 && (
              <p className="text-xs text-indigo-700">· 신생아 특례 대출 금리 1.6~3.3%, 한도 5억 (9억 이하 주택)</p>
            )}
            {prefs.is_newlywed && (
              <p className="text-xs text-indigo-700">· 보금자리론 신혼특례 소득한도 8,500만원</p>
            )}
          </div>
        )}
      </section>

      {/* ══ 1.5. 구매 전략 추천용 정보 ═══════════════════════════════════ */}
      <AdvisorProfileSection prefs={prefs} onChange={setAdvisorField} />

      {/* ══ 2. 재무 정보 ════════════════════════════════════════════════ */}
      <section className="space-y-4">
        <h2 className="font-semibold text-gray-800">재무 정보</h2>

        {prefs.is_newlywed && (
          <div className="space-y-2">
            <label className="text-xs text-gray-500 block">소득 입력 방식</label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setIncomeMode('combined')}
                className={`px-3 py-2 rounded-lg border text-left text-sm transition-colors ${
                  prefs.income_mode === 'combined'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'border-gray-200 text-gray-600 hover:border-gray-400'
                }`}>
                <p className="font-medium">부부합산으로 입력</p>
                <p className={`text-xs ${prefs.income_mode === 'combined' ? 'text-indigo-200' : 'text-gray-400'}`}>합산액을 바로 입력</p>
              </button>
              <button onClick={() => setIncomeMode('individual')}
                className={`px-3 py-2 rounded-lg border text-left text-sm transition-colors ${
                  prefs.income_mode === 'individual'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'border-gray-200 text-gray-600 hover:border-gray-400'
                }`}>
                <p className="font-medium">개별로 입력</p>
                <p className={`text-xs ${prefs.income_mode === 'individual' ? 'text-indigo-200' : 'text-gray-400'}`}>본인·배우자 각각 입력 후 자동 합산</p>
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {prefs.is_newlywed && prefs.income_mode === 'individual' ? (
            <>
              <EokManInput
                label="본인 연소득"
                value={prefs.income_self}
                onChange={setIndividualIncome('income_self')}
              />
              <EokManInput
                label="배우자 연소득"
                value={prefs.income_spouse}
                onChange={setIndividualIncome('income_spouse')}
              />
              <div className="col-span-2 flex items-center justify-between rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
                <span className="text-xs text-gray-500">부부합산 연소득 (자동 계산)</span>
                <span className="text-sm font-semibold text-gray-900">{priceLabel(prefs.monthly_income)}원</span>
              </div>
            </>
          ) : (
            <EokManInput
              label="부부합산 연소득"
              value={prefs.monthly_income}
              onChange={set('monthly_income')}
              sub="DSR 40% 대출 한도 계산에 사용"
            />
          )}
          <NumInput
            label="현재 월 대출 상환액"
            value={prefs.existing_loan_payment}
            onChange={set('existing_loan_payment')}
            unit="만원/월" placeholder="0"
            sub="기존 대출 있으면 입력 (DSR 한도 차감)"
          />
        </div>

        {/* 자기자본 구성 */}
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 space-y-4">
          <p className="text-sm font-medium text-gray-700">자기자본 구성</p>
          <div className="grid grid-cols-2 gap-4">
            <EokManInput label="현재 현금·저축" value={prefs.assets} onChange={set('assets')} />
            <EokManInput label="전세보증금 회수 예정" value={prefs.deposit_to_recover} onChange={set('deposit_to_recover')} />
            <EokManInput label="부모·가족 지원 예정" value={prefs.gift_amount} onChange={set('gift_amount')} />
            <EokManInput label="인테리어 예산 (별도)" value={prefs.renovation_budget} onChange={set('renovation_budget')} />
          </div>
          {selfFunds > 0 && (
            <div className="flex justify-between items-center border-t border-gray-200 pt-3 text-sm">
              <span className="text-gray-600">자기자본 합계</span>
              <span className="font-bold text-gray-900 text-base">{priceLabel(selfFunds)}원</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-xs text-gray-500 block">신용점수 구간</label>
          <div className="grid grid-cols-2 gap-2">
            {CREDIT_SCORE_OPTIONS.map(({ value, label, desc }) => (
              <button key={value} onClick={() => setPrefs(p => ({ ...p, credit_score_range: value }))}
                className={`px-3 py-2 rounded-lg border text-left text-sm transition-colors ${
                  prefs.credit_score_range === value
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'border-gray-200 text-gray-600 hover:border-gray-400'
                }`}>
                <p className="font-medium">{label}</p>
                <p className={`text-xs ${prefs.credit_score_range === value ? 'text-indigo-200' : 'text-gray-400'}`}>{desc}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 3. 구매 가능 금액 (자동 계산) ══════════════════════════════ */}
      {prefs.monthly_income > 0 && selfFunds === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          소득 정보가 입력되었습니다. 현금·저축, 전세보증금 등 자기자본을 입력하면 구매 가능 금액을 계산합니다.
        </div>
      )}
      {affordableScenarios.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="font-semibold text-gray-800">구매 가능 금액</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              자기자본 <strong>{priceLabel(selfFunds)}원</strong> 기준 · 대출 상품별 최대 구매가
              {zone !== 'none' && ' · 관심 지역 중 규제가 가장 강한 지역 기준으로 계산됨'}
              {ownedHomes > 0 && ` · 보유 주택 ${ownedHomes}채 반영 (유주택자 대출 규제 적용)`}
            </p>
          </div>

          {bestEligible && (
            <div className="rounded-xl bg-indigo-600 text-white p-4 space-y-1">
              <p className="text-xs text-indigo-200">{bestEligible.name} ({bestEligible.subName}) 기준 최대</p>
              <p className="text-2xl font-bold">{priceLabel(bestEligible.maxPrice)}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-indigo-100 mt-1">
                <span>대출 {priceLabel(bestEligible.loanAmount)}</span>
                <span>월 상환 {bestEligible.monthlyPayment.toLocaleString()}만원</span>
                <span>금리 {bestEligible.rateRange}</span>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500">
                  <th className="px-3 py-2 text-left font-medium">대출 상품</th>
                  <th className="px-3 py-2 text-right font-medium">최대 구매가</th>
                  <th className="px-3 py-2 text-right font-medium">대출액</th>
                  <th className="px-3 py-2 text-right font-medium">월 상환</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {affordableScenarios.map(s => (
                  <tr key={s.id} className={s.eligible ? '' : 'opacity-40 bg-gray-50'}>
                    <td className="px-3 py-2.5">
                      <div className="flex items-start gap-1.5">
                        <span className="text-[11px] mt-0.5 shrink-0">{s.eligible ? '✅' : '❌'}</span>
                        <div>
                          <p className="font-medium text-gray-800 leading-tight">{s.name}</p>
                          <p className="text-[11px] text-gray-400">{s.subName} · {s.rateRange}</p>
                          {!s.eligible && s.blockedReasons.slice(0, 1).map((r, i) => (
                            <p key={i} className="text-[11px] text-red-400">· {r}</p>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-gray-900">
                      {s.eligible && s.maxPrice > 0 ? priceLabel(s.maxPrice) : <span className="text-gray-300 font-normal">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-600">
                      {s.eligible && s.loanAmount > 0 ? priceLabel(s.loanAmount) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-600">
                      {s.eligible && s.monthlyPayment > 0
                        ? `${s.monthlyPayment.toLocaleString()}만원`
                        : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {bestEligible && (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 border border-amber-100 px-4 py-3">
              <p className="text-sm text-amber-800">
                <strong>{priceLabel(bestEligible.maxPrice)}</strong>을 예산 상한으로 설정할까요?
              </p>
              <button
                onClick={() => setPrefs(p => ({ ...p, budget_max: bestEligible.maxPrice }))}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-medium hover:bg-amber-600 transition-colors"
              >
                적용
              </button>
            </div>
          )}

          <p className="text-[11px] text-gray-400">
            ※ 취득세·법무사 등 부대비용 별도. 실제 대출은 금융기관 심사에 따라 다름.
          </p>
        </section>
      )}

      {/* ══ 3.5. 전략 추천 (What-if 시뮬레이션) ═══════════════════════════ */}
      {selfFunds > 0 && prefs.monthly_income > 0 && (
        <StrategySuggestions input={whatIfInput} />
      )}

      {/* ══ 4. 관심 지역 ════════════════════════════════════════════════ */}
      <section className="space-y-3">
        <h2 className="font-semibold text-gray-800">관심 지역</h2>
        <div className="flex flex-wrap gap-2">
          {prefs.regions.map(r => (
            <span key={r} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-sm">
              {r}
              <button onClick={() => setPrefs(p => ({ ...p, regions: p.regions.filter(x => x !== r) }))}
                className="text-indigo-400 hover:text-indigo-700 ml-0.5">×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={regionInput} onChange={e => setRegionInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addRegion(regionInput)}
            placeholder="지역 입력 후 Enter"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
          <button onClick={() => addRegion(regionInput)} className="px-3 py-2 rounded-lg bg-gray-100 text-sm text-gray-700 hover:bg-gray-200">추가</button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {REGIONS_PRESET.filter(r => !prefs.regions.includes(r)).map(r => (
            <button key={r} onClick={() => addRegion(r)} className="px-2 py-0.5 rounded-full border border-gray-200 text-xs text-gray-500 hover:border-indigo-300 hover:text-indigo-600">+ {r}</button>
          ))}
        </div>
      </section>

      {/* ══ 5. 예산 범위 (매물 필터) ════════════════════════════════════ */}
      <section className="space-y-3">
        <div>
          <h2 className="font-semibold text-gray-800">예산 범위 (매물 필터)</h2>
          <p className="text-xs text-gray-400 mt-0.5">위 구매 가능 금액을 참고해 설정하세요.</p>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <EokManInput label="최소" value={prefs.budget_min} onChange={set('budget_min')} />
          </div>
          <span className="text-gray-400 mt-8">~</span>
          <div className="flex-1">
            <EokManInput label="최대" value={prefs.budget_max} onChange={set('budget_max')} />
          </div>
        </div>
      </section>

      {/* ══ 6. 관심 매물 유형 ═══════════════════════════════════════════ */}
      <section className="space-y-3">
        <h2 className="font-semibold text-gray-800">관심 매물 유형</h2>
        <div className="flex gap-3">
          {PROPERTY_TYPE_OPTIONS.map(({ value, label }) => (
            <button key={value} onClick={() => toggleType(value)}
              className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                prefs.property_types.includes(value)
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-gray-200 text-gray-600 hover:border-gray-400'
              }`}>{label}</button>
          ))}
        </div>
      </section>

      {/* ══ 7. 알림 설정 ════════════════════════════════════════════════ */}
      <section className="space-y-4">
        <h2 className="font-semibold text-gray-800">알림 설정</h2>
        <div className="space-y-3">
          {([
            { key: 'notify_email' as const, label: '이메일 알림', desc: '일일 브리핑 및 긴급 뉴스를 이메일로 수신합니다' },
            { key: 'notify_kakao' as const, label: '카카오 알림', desc: '카카오 알림톡으로 중요 소식을 수신합니다 (준비 중)' },
          ]).map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-800">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
              </div>
              <button
                onClick={() => setNotif(n => ({ ...n, [key]: !n[key] }))}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors cursor-pointer ${
                  notif[key] ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
                role="switch"
                aria-checked={notif[key]}
              >
                <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                  notif[key] ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={saveNotif} disabled={savingNotif}
            className="px-4 py-2 rounded-lg bg-gray-800 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors">
            {savingNotif ? '저장 중...' : '알림 설정 저장'}
          </button>
          {savedNotif && <span className="text-sm text-green-600 font-medium">✓ 저장되었습니다</span>}
          {notifError && <span className="text-sm text-red-500 font-medium">저장에 실패했습니다. 다시 시도해주세요.</span>}
        </div>
      </section>

      {/* ══ 저장 ════════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-3 pb-4">
        <button onClick={save} disabled={saving}
          className="px-6 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors">
          {saving ? '저장 중...' : '내 정보 저장'}
        </button>
        {saved && <span className="text-sm text-green-600 font-medium">✓ 저장되었습니다</span>}
        {saveError && <span className="text-sm text-red-500 font-medium">저장에 실패했습니다. 다시 시도해주세요.</span>}
      </div>
    </main>
  )
}
