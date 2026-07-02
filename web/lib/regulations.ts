// ================================================================
// 부동산 규정 데이터 — 단일 진실 공급원 (Single Source of Truth)
//
// ★ 규정 변경 시 이 파일만 수정하면 사이트 전체에 자동 반영됩니다 ★
//
// 마지막 검토: 2025년 상반기 기준
// 출처: 국토교통부, 주택도시기금, HF 한국주택금융공사, 금융위원회
// ================================================================

// ─── DSR (총부채원리금상환비율) ─────────────────────────────────────────────
// 근거: 금융위원회 가계부채관리방안 (스트레스DSR 3단계 2025년 시행)
export const DSR = {
  bankRate: 0.40,        // 은행권 40%
  nonBankRate: 0.50,     // 비은행(저축은행·보험 등) 50%
  stressBuffer: 0.015,   // 스트레스DSR 가산 금리 (현행 1.5%p, 지역별 차등 적용)
  lastUpdated: '2025-07-01',
} as const

// ─── 규제지역 목록 ────────────────────────────────────────────────────────────
// 근거: 국토교통부 고시 (수시 변경 — 변경 시 여기만 수정)
export const ZONE_LISTS = {
  // 토지거래허가구역 — 실거주 2년 의무, 구청 사전허가 필수
  // 2024년 재지정 (강남3구 + 용산구 토허제 적용)
  tohe: ['강남구', '서초구', '송파구', '용산구'],

  // 투기과열지구 — LTV 50%(생애최초 9억 이하 80% 예외), 청약 1순위 제한
  // 2024년 기준: 강남·서초·송파·용산 4개구 유지
  overheat: ['강남구', '서초구', '송파구', '용산구'],

  // 조정대상지역 — LTV 60%(9억 초과 50%), 다주택 양도세 중과
  // 2023년 1월 전면 해제 → 현재 서울 내 해당 없음
  regulated: [] as string[],

  lastUpdated: '2025-01-01',
} as const

// ─── LTV (담보인정비율) 한도 ──────────────────────────────────────────────────
// 근거: 금융위원회·금감원 LTV 규제 기준 (2024 개정)
export const LTV = {
  overheat: {
    general: 0.50,
    firstBuyer: 0.80,
    firstBuyerPriceCap: 90000,   // 생애최초 80% 적용 상한: 9억 (만원)
  },
  regulated: {
    general: 0.60,
    above9: 0.50,                // 9억 초과 시
    priceBound: 90000,
    firstBuyer: 0.80,
  },
  none: {
    general: 0.70,
    firstBuyer: 0.80,
  },
  lastUpdated: '2024-09-01',
} as const

// ─── 정책 대출 상품 ──────────────────────────────────────────────────────────
// 근거: 주택도시기금 (https://nhuf.molit.go.kr), HF 한국주택금융공사

