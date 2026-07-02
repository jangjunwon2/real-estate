// 부동산 계산 로직 — 규정 상수는 regulations.ts에서 관리합니다
import {
  DSR,
  ZONE_LISTS,
  LTV,
  LOAN_PRODUCTS,
  ACQUISITION_TAX,
  BROKER_FEE,
} from './regulations'

// ─── 인지세 ────────────────────────────────────────────────────────────────
function calcStampTax(price: number): number {
  if (price < 1000) return 0
  if (price < 3000) return 2
  if (price < 5000) return 4
  if (price < 10000) return 7
  if (price < 100000) return 15
  return 35
}

// ─── 취득세 (지방세법 제11조) ─────────────────────────────────────────────
export function calcAcquisitionTax(price: number, isFirstBuyer: boolean): {
  base: number
  discount: number
  final: number
  localEduTax: number
  stampTax: number
  totalTax: number
} {
  let rate: number
  if (price <= ACQUISITION_TAX.brackets1house[0].maxPrice) {
    rate = ACQUISITION_TAX.brackets1house[0].rate!
  } else if (price <= ACQUISITION_TAX.brackets1house[1].maxPrice) {
    rate = price / 1500000 - 0.03   // 구간세율: 취득가액(억) × 2/3 − 3
  } else {
    rate = ACQUISITION_TAX.brackets1house[2].rate!
  }

  const base = Math.round(price * rate)
  const discount = isFirstBuyer
    ? Math.min(base, ACQUISITION_TAX.firstBuyerDiscount.maxAmount)
    : 0
  const final = base - discount
  const localEduTax = Math.round(final * ACQUISITION_TAX.localEduTaxRate)
  const stampTax = calcStampTax(price)
  return { base, discount, final, localEduTax, stampTax, totalTax: final + localEduTax + stampTax }
}

// ─── 중개수수료 (공인중개사법 시행규칙 별표1) ─────────────────────────────
export function calcBrokerFee(price: number): number {
  const bracket = BROKER_FEE.brackets.find(b => price <= b.maxPrice)
  const rate = bracket?.rate ?? BROKER_FEE.brackets[BROKER_FEE.brackets.length - 1].rate
  return Math.round(price * rate)
}

// ─── 월 상환액 (원리금균등) ───────────────────────────────────────────────
export function calcMonthlyPayment(principal: number, annualRatePct: number, years = 30): number {
  if (principal <= 0) return 0
  const r = annualRatePct / 100 / 12
  const n = years * 12
  const factor = (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
  return Math.round(principal * factor)
}

// ─── 사용자 재정 정보 타입 ────────────────────────────────────────────────
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
  repRate: number
  rateRange: string
  ltvRate: number
  maxAmount: number      // 만원
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
  const monthlyBudget = Math.floor(income * 10000 * DSR.bankRate / 12) - (existingPayment * 10000)
  if (monthlyBudget <= 0) return 0
  return Math.floor((monthlyBudget * dsrFactor(annualRate)) / 10000)
}

export function calcDsrMaxLoan(income: number, existingPayment: number, annualRate = 3.5): number {
  return dsrMaxLoan(income, existingPayment, annualRate)
}

