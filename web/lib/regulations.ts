// ================================================================
// 부동산 규정 데이터 — 단일 진실 공급원 (Single Source of Truth)
//
// ★ 규정 변경 시 이 파일만 수정하면 사이트 전체에 자동 반영됩니다 ★
//
// 마지막 검토: 2026년 7월 기준
// 근거: 2025.10.15 「주택시장 안정화 대책(10·15 부동산 대책)」
//       국토교통부, 주택도시기금, HF 한국주택금융공사, 금융위원회
// ================================================================

// ─── DSR (총부채원리금상환비율) ─────────────────────────────────────────────
// 근거: 금융위원회 스트레스DSR 3단계 (2025.7.1 전국 시행)
export const DSR = {
  bankRate: 0.40,        // 은행권 40%
  nonBankRate: 0.50,     // 비은행(저축은행·보험 등) 50%
  stressBuffer: {
    // 스트레스DSR 3단계 — 실금리에 가산해 DSR 계산 (대출 한도 감소 효과)
    regulated: 0.030,    // 수도권·규제지역 주담대 +3.0%p (투기과열지구·조정대상)
    nonRegulated: 0.0075, // 비규제 지방 +0.75%p
  },
  lastUpdated: '2026-07-01',
  source: '금융위원회 스트레스DSR 3단계 시행 (2025.7)',
} as const

// ─── 규제지역 목록 ────────────────────────────────────────────────────────────
// 근거: 2025.10.15 「10·15 주택시장 안정화 대책」
//   서울 25개 자치구 전역 — 투기과열지구 + 조정대상지역 + 토허제 삼중 규제
//   효력 발생: 토허제 2025.10.20, 투기과열/조정 2025.10.22
//   토허제 유효기간: 2026.12.31까지

// 서울 25개 자치구 (전체)
const SEOUL_25 = [
  '강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구',
  '노원구', '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구',
  '성동구', '성북구', '송파구', '양천구', '영등포구', '용산구', '은평구',
  '종로구', '중구', '중랑구',
] as const

// 경기도 12개 지역 (투기과열지구 + 조정대상지역)
const GYEONGGI_12 = [
  '과천시', '광명시',
  '분당구', '수정구', '중원구',      // 성남시 3개 구
  '영통구', '장안구', '팔달구',      // 수원시 3개 구
  '동안구',                           // 안양시
  '수지구',                           // 용인시
  '의왕시', '하남시',
] as const

export const ZONE_LISTS = {
  SEOUL_25,
  GYEONGGI_12,

  // 토지거래허가구역 — 서울 25개구 전역 + 경기 일부 (2025.10.20~2026.12.31)
  tohe: SEOUL_25,

  // 투기과열지구 — 서울 25개구 전역 + 경기 12개 지역
  overheat: [...SEOUL_25, ...GYEONGGI_12] as readonly string[],

  // 조정대상지역 — 서울 25개구 전역 + 경기 12개 지역 (투기과열과 동일)
  regulated: [...SEOUL_25, ...GYEONGGI_12] as readonly string[],

  lastUpdated: '2026-07-01',
  source: '2025.10.15 「10·15 주택시장 안정화 대책」',
} as const

// ─── 대출 절대금액 한도 (10·15 대책 — 수도권·규제지역) ──────────────────────
// 기존 LTV% 외 절대금액 상한 추가 적용 (둘 중 더 엄격한 기준)
export const LOAN_AMOUNT_CAPS = {
  // 시가 기준 (만원)
  brackets: [
    { maxPrice: 150000, maxLoan: 60000, label: '15억 이하 → 대출 최대 6억' },
    { maxPrice: 250000, maxLoan: 40000, label: '15억~25억 → 대출 최대 4억' },
    { maxPrice: Infinity, maxLoan: 20000, label: '25억 초과 → 대출 최대 2억' },
  ],
  appliesTo: '수도권·규제지역 (투기과열지구·조정대상지역)',
  lastUpdated: '2025-10-22',
  source: '2025.10.15 「10·15 주택시장 안정화 대책」',
} as const

// ─── LTV (담보인정비율) ────────────────────────────────────────────────────────
// 근거: 금융위원회·금감원 LTV 규제 + 10·15 대책 적용
export const LTV = {
  // 투기과열지구 (서울 전역 + 경기 12개) — LOAN_AMOUNT_CAPS와 병산 적용
  overheat: {
    general: 0.40,               // 일반 40%
    firstBuyer: 0.80,            // 생애최초 80% (9억 이하 주택)
    firstBuyerPriceCap: 90000,   // 9억 (만원) 초과 시 생애최초 특례 미적용
  },
  // 조정대상지역 (서울·경기 규제지역은 이미 투기과열지구이므로 참고용)
  regulated: {
    general: 0.50,
    above9: 0.40,
    priceBound: 90000,
    firstBuyer: 0.80,
  },
  // 비규제지역
  none: {
    general: 0.70,
    firstBuyer: 0.80,
  },
  lastUpdated: '2026-07-01',
} as const

// ─── 정책 대출 상품 ──────────────────────────────────────────────────────────
// 근거: 주택도시기금, HF 한국주택금융공사 (2026.6.1 공시 기준)