export const LOAN_PRODUCTS = {

  /** 디딤돌 대출 — 신혼부부·생애최초 (주택도시기금) */
  didimdolSpecial: {
    name: '디딤돌 대출',
    subName: '신혼부부·생애최초',
    provider: '주택도시기금',
    conditions: {
      maxIncome: 8500,         // 부부합산 연소득 (만원) — 신혼부부
      maxPrice: 50000,          // 주택가격 한도 (만원) — 5억 (전용 85㎡ 이하)
      maxLoan: 40000,           // 대출 한도 (만원) — 4억
      ltv: 0.80,
      requireNewlywed: true,    // 혼인 7년 이내 (예비신혼부부 포함)
      requireFirstBuyer: true,
    },
    rates: { min: 2.15, max: 3.00, representative: 2.15 },
    rateRange: '2.15 ~ 3.0%',
    term: 30,
    effectiveDate: '2024-03-01',
    notes: [
      '혼인 7년 이내 또는 예비신혼부부',
      '전용 85㎡ 이하 (읍·면지역 100㎡ 이하)',
      '무주택 세대주 요건 충족 시',
      '생애최초 시 취득세 감면 동시 적용 가능',
    ],
  },

  /** 디딤돌 대출 — 일반 생애최초 (주택도시기금) */
  didimdolGeneral: {
    name: '디딤돌 대출',
    subName: '생애최초',
    provider: '주택도시기금',
    conditions: {
      maxIncome: 6000,
      maxPrice: 50000,
      maxLoan: 25000,           // 2.5억
      ltv: 0.70,
      requireFirstBuyer: true,
    },
    rates: { min: 2.45, max: 3.30, representative: 2.65 },
    rateRange: '2.45 ~ 3.3%',
    term: 30,
    effectiveDate: '2024-03-01',
    notes: [
      '생애최초 주택 구입 (부부 모두 무주택)',
      '전용 85㎡ 이하',
      '부부합산 연소득 6천만원 이하',
    ],
  },

  /** 신생아 특례 대출 (주택도시기금) */
  newbornSpecial: {
    name: '신생아 특례 대출',
    subName: '출산·입양 가구',
    provider: '주택도시기금',
    conditions: {
      maxIncome: 20000,         // 부부합산 연소득 2억 (2024년 확대)
      maxPrice: 90000,           // 9억
      maxLoanAmount: 50000,      // 5억
      ltvFirstBuyer: 0.80,
      ltvGeneral: 0.70,
      requireChild: true,        // 2023.1.1 이후 출생·입양 자녀
    },
    rates: { min: 1.60, max: 3.30, representative: 1.60 },
    rateRange: '1.6 ~ 3.3%',
    term: 30,
    effectiveDate: '2024-01-29',
    notes: [
      '2023년 1월 1일 이후 출생·입양 자녀 있는 가구',
      '부부합산 연소득 2억 이하 (2024년 확대)',
      '주택가격 9억 이하',
      '특례 금리 5년 적용 후 일반금리 전환',
    ],
  },

  /** 보금자리론 (HF 한국주택금융공사) */
  bogumjari: {
    name: '보금자리론',
    subName: '고정금리 장기대출',
    provider: 'HF 한국주택금융공사',
    conditions: {
      maxIncomeGeneral: 7000,
      maxIncomeNewlywed: 8500,
      maxPrice: 60000,           // 6억
      maxLoan: 36000,            // 3.6억
      maxNetAsset: 46900,        // 4.69억 (순자산 한도)
      ltv: 0.70,
    },
    rates: {
      general: { representative: 3.95, range: '3.95 ~ 4.5%' },
      newlywed: { representative: 3.20, range: '2.4 ~ 3.95%' },
    },
    term: 30,
    effectiveDate: '2024-01-01',
    notes: [
      '전용 85㎡ 이하 주택 (수도권·특광역시는 같음)',
      '순자산 4.69억 이하 (금융부채 차감 후)',
      '고정금리 (변동금리 없음)',
      '신혼부부 우대금리 별도 적용',
    ],
  },

  /** 일반 주담대 (시중은행) */
  general: {
    name: '일반 주담대',
    subName: '시중은행',
    provider: '시중은행',
    conditions: {
      // DSR·LTV 규제지역 기준 적용
    },
    rates: { min: 3.50, max: 6.00, representative: 5.00 },
    rateRange: '연 3.5 ~ 6%',
    term: 30,
    notes: [
      'DSR 40%(은행권) 이내',
      '규제지역 LTV 적용',
      '신용도·금리에 따라 차이 큼',
    ],
  },
} as const

// ─── 취득세 (지방세법 제11조) ─────────────────────────────────────────────────
// 1주택 기준 (다주택은 별도 중과)
export const ACQUISITION_TAX = {
  // 1주택 일반 세율
  brackets1house: [
    { maxPrice: 60000,    rate: 0.01,    label: '6억 이하 1%' },
    { maxPrice: 90000,    rate: null,    label: '6억~9억 구간세율', formula: '취득가액(억) × 2/3 − 3 (%)' },
    { maxPrice: Infinity, rate: 0.03,    label: '9억 초과 3%' },
  ],
  // 다주택 중과 (조정대상지역)
  multiHouseRegulated: {
    house2: 0.08,    // 2주택 8%
    house3plus: 0.12, // 3주택+ 12%
  },
  // 생애최초 취득세 감면
  firstBuyerDiscount: {
    maxAmount: 200,    // 만원 — 생애최초 200만원 한도 감면
    priceLimit: 150000, // 15억 이하 주택에만 적용
    label: '생애최초 주택 취득세 감면',
  },
  // 부가세
  localEduTaxRate: 0.20,    // 지방교육세 = 취득세 × 20%
  ruralSpecialTaxNote: '농어촌특별세 취득세의 10% 별도 발생 가능 (전용 85㎡ 초과)',
  effectiveDate: '2022-06-21',
} as const

