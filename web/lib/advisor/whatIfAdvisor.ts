// What-if 전략 시뮬레이션 — 현재 입력값에서 조건을 하나씩 바꿔보고,
// 실제 대출 규제 계산(calcAffordableScenarios)으로 구매력이 얼마나 달라지는지 정량 비교한다.
// 이득이 있는 시나리오만 카드로 반환한다.
import {
  calcAffordableScenarios,
  type UserFinance,
  type ZoneType,
} from '../koreanRealEstate'
import type { BuyerType, HomeStatus, MarriageStatus } from './types'

export interface WhatIfInput {
  finance: UserFinance
  selfFunds: number          // 자기자본 (만원)
  zone: ZoneType             // 관심 지역 중 가장 엄격한 규제 존
  buyerType: BuyerType
  marriageStatus: MarriageStatus | null
  selfHomeStatus: HomeStatus
  spouseHomeStatus: HomeStatus | null
  incomeSelf: number         // 본인 연소득 (만원, 개별 입력 시에만 > 0)
}

export interface WhatIfSuggestion {
  id: string
  icon: string
  title: string
  currentMax: number         // 비교 기준 최대 구매가 (만원)
  currentLabel: string       // 비교 기준 설명 (기본: '현재 조건')
  variantMax: number         // 조건 변경 시 최대 구매가 (만원)
  variantLabel: string       // 변경 시나리오 설명
  deltaAmount: number        // variantMax - currentMax (만원)
  conclusion: string
  reasons: string[]
  caution?: string
}

const HOME_COUNT: Record<HomeStatus, number> = { none: 0, one: 1, multiple: 2 }

/** 적격 대출 상품 중 가장 높은 최대 구매가 — 적격 상품이 없으면 자기자본만으로 계산 */
function bestMaxPrice(selfFunds: number, fin: UserFinance, zone: ZoneType): number {
  const scenarios = calcAffordableScenarios(selfFunds, fin, zone)
  const best = Math.max(0, ...scenarios.filter(s => s.eligible).map(s => s.maxPrice))
  return best > 0 ? best : selfFunds
}