// ─── 구매 가능 금액 계산 ──────────────────────────────────────────────────
export function calcMaxAffordablePrice(
  selfFunds: number,
  ltvRate: number,
  loanCap: number,
  dsrMax: number,
  priceCap?: number,
): number {
  const maxLoan = Math.min(loanCap, dsrMax)
  let price = selfFunds + maxLoan
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

export function calcAffordableScenarios(selfFunds: number, fin: UserFinance): AffordableScenario[] {
  const d1 = LOAN_PRODUCTS.didimdolSpecial
  const d2 = LOAN_PRODUCTS.didimdolGeneral
  const nb = LOAN_PRODUCTS.newbornSpecial
  const bg = LOAN_PRODUCTS.bogumjari

  const specs = [
    {
      id: 'didimdol-special',
      name: d1.name, subName: d1.subName, repRate: d1.rates.representative, rateRange: d1.rateRange,
      ltvRate: d1.conditions.ltv, loanCap: d1.conditions.maxLoan, priceCap: d1.conditions.maxPrice,
      check: () => {
        const r: string[] = []
        if (!fin.isNewlywed)   r.push('신혼부부 요건 미충족 (혼인 7년 이내)')
        if (!fin.isFirstBuyer) r.push('생애최초 요건 미충족')
        if (fin.income > d1.conditions.maxIncome) r.push(`소득 초과 (${fin.income.toLocaleString()}만원 > ${d1.conditions.maxIncome.toLocaleString()}만원)`)
        return r
      },
    },
    {
      id: 'newborn',
      name: nb.name, subName: nb.subName, repRate: nb.rates.representative, rateRange: nb.rateRange,
      ltvRate: fin.isFirstBuyer ? nb.conditions.ltvFirstBuyer : nb.conditions.ltvGeneral,
      loanCap: nb.conditions.maxLoanAmount, priceCap: nb.conditions.maxPrice,
      check: () => {
        const r: string[] = []
        if (fin.numChildren < 1)  r.push('신생아 자녀 미입력 (2023.1.1 이후 출생)')
        if (fin.income > nb.conditions.maxIncome) r.push(`소득 초과 (${fin.income.toLocaleString()}만원 > 2억)`)
        return r
      },
    },
    {
      id: 'didimdol-general',
      name: d2.name, subName: d2.subName, repRate: d2.rates.representative, rateRange: d2.rateRange,
      ltvRate: d2.conditions.ltv, loanCap: d2.conditions.maxLoan, priceCap: d2.conditions.maxPrice,
      check: () => {
        const r: string[] = []
        if (!fin.isFirstBuyer) r.push('생애최초 요건 미충족')
        if (fin.income > d2.conditions.maxIncome) r.push(`소득 초과 (${fin.income.toLocaleString()}만원 > ${d2.conditions.maxIncome.toLocaleString()}만원)`)
        return r
      },
    },
    {
      id: 'bogumjari',
      name: bg.name,
      subName: fin.isNewlywed ? '신혼특례' : '일반',
      repRate: fin.isNewlywed ? bg.rates.newlywed.representative : bg.rates.general.representative,
      rateRange: fin.isNewlywed ? bg.rates.newlywed.range : bg.rates.general.range,
      ltvRate: bg.conditions.ltv, loanCap: bg.conditions.maxLoan, priceCap: bg.conditions.maxPrice,
      check: () => {
        const r: string[] = []
        const lim = fin.isNewlywed ? bg.conditions.maxIncomeNewlywed : bg.conditions.maxIncomeGeneral
        if (fin.income > lim) r.push(`소득 초과 (${fin.income.toLocaleString()}만원 > ${lim.toLocaleString()}만원)`)
        const netAsset = fin.assets + fin.depositToRecover + fin.giftAmount
        if (netAsset > bg.conditions.maxNetAsset) r.push(`순자산 초과 (${netAsset.toLocaleString()}만원 > 4.69억)`)
        return r
      },
    },
    {
      id: 'general',
      name: '일반 주담대', subName: '시중은행', repRate: 5.0, rateRange: '연 4~6%',
      ltvRate: 0.7, loanCap: 999999, priceCap: undefined as number | undefined,
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

// ─── 무주택 기간 (청약 가점용) ────────────────────────────────────────────
export function calcNoHomeYears(birthYear: number): number {
  const age = new Date().getFullYear() - birthYear
  return Math.max(0, age - 30)
}

// ─── 규제지역 타입 판별 ──────────────────────────────────────────────────
export type ZoneType = 'tohe' | 'overheat' | 'regulated' | 'none'

export function detectZoneType(sigungu: string | null | undefined): ZoneType {
  if (!sigungu) return 'none'
  if ((ZONE_LISTS.tohe as readonly string[]).some(z => sigungu.includes(z))) return 'tohe'
  if ((ZONE_LISTS.overheat as readonly string[]).some(z => sigungu.includes(z))) return 'overheat'
  if ((ZONE_LISTS.regulated as readonly string[]).some(z => sigungu.includes(z))) return 'regulated'
  return 'none'
}

function generalMortgageLtv(zone: ZoneType, price: number, isFirstBuyer: boolean): number {
  if (zone === 'overheat') {
    return isFirstBuyer && price <= LTV.overheat.firstBuyerPriceCap
      ? LTV.overheat.firstBuyer
      : LTV.overheat.general
  }
  if (zone === 'regulated') {
    if (isFirstBuyer) return LTV.regulated.firstBuyer
    return price <= LTV.regulated.priceBound ? LTV.regulated.general : LTV.regulated.above9
  }
  return isFirstBuyer ? LTV.none.firstBuyer : LTV.none.general
}

// ─── 대출 상품 목록 ───────────────────────────────────────────────────────
export function calcLoanProducts(
  price: number,
  fin: UserFinance,
  sigungu?: string | null,
): LoanProduct[] {
  const zone = detectZoneType(sigungu)
  const netAsset = fin.assets + fin.depositToRecover + fin.giftAmount

  const d1 = LOAN_PRODUCTS.didimdolSpecial
  const d2 = LOAN_PRODUCTS.didimdolGeneral
  const nb = LOAN_PRODUCTS.newbornSpecial
  const bg = LOAN_PRODUCTS.bogumjari

  // 디딤돌 (신혼·생애최초)
  const d1Reasons: string[] = []
  if (!fin.isNewlywed)   d1Reasons.push('신혼부부 요건 미충족 (혼인 7년 이내)')
  if (!fin.isFirstBuyer) d1Reasons.push('생애최초 요건 미충족')
  if (fin.income > d1.conditions.maxIncome) d1Reasons.push(`소득 초과 (${fin.income.toLocaleString()}만원 > 8,500만원)`)
  if (price > d1.conditions.maxPrice)       d1Reasons.push(`주택가격 초과 (5억 한도)`)
  const dsr1 = dsrMaxLoan(fin.income, fin.existingLoanPayment, d1.rates.representative)

  // 디딤돌 (일반·생애최초)
  const d2Reasons: string[] = []
  if (!fin.isFirstBuyer) d2Reasons.push('생애최초 요건 미충족')
  if (fin.income > d2.conditions.maxIncome) d2Reasons.push(`소득 초과 (${fin.income.toLocaleString()}만원 > 6,000만원)`)
  if (price > d2.conditions.maxPrice)       d2Reasons.push(`주택가격 초과 (5억 한도)`)
  const dsr2 = dsrMaxLoan(fin.income, fin.existingLoanPayment, d2.rates.representative)

  // 신생아 특례
  const ltvNewborn = fin.isFirstBuyer ? nb.conditions.ltvFirstBuyer : nb.conditions.ltvGeneral
  const newbornReasons: string[] = []
  if (fin.numChildren < 1)   newbornReasons.push('자녀 정보 미입력 (2023.1.1 이후 출생)')
  if (fin.income > nb.conditions.maxIncome) newbornReasons.push(`소득 초과 (${fin.income.toLocaleString()}만원 > 2억)`)
  if (price > nb.conditions.maxPrice)       newbornReasons.push(`주택가격 초과 (9억 한도)`)
  const dsrN = dsrMaxLoan(fin.income, fin.existingLoanPayment, nb.rates.representative)

  // 보금자리론
  const bogumIncomeLimit = fin.isNewlywed ? bg.conditions.maxIncomeNewlywed : bg.conditions.maxIncomeGeneral
  const bogumRate = fin.isNewlywed ? bg.rates.newlywed.representative : bg.rates.general.representative
  const bogumRateRange = fin.isNewlywed ? bg.rates.newlywed.range : bg.rates.general.range
  const b1Reasons: string[] = []
  if (fin.income > bogumIncomeLimit) b1Reasons.push(`소득 초과 (${fin.income.toLocaleString()}만원 > ${bogumIncomeLimit.toLocaleString()}만원)`)
  if (price > bg.conditions.maxPrice) b1Reasons.push(`주택가격 초과 (6억 한도)`)
  if (netAsset > bg.conditions.maxNetAsset) b1Reasons.push(`순자산 초과 (4.69억 한도)`)
  const dsr3 = dsrMaxLoan(fin.income, fin.existingLoanPayment, bogumRate)

  // 일반 주담대
  const genLtv = generalMortgageLtv(zone, price, fin.isFirstBuyer)
  const genReasons: string[] = fin.income === 0 ? ['소득 정보 미입력'] : []
  const dsr5 = dsrMaxLoan(fin.income, fin.existingLoanPayment, 5.0)
  const zoneLabel = zone === 'overheat' ? '투기과열지구' : zone === 'regulated' ? '조정대상지역' : ''

  return [
    {
      id: 'didimdol-special',
      name: d1.name, subName: d1.subName,
      repRate: d1.rates.representative, rateRange: d1.rateRange,
      ltvRate: d1.conditions.ltv, maxAmount: d1.conditions.maxLoan,
      eligible: d1Reasons.length === 0, blockedReasons: d1Reasons,
      calcLoan: (p) => d1Reasons.length === 0
        ? Math.min(Math.round(p * d1.conditions.ltv), d1.conditions.maxLoan, dsr1) : 0,
    },
    {
      id: 'newborn',
      name: nb.name, subName: `생애최초 LTV ${Math.round(ltvNewborn * 100)}%`,
      repRate: nb.rates.representative, rateRange: nb.rateRange,
      ltvRate: ltvNewborn, maxAmount: nb.conditions.maxLoanAmount,
      eligible: newbornReasons.length === 0, blockedReasons: newbornReasons,
      calcLoan: (p) => newbornReasons.length === 0
        ? Math.min(Math.round(p * ltvNewborn), nb.conditions.maxLoanAmount, dsrN) : 0,
    },
    {
      id: 'didimdol-general',
      name: d2.name, subName: d2.subName,
      repRate: d2.rates.representative, rateRange: d2.rateRange,
      ltvRate: d2.conditions.ltv, maxAmount: d2.conditions.maxLoan,
      eligible: d2Reasons.length === 0, blockedReasons: d2Reasons,
      calcLoan: (p) => d2Reasons.length === 0
        ? Math.min(Math.round(p * d2.conditions.ltv), d2.conditions.maxLoan, dsr2) : 0,
    },
    {
      id: 'bogumjari',
      name: bg.name,
      subName: fin.isNewlywed ? `신혼특례 (소득한도 ${bg.conditions.maxIncomeNewlywed.toLocaleString()}만원)` : '일반',
      repRate: bogumRate, rateRange: bogumRateRange,
      ltvRate: bg.conditions.ltv, maxAmount: bg.conditions.maxLoan,
      eligible: b1Reasons.length === 0, blockedReasons: b1Reasons,
      calcLoan: (p) => b1Reasons.length === 0
        ? Math.min(Math.round(p * bg.conditions.ltv), bg.conditions.maxLoan, dsr3) : 0,
    },
    {
      id: 'general',
      name: '일반 주담대',
      subName: `시중은행${zoneLabel ? ` · ${zoneLabel} LTV ${Math.round(genLtv * 100)}%` : ''}`,
      repRate: 5.0, rateRange: '연 4~6%',
      ltvRate: genLtv, maxAmount: 999999,
      eligible: fin.income > 0, blockedReasons: genReasons,
      calcLoan: (p) => fin.income > 0 ? Math.min(Math.round(p * genLtv), dsr5) : 0,
    },
  ]
}

// ─── 규제 지역 상세 안내 ─────────────────────────────────────────────────
export interface RegulationZone {
  type: 'tohe' | 'overheat' | 'regulated' | 'price-cap'
  label: string
  description: string
  ltvCap: number | null
  notes: string[]
}

import { TOHE_RULES } from './regulations'

export function detectRegulations(sigungu: string | null | undefined): RegulationZone[] {
  if (!sigungu) return []
  const zones: RegulationZone[] = []

  if ((ZONE_LISTS.tohe as readonly string[]).some(z => sigungu.includes(z))) {
    zones.push({
      type: 'tohe',
      label: TOHE_RULES.label,
      description: '해당 지역은 토지거래허가구역(토허제)입니다.',
      ltvCap: null,
      notes: TOHE_RULES.obligations as unknown as string[],
    })
  }

  if ((ZONE_LISTS.overheat as readonly string[]).some(z => sigungu.includes(z))) {
    zones.push({
      type: 'overheat',
      label: '투기과열지구',
      description: '투기과열지구 규정이 적용됩니다.',
      ltvCap: LTV.overheat.general,
      notes: [
        `일반 LTV ${Math.round(LTV.overheat.general * 100)}% (생애최초 9억 이하 ${Math.round(LTV.overheat.firstBuyer * 100)}% 예외)`,
        '1순위 청약 — 세대주만 가능, 5년 내 당첨자 제한',
        '재당첨 제한 10년',
        '정비사업 조합원 지위 양도 제한',
      ],
    })
  }

  if ((ZONE_LISTS.regulated as readonly string[]).some(z => sigungu.includes(z))) {
    zones.push({
      type: 'regulated',
      label: '조정대상지역',
      description: '조정대상지역 규정이 적용됩니다.',
      ltvCap: LTV.regulated.general,
      notes: [
        `LTV ${Math.round(LTV.regulated.general * 100)}% (9억 초과 ${Math.round(LTV.regulated.above9 * 100)}%), 생애최초 ${Math.round(LTV.regulated.firstBuyer * 100)}% 예외`,
        '2주택 이상 양도세 중과 (기본세율 + 20%p)',
        '분양권 전매제한 — 소유권 이전등기 시까지',
      ],
    })
  }

  return zones
}
