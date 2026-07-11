import NumInput from './NumInput'

export type HomeStatus = 'none' | 'one' | 'multiple'
export type BuyerType = 'solo' | 'couple'
export type MarriageStatus = 'registered' | 'planned' | 'undetermined'

export interface AdvisorProfileFields {
  buyer_type: BuyerType
  marriage_status: MarriageStatus | null
  self_home_status: HomeStatus
  spouse_home_status: HomeStatus | null
  household_head: boolean
  subscription_account_years: number
}

interface AdvisorProfileSectionProps {
  prefs: AdvisorProfileFields
  onChange: <K extends keyof AdvisorProfileFields>(key: K) => (value: AdvisorProfileFields[K]) => void
}

const HOME_STATUS_OPTIONS: { value: HomeStatus; label: string }[] = [
  { value: 'none', label: '무주택' },
  { value: 'one', label: '1주택' },
  { value: 'multiple', label: '다주택' },
]

const MARRIAGE_STATUS_OPTIONS: { value: MarriageStatus; label: string }[] = [
  { value: 'registered', label: '혼인신고 완료' },
  { value: 'planned', label: '예식만 하고 신고 전' },
  { value: 'undetermined', label: '아직 미정' },
]

export default function AdvisorProfileSection({ prefs, onChange }: AdvisorProfileSectionProps) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-semibold text-gray-800">구매 전략 추천용 정보</h2>
        <p className="text-xs text-gray-400 mt-0.5">입력하면 /advisor 페이지에서 혼인신고 시점·명의·매수방식 추천을 받을 수 있어요</p>
        {prefs.buyer_type !== 'couple' && (
          <p className="text-[11px] text-amber-600 mt-1">위 &quot;내 상태&quot;에서 신혼부부를 켜면 배우자 관련 항목(혼인신고 상태·배우자 주택보유현황)이 추가로 나타나요</p>
        )}
      </div>

      {prefs.buyer_type === 'couple' && (
        <div className="space-y-2">
          <label className="text-xs text-gray-500 block">혼인신고 상태</label>
          <div className="grid grid-cols-3 gap-2">
            {MARRIAGE_STATUS_OPTIONS.map(({ value, label }) => (
              <button key={value} onClick={() => onChange('marriage_status')(value)}
                className={`px-2 py-2 rounded-lg border text-xs transition-colors ${
                  prefs.marriage_status === value ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:border-gray-400'
                }`}>{label}</button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs text-gray-500 block">본인 주택보유현황</label>
          <div className="grid grid-cols-3 gap-1.5">
            {HOME_STATUS_OPTIONS.map(({ value, label }) => (
              <button key={value} onClick={() => onChange('self_home_status')(value)}
                className={`px-2 py-1.5 rounded-lg border text-xs transition-colors ${
                  prefs.self_home_status === value ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:border-gray-400'
                }`}>{label}</button>
            ))}
          </div>
        </div>
        {prefs.buyer_type === 'couple' && (
          <div className="space-y-2">
            <label className="text-xs text-gray-500 block">배우자 주택보유현황</label>
            <div className="grid grid-cols-3 gap-1.5">
              {HOME_STATUS_OPTIONS.map(({ value, label }) => (
                <button key={value} onClick={() => onChange('spouse_home_status')(value)}
                  className={`px-2 py-1.5 rounded-lg border text-xs transition-colors ${
                    prefs.spouse_home_status === value ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:border-gray-400'
                  }`}>{label}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 items-end">
        <button onClick={() => onChange('household_head')(!prefs.household_head)}
          className={`px-3 py-2.5 rounded-lg border text-sm text-left transition-colors ${
            prefs.household_head ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:border-gray-400'
          }`}>
          <p className="font-medium">{prefs.household_head ? '세대주 ✓' : '세대주 아님'}</p>
          <p className={`text-[11px] font-normal ${prefs.household_head ? 'text-indigo-200' : 'text-gray-400'}`}>무주택 세대주 전용 특별공급 자격에 영향</p>
        </button>
        <NumInput
          label="청약통장 가입기간"
          value={prefs.subscription_account_years}
          onChange={onChange('subscription_account_years')}
          unit="년" step={1} placeholder="0"
        />
      </div>
    </section>
  )
}