export function buildWhatIfSuggestions(input: WhatIfInput): WhatIfSuggestion[] {
  const { finance: fin, selfFunds, zone } = input
  // 소득·자기자본이 없으면 시뮬레이션 자체가 불가능
  if (fin.income <= 0 || selfFunds <= 0) return []

  const currentMax = bestMaxPrice(selfFunds, fin, zone)
  const suggestions: WhatIfSuggestion[] = []

  // 기본형: 현재 조건 vs 변경 시나리오 — 이득이 있을 때만 추가
  const push = (
    s: Omit<WhatIfSuggestion, 'currentMax' | 'currentLabel' | 'deltaAmount'>,
  ) => {
    const delta = s.variantMax - currentMax
    if (delta <= 0) return
    suggestions.push({ ...s, currentMax, currentLabel: '현재 조건', deltaAmount: delta })
  }

  const spouseHomes = HOME_COUNT[input.spouseHomeStatus ?? 'none']
  const selfHomes = HOME_COUNT[input.selfHomeStatus]
  const isPreRegistration =
    input.buyerType === 'couple' &&
    (input.marriageStatus === 'planned' || input.marriageStatus === 'undetermined')

  // 혼인신고 전 단독 명의 매수 시나리오 — 본인 소득·본인 주택만 인정
  const singleFin: UserFinance = {
    ...fin,
    isNewlywed: false,
    ownedHomes: selfHomes,
    income: input.incomeSelf > 0 ? input.incomeSelf : fin.income,
  }
  const singleIncomeCaution = input.incomeSelf > 0
    ? '단독 명의 시 본인 소득만 DSR에 인정됩니다 (입력하신 본인 연소득 기준으로 계산됨)'
    : '단독 명의 시 본인 소득만 DSR에 인정됩니다 — 재무 정보에서 소득을 개별 입력하면 더 정확하게 계산됩니다'

  // ── 1. 혼인신고 완료하기 — 신고 전 단독 매수와 신혼부부 자격 매수를 직접 비교 ──
  if (isPreRegistration && spouseHomes === 0) {
    const registeredMax = bestMaxPrice(selfFunds, { ...fin, isNewlywed: true }, zone)
    const singleMax = bestMaxPrice(selfFunds, singleFin, zone)
    if (registeredMax > singleMax) {
      suggestions.push({
        id: 'marriage-register',
        icon: '💍',
        title: '혼인신고 완료하고 신혼부부 자격으로 매수',
        currentMax: singleMax,
        currentLabel: '신고 전 단독 매수 시',
        variantMax: registeredMax,
        variantLabel: '혼인신고 후 부부합산',
        deltaAmount: registeredMax - singleMax,
        conclusion: '두 분 모두 무주택이므로 혼인신고 후 신혼부부 특례로 매수하는 쪽이 유리합니다',
        reasons: [
          '디딤돌 신혼특례: 금리 1.85~3.0%, 한도 3.2억 (혼인 7년 이내, 부부합산 8,500만원 이하)',
          '보금자리론 신혼특례: 소득한도 8,500만원으로 확대, 우대금리 최대 -1.0%p',
          '부부합산 소득으로 DSR 한도가 늘어나고, 신혼부부 특별공급(민영 20%·공공 30%) 청약 자격도 생깁니다',
        ],
        caution: input.incomeSelf > 0
          ? '혼인신고 시 배우자의 소득뿐 아니라 부채도 합산되어 심사됩니다'
          : '혼인신고 시 배우자의 부채도 합산 심사됩니다 · 신고 전 단독 매수 금액이 부부합산 소득으로 계산되어 실제보다 클 수 있어요 — 재무 정보에서 소득을 개별로 입력하면 비교가 정확해집니다',
      })
    }
  }

  // ── 2. 혼인신고 미루고 단독 명의 매수 — 배우자 유주택 시 무주택 자격 보존 ──
  if (isPreRegistration && spouseHomes > 0 && selfHomes === 0) {
    const variantMax = bestMaxPrice(selfFunds, singleFin, zone)
    push({
      id: 'marriage-delay',
      icon: '⏸️',
      title: '혼인신고 전 단독 명의로 먼저 매수',
      variantMax,
      variantLabel: '신고 전 단독 매수 시',
      conclusion: '배우자가 유주택이므로, 혼인신고 전 본인 단독 명의 매수가 유리할 수 있습니다',
      reasons: [
        '혼인신고로 세대가 합쳐지면 배우자 주택이 합산되어 무주택 자격(생애최초·정책대출·특별공급)을 잃습니다',
        '유주택 세대는 수도권·규제지역 추가 구입 주담대가 금지됩니다 — 신고 전 단독 매수 시 무주택 기준으로 심사',
        '단독 명의 매수 후 혼인신고를 하면 취득 시점 자격은 유지됩니다',
      ],
      caution: singleIncomeCaution,
    })
  }

  // ── 3. 신생아 특례 — 출산 계획이 있다면 최저 금리 대출 자격 ─────────────
  if (fin.numChildren === 0 && fin.ownedHomes === 0 && fin.income <= 20000) {
    const variantMax = bestMaxPrice(selfFunds, { ...fin, numChildren: 1 }, zone)
    push({
      id: 'newborn',
      icon: '👶',
      title: '출산 계획이 있다면 — 신생아 특례 대출',
      variantMax,
      variantLabel: '출산 후 신생아 특례',
      conclusion: '출산·입양 시 신생아 특례 대출(금리 1.6~3.3%)로 구매력이 크게 늘어납니다',
      reasons: [
        '2023.1.1 이후 출생·입양 자녀가 있으면 신청 가능 — 부부합산 연소득 2억까지 허용',
        '한도 5억, 주택가격 9억 이하 — 특례금리 5년 (추가 출산 시 연장, 최장 15년)',
        '금리가 일반 주담대(4~6%)의 절반 이하라 같은 소득으로 DSR 한도가 크게 늘어납니다',
      ],
      caution: '대출 신청 시점에 출생·입양이 완료되어 있어야 하며, 자산 심사(5.11억 이하)가 있습니다',
    })
  }

  // ── 4. 기존 대출 정리 — DSR 여유 확보 ──────────────────────────────────
  if (fin.existingLoanPayment > 0) {
    const variantMax = bestMaxPrice(selfFunds, { ...fin, existingLoanPayment: 0 }, zone)
    push({
      id: 'repay-loan',
      icon: '💳',
      title: `기존 대출 정리 (월 ${fin.existingLoanPayment.toLocaleString()}만원 상환 중)`,
      variantMax,
      variantLabel: '기존 대출 정리 후',
      conclusion: '기존 대출을 정리하면 DSR 여유가 생겨 주담대 한도가 늘어납니다',
      reasons: [
        'DSR 40%는 모든 대출의 원리금을 합산합니다 — 신용대출·카드론이 주담대 한도를 직접 깎습니다',
        `현재 월 ${fin.existingLoanPayment.toLocaleString()}만원 상환분이 사라지면 그만큼 주담대 상환 여력으로 인정됩니다`,
        '자기자본을 헐어 갚더라도, 금리가 높은 신용대출부터 정리하는 것이 유리한 경우가 많습니다',
      ],
      caution: '자기자본으로 대출을 갚으면 그만큼 자기자본이 줄어듭니다 — 아래 수치는 자기자본 유지 가정입니다',
    })
  }

  // ── 5. 생애최초 체크 확인 — 입력 누락 안내 ─────────────────────────────
  if (!fin.isFirstBuyer && fin.ownedHomes === 0) {
    const variantMax = bestMaxPrice(selfFunds, { ...fin, isFirstBuyer: true }, zone)
    push({
      id: 'first-buyer-check',
      icon: '🏠',
      title: '생애최초에 해당하는지 확인해보세요',
      variantMax,
      variantLabel: '생애최초 적용 시',
      conclusion: '세대원 전원이 주택을 소유한 적이 없다면 생애최초 혜택을 받을 수 있습니다',
      reasons: [
        '생애최초 LTV 우대: 수도권·규제지역 70%, 지방 80% (일반 대비 상향, 한도 6억)',
        '디딤돌 대출(생애최초) 자격 — 금리 2.45~3.3%',
        '취득세 감면 최대 200만원',
      ],
      caution: '과거 한 번이라도 주택(분양권·조합원입주권 포함)을 소유했다면 해당되지 않습니다',
    })
  }

  // ── 6. 규제지역 → 수도권 비규제 — 생활권을 크게 벗어나지 않는 현실적 대안 ──
  if (zone === 'tohe' || zone === 'overheat' || zone === 'regulated') {
    const variantMax = bestMaxPrice(selfFunds, fin, 'metro')
    push({
      id: 'region-metro',
      icon: '🚈',
      title: '수도권 비규제 지역(인천·경기 외곽)까지 넓혀보기',
      variantMax,
      variantLabel: '수도권 비규제 매수 시',
      conclusion: '규제지역을 벗어난 수도권 매물은 LTV가 완화되어 같은 조건으로 예산이 늘어납니다',
      reasons: [
        '규제지역 LTV 40%(일반 기준)가 비규제 수도권에서는 70%로 완화됩니다',
        zone === 'tohe'
          ? '토지거래허가제(실거주 2년 의무·허가 절차)도 적용되지 않습니다'
          : '투기과열지구 청약·재당첨 제한도 적용되지 않습니다',
        '단, 수도권 공통 규제(스트레스DSR +3.0%p, 주담대 절대한도)는 동일하게 적용됩니다',
      ],
      caution: '인천·고양·부천 등 수도권 비규제 시·군 기준 — 통근·생활권을 함께 고려하세요',
    })
  }

  // ── 7. 관심 지역 규제 영향 — 비규제 지방까지 넓히면 ─────────────────────
  if (zone !== 'none') {
    const variantMax = bestMaxPrice(selfFunds, fin, 'none')
    push({
      id: 'region-widen',
      icon: '🗺️',
      title: '비규제 지역 매물까지 넓혀보기',
      variantMax,
      variantLabel: '비규제 지역 매수 시',
      conclusion: '수도권·규제지역 밖 매물은 대출 규제가 완화되어 같은 조건으로 더 비싼 집을 살 수 있습니다',
      reasons: [
        '비수도권은 스트레스DSR 가산이 +0.75%p로 낮아(수도권 +3.0%p) DSR 한도가 늘어납니다',
        '10·15 대책 주담대 절대한도(15억 이하 6억 등)가 적용되지 않습니다',
        zone === 'tohe'
          ? '서울은 토지거래허가제(실거주 2년 의무)까지 적용 중입니다'
          : '유주택자 추가 구입 금지 규제도 비수도권에서는 LTV 60%로 완화됩니다',
      ],
      caution: '직주근접·생활권을 포기하면서까지 권하는 것은 아닙니다 — 예산 여력 비교용 참고 수치입니다',
    })
  }

  return suggestions.sort((a, b) => b.deltaAmount - a.deltaAmount)
}