// ─── 중개수수료 (공인중개사법 시행규칙 별표1) ────────────────────────────────
// 매매 기준 (전세·월세는 별도)
export const BROKER_FEE = {
  brackets: [
    { maxPrice: 20000,    rate: 0.005, label: '2억 미만 0.5%' },
    { maxPrice: 60000,    rate: 0.004, label: '2억~6억 0.4%' },
    { maxPrice: 120000,   rate: 0.005, label: '6억~12억 0.5%' },
    { maxPrice: 150000,   rate: 0.006, label: '12억~15억 0.6%' },
    { maxPrice: Infinity, rate: 0.007, label: '15억 이상 0.7%' },
  ],
  maxRate: 0.009,          // 상한 0.9% (협의에 따라 낮출 수 있음)
  vatRate: 0.10,           // 부가세 10% 별도
  effectiveDate: '2021-10-19',
} as const

// ─── 양도소득세 ──────────────────────────────────────────────────────────────
// 1주택 비과세 요건 및 세율 개요
export const CAPITAL_GAINS_TAX = {
  exempt1house: {
    holdingYears: 2,       // 2년 이상 보유
    residenceYears: 0,     // 비조정 지역 거주 요건 없음
    residenceYearsRegulated: 2, // 조정대상지역 추가 2년 거주
    priceLimit: 1200000,   // 12억 이하 전액 비과세
    note: '12억 초과분은 과세 (고가주택 기준)',
  },
  // 단기 보유 세율 (기타 일반세율 6~45%)
  shortTermRates: [
    { holdingMonths: 12, rate: 0.70, label: '1년 미만 70%' },
    { holdingMonths: 24, rate: 0.60, label: '1~2년 60%' },
  ],
  // 다주택 중과 (조정대상지역)
  multiHouseSurcharge: {
    house2: 0.20,    // 기본세율 + 20%p
    house3plus: 0.30, // 기본세율 + 30%p
    note: '조정대상지역 다주택 중과 (현재 비적용 구간 많음)',
  },
  effectiveDate: '2023-01-01',
} as const

// ─── 청약 규제 ────────────────────────────────────────────────────────────────
export const SUBSCRIPTION = {
  overheatRestrictions: [
    '세대주만 1순위 청약 가능',
    '무주택 또는 1주택 세대원 (1주택자는 처분 조건)',
    '5년 이내 당첨 이력 있으면 1순위 제한',
    '재당첨 제한 10년',
  ],
  firstBuyerBenefits: [
    '민영주택 생애최초 특별공급 (20% 물량)',
    '공공주택 생애최초 특별공급 (25% 물량)',
    '청약저축 납입 횟수 요건 완화',
  ],
  newlywedBenefits: [
    '신혼부부 특별공급 (민영 20%, 공공 30% 물량)',
    '혼인 7년 이내 또는 예비신혼부부',
    '자녀 수에 따른 우선 배정',
  ],
  lastUpdated: '2024-06-01',
} as const

// ─── 토지거래허가구역 규정 ────────────────────────────────────────────────────
export const TOHE_RULES = {
  label: '토지거래허가구역',
  obligations: [
    '실거주 의무 2년 (주거용 취득 시)',
    '구청 토지거래허가 사전 취득 (계약 전)',
    '전세 세입자 있는 주택 매수 불가',
    '임대 목적 취득 불가',
  ],
  penalty: '허가 없이 계약 시 무효 + 형사처벌 대상',
  lastUpdated: '2024-09-01',
} as const