export const LOAN_PRODUCTS = {

  /**
   * 디딤돌 대출 — 신혼부부·생애최초 (주택도시기금)
   * 한도 변경: 4억 → 3.2억 (2025.6.27 이후 계약 기준)
   */
  didimdolSpecial: {
    name: '디딤돌 대출',
    subName: '신혼부부·생애최초',
    provider: '주택도시기금',
    conditions: {
      maxIncome: 8500,         // 부부합산 연소득 (만원)
      maxPrice: 60000,          // 주택가격 한도 (만원) — 신혼·2자녀 6억
      maxLoan: 32000,           // 대출 한도 (만원) — 3.2억 (2025.6.27~)
      ltv: 0.80,
      requireNewlywed: true,
      requireFirstBuyer: true,
    },
    rates: { min: 1.85, max: 3.00, representative: 2.15 },
    rateRange: '1.85 ~ 3.0%',
    term: 30,
    effectiveDate: '2025-06-27',
    notes: [
      '혼인 7년 이내 또는 예비신혼부부',
      '전용 85㎡ 이하 (읍·면 100㎡ 이하)',
      '주택가격 6억 이하 (신혼·2자녀 이상)',
      '한도 3.2억 (2025.6.27 이후 계약 적용)',
      '정책 대출 — 스트레스DSR 가산 별도 적용',
    ],
  },

  /**
   * 디딤돌 대출 — 일반 생애최초 (주택도시기금)
   * 한도 변경: 2.5억 → 2억 (2025.6.27 이후 계약 기준)
   */
  didimdolGeneral: {
    name: '디딤돌 대출',
    subName: '생애최초',
    provider: '주택도시기금',
    conditions: {
      maxIncome: 6000,
      maxPrice: 50000,          // 5억
      maxLoan: 20000,           // 2억 (2025.6.27~, 기존 2.5억)
      ltv: 0.70,
      requireFirstBuyer: true,
    },
    rates: { min: 2.45, max: 3.30, representative: 2.65 },
    rateRange: '2.45 ~ 3.3%',
    term: 30,
    effectiveDate: '2025-06-27',
    notes: [
      '생애최초 주택 구입 (부부 모두 무주택)',
      '전용 85㎡ 이하',
      '부부합산 연소득 6천만원 이하',
      '한도 2억 (2025.6.27 이후 계약 적용)',
    ],
  },

  /**
   * 신생아 특례 대출 (주택도시기금)
   * 2024.1.29 시행 — 2026년 조건 유지
   */
  newbornSpecial: {
    name: '신생아 특례 대출',
    subName: '2년 내 출산·입양 가구',
    provider: '주택도시기금',
    conditions: {
      maxIncome: 20000,         // 부부합산 연소득 2억
      maxPrice: 90000,           // 9억
      maxLoanAmount: 50000,      // 5억
      assetLimit: 51100,         // 자산 5.11억 이하 (2026 기준)
      ltvFirstBuyer: 0.80,
      ltvGeneral: 0.70,
      requireChild: true,        // 2023.1.1 이후 출생·입양
    },
    rates: { min: 1.60, max: 3.30, representative: 1.60 },
    rateRange: '1.6 ~ 3.3%',
    specialRateYears: 5,          // 특례금리 5년 적용 (추가 출산 시 5년 연장, 최장 15년)
    afterSpecialRateAdd: 0.0075, // 특례 종료 후 +0.75%p (2026.6.22 기준)
    term: 30,
    effectiveDate: '2024-01-29',
    notes: [
      '2023년 1월 1일 이후 출생·입양 자녀 있는 가구',
      '부부합산 연소득 2억 이하',
      '주택가격 9억 이하',
      '자산 심사 기준 5.11억 이하',
      '특례금리 5년 후 일반금리 전환 (+0.75%p)',
    ],
  },

  /**
   * 보금자리론 (HF 한국주택금융공사)
   * 2026.1.1 금리 0.25%p 인상
   */
  bogumjari: {
    name: '보금자리론',
    subName: '고정금리 장기대출',
    provider: 'HF 한국주택금융공사',
    conditions: {
      maxIncomeGeneral: 7000,
      maxIncomeNewlywed: 8500,
      maxPrice: 60000,           // 6억
      maxLoan: 36000,            // 3.6억
      maxNetAsset: 46900,        // 순자산 4.69억 이하
      ltv: 0.70,
    },
    rates: {
      // 아낌e-보금자리론 기준 (2026.1.1 인상 적용)
      general: {
        representative: 4.05,
        range: '3.90 ~ 4.20%',
        byTerm: { y10: 3.90, y15: 3.95, y20: 4.00, y30: 4.10, y40: 4.15, y50: 4.20 },
      },
      newlywed: {
        representative: 3.20,
        range: '2.90 ~ 3.45%',
        note: '신혼·사회적배려층 우대금리 최대 -1.0%p',
      },
    },
    term: 30,
    effectiveDate: '2026-01-01',
    notes: [
      '전용 85㎡ 이하 주택',
      '순자산 4.69억 이하 (금융부채 차감 후)',
      '고정금리 (변동금리 없음)',
      '2026년 1월 금리 0.25%p 인상',
      '신혼·청년·사회적배려층 우대 최대 1.0%p',
    ],
  },

  /** 일반 주담대 (시중은행) */
  general: {
    name: '일반 주담대',
    subName: '시중은행',
    provider: '시중은행',
    conditions: {},
    rates: { min: 3.50, max: 6.00, representative: 5.00 },
    rateRange: '연 3.5 ~ 6%',
    term: 30,
    notes: [
      'DSR 40%(은행권) 이내 + 스트레스DSR 3.0%p 가산 (수도권·규제지역)',
      '규제지역 LTV 40% + 절대금액 한도 적용 (10·15 대책)',
      '신용도·금리에 따라 한도 차이 큼',
    ],
  },
} as const

