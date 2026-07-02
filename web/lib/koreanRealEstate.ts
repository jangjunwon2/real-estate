// Korean real-estate calculation logic (2025 기준)

// ─── 취득세 ────────────────────────────────────────────────────────────────
// 정확한 지방세법 제11조 공식: 세율(%) = 취득가액(억) × 2/3 − 3
// 지방교육세: 취득세 × 20%, 인지세: 구간별 정액

function calcStampTax(price: number): number {
  // price: 만원
  if (price < 1000) return 0
  if (price < 3000) return 2
  if (price < 5000) return 4
  if (price < 10000) return 7
  if (price < 100000) return 15
  return 35
}

export function calcAcquisitionTax(price: number, isFirstBuyer: boolean): {
  base: number
  discount: number
  final: number
  localEduTax: number
  stampTax: number
  totalTax: number
} {
  // price: 만원
  let rate: number
  if (price <= 60000) {                           // ≤ 6억: 1%
    rate = 0.01
  } else if (price <= 90000) {                    // 6억~9억 구간세율
    rate = price / 1500000 - 0.03               // = (억 × 2/3 − 3) / 100
  } else {                                        // > 9억: 3%
    rate = 0.03
  }

  const base = Math.round(price * rate)
  const discount = isFirstBuyer ? Math.min(base, 200) : 0
  const final = base - discount
  const localEduTax = Math.round(final * 0.2)    // 지방교육세 20%
  const stampTax = calcStampTax(price)            // 인지세
  return { base, discount, final, localEduTax, stampTax, totalTax: final + localEduTax + stampTax }
}

// ─── 중개수수료 ────────────────────────────────────────────────────────────
export function calcBrokerFee(price: number): number {
  let rate: number
  if (price < 20000) rate = 0.005
  else if (price < 60000) rate = 0.004
  else if (price < 120000) rate = 0.005
  else if (price < 150000) rate = 0.006
  else rate = 0.007
  return Math.round(price * rate)
}

// ─── 월 상환액 (원리금균등) ───────────────────────────────────────────────
export function calcMonthlyPayment(principal: number, annualRatePct: number, years = 30): number {
  // principal: 만원, annualRatePct: % (e.g. 3.5), 반환값: 만원/월
  if (principal <= 0) return 0
  const r = annualRatePct / 100 / 12
  const n = years * 12
  const factor = (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
  return Math.round(principal * factor)
}

// ─── 대출 상품 ────────────────────────────────────────────────────────────
export interface UserFinance {
  income: number              // 부부합산 연소득 (만원)
  assets: number              // 현재 자산 (만원)
  depositToRecover: number    // 전세보증금 회수 예정 (만원)
  giftAmount: number          // 가족 지원 예정 (만원)
  existingLoanPayment: number // 현재 월 대출 상환액 (만원)
  isNewlywed: boolean
  isFirstBuyer: boolean
  noHomeYears: number
  numChildren: number
}

export interface LoanProduct {
  id: string
  name: string
  subName: string
  repRate: number          // 대표 금리 (%, 월 상환액 계산용)
  rateRange: string
  ltvRate: number
  maxAmount: number        // 만원
  eligible: boolean
  blockedReasons: string[]
  calcLoan: (price: number) => number
}

// ─── DSR 역산 ────────────────────────────────────────────────────────────
function dsrFactor(annualRatePct: number): number {
  const r = annualRatePct / 100 / 12
  const n = 360
  return ((Math.pow(1 + r, n) - 1) / (r * Math.pow(1 + r, n)))
}

function dsrMaxLoan(income: number, existingPayment: number, annualRate = 3.5): number {
  const monthlyBudget = Math.floor(income * 10000 * 0.4 / 12) - (existingPayment * 10000)
  if (monthlyBudget <= 0) return 0
  return Math.floor((monthlyBudget * dsrFactor(annualRate)) / 10000)
}

// Public version for use in client components
export function calcDsrMaxLoan(income: number, existingPayment: number, annualRate = 3.5): number {
  return dsrMaxLoan(income, existingPayment, annualRate)
}

// ─── 구매 가능 금액 계산 ──────────────────────────────────────────────────
// selfFunds + maxLoan = maxPrice (LTV·한도·DSR 3중 제약)
export function calcMaxAffordablePrice(
  selfFunds: number,   // 자기자본 (만원)
  ltvRate: number,
  loanCap: number,     // 상품 최대 대출 한도 (만원)
  dsrMax: number,      // DSR 기준 최대 대출 (만원)
  priceCap?: number,   // 상품 주택가격 상한 (만원)
): number {
  const maxLoan = Math.min(loanCap, dsrMax)
  let price = selfFunds + maxLoan
  // LTV 제약이 DSR·한도보다 더 엄격한 경우
  if (price * ltvRate < maxLoan) {
    price = Math.round(selfFunds / (1 - ltvRate))
  }
  if (priceCap && price > priceCap) price = priceCap
  return Math.round(price)
}

export interface AffordableScenario {
  id: string
  name: string
  subName: string
  maxPrice: number
  loanAmount: number
  monthlyPayment: number
  repRate: number
  rateRange: string
  eligible: boolean
  blockedReasons: string[]
}

export function calcAffordableScenarios(
  selfFunds: number,
  fin: UserFinance,
): AffordableScenario[] {
  // 상품별 스펙 (가격-비의존 적격성 기준)
  const specs = [
    {
      id: 'didimdol-special', name: '디딤돌 대출', subName: '신혼부부·생애최초',
      repRate: 2.15, rateRange: '2.15~3.0%', ltvRate: 0.8, loanCap: 40000, priceCap: 50000,
      check: () => {
        const r: string[] = []
        if (!fin.isNewlywed)   r.push('신혼부부 요건 미충족')
        if (!fin.isFirstBuyer) r.push('생애최초 요건 미충족')
        if (fin.income > 8500) r.push(`소득 초과 (${fin.income.toLocaleString()}만원 > 8,500만원)`)
        return r
      },
    },
    {
      id: 'newborn', name: '신생아 특례 대출', subName: '자녀 있는 가구',
      repRate: 1.6, rateRange: '1.6~3.3%', ltvRate: fin.isFirstBuyer ? 0.8 : 0.7, loanCap: 50000, priceCap: 90000,
      check: () => {
        const r: string[] = []
        if (fin.numChildren < 1) r.push('신생아 자녀 미입력')
        if (fin.income > 20000) r.push(`소득 초과 (${fin.income.toLocaleString()}만원 > 2억)`)
        return r
      },
    },
    {
      id: 'didimdol-general', name: '디딤돌 대출', subName: '생애최초',
      repRate: 2.65, rateRange: '2.45~3.3%', ltvRate: 0.7, loanCap: 25000, priceCap: 50000,
      check: () => {
        const r: string[] = []
        if (!fin.isFirstBuyer) r.push('생애최초 요건 미충족')
        if (fin.income > 6000) r.push(`소득 초과 (${fin.income.toLocaleString()}만원 > 6,000만원)`)
        return r
      },
    },
    {
      id: 'bogumjari', name: '보금자리론', subName: fin.isNewlywed ? '신혼특례' : '일반',
      repRate: fin.isNewlywed ? 3.2 : 3.95, rateRange: fin.isNewlywed ? '2.4~3.95%' : '3.95~4.5%',
      ltvRate: 0.7, loanCap: 36000, priceCap: 60000,
      check: () => {
        const r: string[] = []
        const lim = fin.isNewlywed ? 8500 : 7000
        if (fin.income > lim) r.push(`소득 초과 (${fin.income.toLocaleString()}만원 > ${lim.toLocaleString()}만원)`)
        const netAsset = fin.assets + fin.depositToRecover + fin.giftAmount
        if (netAsset > 46900) r.push(`순자산 초과`)
        return r
      },
    },
    {
      id: 'general', name: '일반 주담대', subName: '시중은행',
      repRate: 5.0, rateRange: '연 4~6%', ltvRate: 0.7, loanCap: 999999, priceCap: undefined as number | undefined,
      check: () => fin.income === 0 ? ['소득 정보 미입력'] : [],
    },
  ]

  return specs.map(s => {
    const blockedReasons = s.check()
    const eligible = blockedReasons.length === 0
    if (!eligible || fin.income === 0) {
      return { id: s.id, name: s.name, subName: s.subName, maxPrice: 0, loanAmount: 0, monthlyPayment: 0, repRate: s.repRate, rateRange: s.rateRange, eligible, blockedReasons }
    }
    const dsrMax = dsrMaxLoan(fin.income, fin.existingLoanPayment, s.repRate)
    const maxPrice = calcMaxAffordablePrice(selfFunds, s.ltvRate, s.loanCap, dsrMax, s.priceCap)
    const loanAmount = Math.max(0, maxPrice - selfFunds)
    const monthly = calcMonthlyPayment(loanAmount, s.repRate)
    return { id: s.id, name: s.name, subName: s.subName, maxPrice, loanAmount, monthlyPayment: monthly, repRate: s.repRate, rateRange: s.rateRange, eligible, blockedReasons }
  })
}

// ─── 무주택 기간 (출생연도 기준) ─────────────────────────────────────────
// 청약 가점: 만 30세 이후 무주택 기간 기준
export function calcNoHomeYears(birthYear: number): number {
  const age = new Date().getFullYear() - birthYear
  return Math.max(0, age - 30)
}

// ─── 규제지역 LTV 상한 ────────────────────────────────────────────────────
const TOHE_ZONES    = ['강남구', '서초구', '송파구', '용산구']
const OVERHEAT_ZONES = ['강남구', '서초구', '송파구', '강동구', '용산구']
const REGULATED_ZONES = [
  '강남구', '서초구', '송파구', '강동구', '용산구',
  '성동구', '광진구', '동대문구', '중랑구', '성북구',
  '강북구', '도봉구', '노원구', '은평구', '서대문구',
  '마포구', '양천구', '강서구', '구로구', '금천구',
  '영등포구', '동작구', '관악구',
]

export type ZoneType = 'tohe' | 'overheat' | 'regulated' | 'none'

export function detectZoneType(sigungu: string | null | undefined): ZoneType {
  if (!sigungu) return 'none'
  if (TOHE_ZONES.some(z => sigungu.includes(z))) return 'tohe'
  if (OVERHEAT_ZONES.some(z => sigungu.includes(z))) return 'overheat'
  if (REGULATED_ZONES.some(z => sigungu.includes(z))) return 'regulated'
  return 'none'
}

function generalMortgageLtv(zone: ZoneType, price: number, isFirstBuyer: boolean): number {
  if (zone === 'overheat') return isFirstBuyer && price <= 90000 ? 0.8 : 0.5
  if (zone === 'regulated') return isFirstBuyer ? 0.8 : (price <= 90000 ? 0.6 : 0.5)
  return 0.7
}

// ─── 대출 상품 목록 ───────────────────────────────────────────────────────
export function calcLoanProducts(
  price: number,
  fin: UserFinance,
  sigungu?: string | null,
): LoanProduct[] {
  const zone = detectZoneType(sigungu)
  const netAsset = fin.assets + fin.depositToRecover + fin.giftAmount
  const hasNewborn = fin.numChildren >= 1  // 2023.1.1 이후 출생 자녀 있음 가정

  // ── 1. 디딤돌 (신혼부부 생애최초) ──────────────────────────────────────
  const d1Reasons: string[] = []
  if (!fin.isNewlywed)    d1Reasons.push('신혼부부 요건 미충족 (혼인 7년 이내)')
  if (!fin.isFirstBuyer)  d1Reasons.push('생애최초 요건 미충족')
  if (fin.income > 8500)  d1Reasons.push(`소득 초과 (${fin.income.toLocaleString()}만원 > 8,500만원)`)
  if (price > 50000)      d1Reasons.push(`주택가격 초과 (${price.toLocaleString()}만원 > 5억)`)
  const dsr1 = dsrMaxLoan(fin.income, fin.existingLoanPayment, 2.15)

  // ── 2. 디딤돌 (일반 생애최초) ──────────────────────────────────────────
  const d2Reasons: string[] = []
  if (!fin.isFirstBuyer)  d2Reasons.push('생애최초 요건 미충족')
  if (fin.income > 6000)  d2Reasons.push(`소득 초과 (${fin.income.toLocaleString()}만원 > 6,000만원)`)
  if (price > 50000)      d2Reasons.push(`주택가격 초과 (${price.toLocaleString()}만원 > 5억)`)
  const dsr2 = dsrMaxLoan(fin.income, fin.existingLoanPayment, 2.65)

  // ── 3. 신생아 특례 대출 ────────────────────────────────────────────────
  const newbornReasons: string[] = []
  if (!hasNewborn)        newbornReasons.push('자녀 정보 미입력 (신생아 있는 가구 대상)')
  if (fin.income > 20000) newbornReasons.push(`소득 초과 (${fin.income.toLocaleString()}만원 > 2억)`)
  if (price > 90000)      newbornReasons.push(`주택가격 초과 (${price.toLocaleString()}만원 > 9억)`)
  const ltvNewborn = fin.isFirstBuyer ? 0.8 : 0.7
  const dsrN = dsrMaxLoan(fin.income, fin.existingLoanPayment, 1.6)

  // ── 4. 보금자리론 ──────────────────────────────────────────────────────
  const bogumIncomeLimit = fin.isNewlywed ? 8500 : 7000
  const b1Reasons: string[] = []
  if (fin.income > bogumIncomeLimit) b1Reasons.push(`소득 초과 (${fin.income.toLocaleString()}만원 > ${bogumIncomeLimit.toLocaleString()}만원)`)
  if (price > 60000)      b1Reasons.push(`주택가격 초과 (${price.toLocaleString()}만원 > 6억)`)
  if (netAsset > 46900)   b1Reasons.push(`순자산 초과 (${netAsset.toLocaleString()}만원 > 4.69억)`)
  const bogumRate = fin.isNewlywed ? 3.2 : 3.95
  const dsr3 = dsrMaxLoan(fin.income, fin.existingLoanPayment, bogumRate)

  // ── 5. 일반 주담대 ─────────────────────────────────────────────────────
  const genLtv = generalMortgageLtv(zone, price, fin.isFirstBuyer)
  const genReasons: string[] = []
  if (fin.income === 0) genReasons.push('소득 정보 미입력')
  const dsr5 = dsrMaxLoan(fin.income, fin.existingLoanPayment, 5.0)
  const zoneLabel = zone === 'overheat' ? '투기과열지구' : zone === 'regulated' ? '조정대상지역' : ''

  const products: LoanProduct[] = [
    {
      id: 'didimdol-special',
      name: '디딤돌 대출',
      subName: '신혼부부·생애최초',
      repRate: 2.15,
      rateRange: '2.15 ~ 3.0%',
      ltvRate: 0.8,
      maxAmount: 40000,
      eligible: d1Reasons.length === 0,
      blockedReasons: d1Reasons,
      calcLoan: (p) => d1Reasons.length === 0 ? Math.min(Math.round(p * 0.8), 40000, dsr1) : 0,
    },
    {
      id: 'newborn',
      name: '신생아 특례 대출',
      subName: `생애최초 LTV ${Math.round(ltvNewborn * 100)}%`,
      repRate: 1.6,
      rateRange: '1.6 ~ 3.3%',
      ltvRate: ltvNewborn,
      maxAmount: 50000,
      eligible: newbornReasons.length === 0,
      blockedReasons: newbornReasons,
      calcLoan: (p) => newbornReasons.length === 0 ? Math.min(Math.round(p * ltvNewborn), 50000, dsrN) : 0,
    },
    {
      id: 'didimdol-general',
      name: '디딤돌 대출',
      subName: '생애최초',
      repRate: 2.65,
      rateRange: '2.45 ~ 3.3%',
      ltvRate: 0.7,
      maxAmount: 25000,
      eligible: d2Reasons.length === 0,
      blockedReasons: d2Reasons,
      calcLoan: (p) => d2Reasons.length === 0 ? Math.min(Math.round(p * 0.7), 25000, dsr2) : 0,
    },
    {
      id: 'bogumjari',
      name: '보금자리론',
      subName: fin.isNewlywed ? '신혼특례 (소득한도 8,500만원)' : '일반',
      repRate: bogumRate,
      rateRange: fin.isNewlywed ? '2.4 ~ 3.95%' : '3.95 ~ 4.5%',
      ltvRate: 0.7,
      maxAmount: 36000,
      eligible: b1Reasons.length === 0,
      blockedReasons: b1Reasons,
      calcLoan: (p) => b1Reasons.length === 0 ? Math.min(Math.round(p * 0.7), 36000, dsr3) : 0,
    },
    {
      id: 'general',
      name: '일반 주담대',
      subName: `시중은행${zoneLabel ? ` · ${zoneLabel} LTV ${Math.round(genLtv * 100)}%` : ''}`,
      repRate: 5.0,
      rateRange: '연 4~6%',
      ltvRate: genLtv,
      maxAmount: 999999,
      eligible: fin.income > 0,
      blockedReasons: genReasons,
      calcLoan: (p) => fin.income > 0 ? Math.min(Math.round(p * genLtv), dsr5) : 0,
    },
  ]

  return products
}

// ─── 규제 지역 상세 안내 ─────────────────────────────────────────────────
export interface RegulationZone {
  type: 'tohe' | 'overheat' | 'regulated' | 'price-cap'
  label: string
  description: string
  ltvCap: number | null
  notes: string[]
}

export function detectRegulations(sigungu: string | null | undefined): RegulationZone[] {
  if (!sigungu) return []
  const zones: RegulationZone[] = []

  if (TOHE_ZONES.some(z => sigungu.includes(z))) {
    zones.push({
      type: 'tohe',
      label: '토지거래허가구역',
      description: '해당 지역은 토지거래허가구역(토허제)입니다.',
      ltvCap: null,
      notes: [
        '실거주 의무 2년 (주거용 취득 시)',
        '구청 사전 허가 없이 계약 불가',
        '전세 세입자 있는 상태로 매수 불가',
      ],
    })
  }

  if (OVERHEAT_ZONES.some(z => sigungu.includes(z))) {
    zones.push({
      type: 'overheat',
      label: '투기과열지구',
      description: '투기과열지구 규정이 적용됩니다.',
      ltvCap: 0.5,
      notes: [
        '일반 LTV 50% (생애최초 9억 이하 80% 예외)',
        '1순위 청약 제한 — 5년 내 당첨자 제한',
        '재당첨 제한 10년',
        '정비사업 조합원 지위 양도 제한',
      ],
    })
  }

  if (REGULATED_ZONES.some(z => sigungu.includes(z))) {
    zones.push({
      type: 'regulated',
      label: '조정대상지역',
      description: '조정대상지역 규정이 적용됩니다.',
      ltvCap: 0.6,
      notes: [
        'LTV 60% (9억 초과 50%), 생애최초 80% 예외',
        '2주택 이상 양도세 중과 (기본세율 + 20%p)',
        '분양권 전매제한 — 소유권 이전등기 시까지',
      ],
    })
  }

  return zones
}