// ─── 취득세 (지방세법 제11조) — 1주택 기준 ────────────────────────────────────
export const ACQUISITION_TAX = {
  brackets1house: [
    { maxPrice: 60000,    rate: 0.01,   label: '6억 이하 1%' },
    { maxPrice: 90000,    rate: null,   label: '6억~9억 구간세율', formula: '취득가액(억) × 2/3 − 3 (%)' },
    { maxPrice: Infinity, rate: 0.03,   label: '9억 초과 3%' },
  ],
  multiHouseRegulated: {
    house2: 0.08,
    house3plus: 0.12,
    note: '조정대상지역 2주택 8%, 3주택+ 12% (서울 전역 해당)',
  },
  firstBuyerDiscount: {
    maxAmount: 200,
    priceLimit: 150000,
    label: '생애최초 주택 취득세 감면 (최대 200만원)',
  },
  localEduTaxRate: 0.20,
  ruralSpecialTaxNote: '농어촌특별세: 취득세의 10% (전용 85㎡ 초과 시 별도)',
  effectiveDate: '2022-06-21',
} as const

// ─── 중개수수료 (공인중개사법 시행규칙 별표1) ────────────────────────────────
export const BROKER_FEE = {
  brackets: [
    { maxPrice: 20000,    rate: 0.005, label: '2억 미만 0.5%' },
    { maxPrice: 60000,    rate: 0.004, label: '2억~6억 0.4%' },
    { maxPrice: 120000,   rate: 0.005, label: '6억~12억 0.5%' },
    { maxPrice: 150000,   rate: 0.006, label: '12억~15억 0.6%' },
    { maxPrice: Infinity, rate: 0.007, label: '15억 이상 0.7%' },
  ],
  vatRate: 0.10,
  effectiveDate: '2021-10-19',
} as const

// ─── 양도소득세 ──────────────────────────────────────────────────────────────
export const CAPITAL_GAINS_TAX = {
  exempt1house: {
    holdingYears: 2,
    priceLimit: 1200000,             // 12억 이하 전액 비과세
    regulated: { residenceYears: 2 }, // 조정대상지역 추가 2년 거주 (현재 서울 전역 해당)
  },
  shortTermRates: [
    { holdingMonths: 12, rate: 0.70, label: '1년 미만 70%' },
    { holdingMonths: 24, rate: 0.60, label: '1~2년 60%' },
  ],
  multiHouseSurcharge: {
    house2: 0.20,    // 조정대상지역 2주택: 기본세율 + 20%p (서울 전역 해당)
    house3plus: 0.30,
  },
  effectiveDate: '2023-01-01',
} as const

// ─── 청약 규제 ────────────────────────────────────────────────────────────────
export const SUBSCRIPTION = {
  overheatRestrictions: [
    '세대주만 1순위 청약 가능',
    '무주택 또는 1주택 (처분 조건)',
    '5년 이내 당첨 이력 있으면 1순위 제한',
    '재당첨 제한 10년',
    '서울 전역 투기과열지구 해당 (2025.10~ )',
  ],
  firstBuyerBenefits: [
    '민영주택 생애최초 특별공급 (20% 물량)',
    '공공주택 생애최초 특별공급 (25% 물량)',
    '청약저축 납입 횟수 요건 완화',
  ],
  newlywedBenefits: [
    '신혼부부 특별공급 (민영 20%, 공공 30% 물량)',
    '혼인 7년 이내 또는 예비신혼부부',
    '자녀 수 우선 배정',
  ],
  lastUpdated: '2026-07-01',
} as const

// ─── 토지거래허가구역 규정 ────────────────────────────────────────────────────
export const TOHE_RULES = {
  label: '토지거래허가구역',
  scope: '서울 25개 자치구 전역 (2025.10.20 ~ 2026.12.31)',
  obligations: [
    '실거주 의무 2년 (주거용 취득 시)',
    '구청 토지거래허가 사전 취득 (계약 전 필수)',
    '전세 세입자 있는 주택 매수 불가',
    '임대 목적 취득 불가',
  ],
  target: '대지지분 6㎡ 초과 아파트·연립·다세대·단독',
  penalty: '허가 없이 체결한 계약 효력 무효 + 형사처벌',
  lastUpdated: '2025-10-20',
  source: '2025.10.15 「10·15 주택시장 안정화 대책」',
} as const
