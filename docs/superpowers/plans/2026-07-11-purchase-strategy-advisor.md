# 주택구매 전략 추천 기능 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 신혼부부/커플/단독 매수자가 자신의 재무·가족 상황을 입력하면 (1) 혼인신고 시점, (2) 공동명의 vs 단독명의, (3) 경매/일반매매/청약 중 매수 방식을 자동으로 추천해주는 `/advisor` 페이지를 만들고, 정책 변경을 감지해 관리자에게 규정 업데이트를 제안하는 파이프라인을 추가한다.

**Architecture:** `web/lib/advisor/*`에 순수 함수 기반 추천 엔진(결정론적, `koreanRealEstate.ts` 스타일)을 만들고, `user_preferences`에 매수 형태·혼인 상태·주택보유현황 필드를 추가한다. `/advisor` 서버 컴포넌트가 이 데이터를 읽어 엔진을 실행하고 추천 카드 + 상세 비교표를 렌더링한다. 정책 감지는 기존 파이프라인의 '정책' 카테고리 분류 결과를 재사용해 Claude로 규정 변경 여부를 판단하고, DB에 제안(pending)으로 저장한 뒤 관리자 승인 UI에서 검토한다 (자동 코드 반영은 하지 않음 — git 버전관리 유지).

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase (Postgres + PostgREST), vitest, Python 3.12 파이프라인 (anthropic SDK), Resend

## Global Constraints

- 스펙 문서: `docs/superpowers/specs/2026-07-11-purchase-strategy-advisor-design.md`
- `CREATE POLICY IF NOT EXISTS`는 PostgreSQL에 존재하지 않는 문법 — 절대 사용 금지. `DROP POLICY IF EXISTS` + `CREATE POLICY` 패턴만 사용.
- 모든 마이그레이션은 `ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS`로 안전하게 작성.
- 세율·공제 등 규정 수치를 다루는 코드에는 반드시 출처·최종검토일 주석을 남긴다 (`regulations.ts` 기존 스타일 참고).
- 신규 라이브러리 모듈은 순수 함수로 작성하고 `web/__tests__/`에 vitest로 테스트한다 (AAA 스타일, 기존 `koreanRealEstate.test.ts` 참고).
- 정책 업데이트는 감지 → DB 제안 저장 → 관리자 승인까지만 자동화하고, `regulations.ts` 실제 수정·커밋·배포는 사람이 수동으로 한다.
- 커밋은 태스크 단위로 작게, 한글 커밋 메시지도 무방 (기존 저장소 관례상 영어 conventional commit 사용 중이므로 영어로 통일).

---

## Phase 1 — 추천 엔진 + UI

### Task 1: DB 마이그레이션 — advisor 프로필 필드 추가

**Files:**
- Create: `supabase/migrations/011_advisor_fields.sql`

**Interfaces:**
- Produces: `user_preferences` 테이블에 `buyer_type`, `marriage_status`, `self_home_status`, `spouse_home_status`, `household_head`, `subscription_account_years` 컬럼

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- 011_advisor_fields.sql: 구매 전략 추천 기능용 프로필 필드 추가

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS buyer_type text NOT NULL DEFAULT 'solo'
    CHECK (buyer_type IN ('solo', 'couple')),
  ADD COLUMN IF NOT EXISTS marriage_status text
    CHECK (marriage_status IS NULL OR marriage_status IN ('registered', 'planned', 'undetermined')),
  ADD COLUMN IF NOT EXISTS self_home_status text NOT NULL DEFAULT 'none'
    CHECK (self_home_status IN ('none', 'one', 'multiple')),
  ADD COLUMN IF NOT EXISTS spouse_home_status text
    CHECK (spouse_home_status IS NULL OR spouse_home_status IN ('none', 'one', 'multiple')),
  ADD COLUMN IF NOT EXISTS household_head boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS subscription_account_years numeric NOT NULL DEFAULT 0;

-- 기존 신혼부부 사용자는 couple로 백필
UPDATE user_preferences SET buyer_type = 'couple' WHERE is_newlywed = true;
```

- [ ] **Step 2: Supabase SQL 에디터에서 실행**

사용자에게 위 SQL을 Supabase SQL 에디터에서 직접 실행하도록 안내한다 (이 프로젝트는 매 마이그레이션을 수동으로 적용해왔음 — 009/010번 참고).

- [ ] **Step 3: 반영 확인**

로그인 상태에서 `/api/preferences`에 직접 접속해 응답 JSON에 `buyer_type`, `marriage_status`, `self_home_status`, `spouse_home_status`, `household_head`, `subscription_account_years` 필드가 포함되는지 확인 (Task 12에서 API 라우트를 수정한 뒤에 확인 가능 — 지금은 컬럼 존재만 SQL 에디터의 `SELECT * FROM user_preferences LIMIT 1;`로 확인).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/011_advisor_fields.sql
git commit -m "feat: add advisor profile columns to user_preferences"
```

---

### Task 2: `regulations.ts`에 종합부동산세 데이터 추가

**Files:**
- Modify: `web/lib/regulations.ts` (파일 끝에 추가)
- Test: `web/__tests__/regulations.test.ts`

**Interfaces:**
- Produces: `PROPERTY_TAX` export (뒤 태스크의 `lib/advisor/propertyTax.ts`가 이 값을 가져다 씀)

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// web/__tests__/regulations.test.ts
import { describe, it, expect } from 'vitest'
import { PROPERTY_TAX } from '../lib/regulations'

describe('PROPERTY_TAX', () => {
  it('defines 1세대1주택 특례 공제 as 12억', () => {
    expect(PROPERTY_TAX.deduction.singleHouseSpecial).toBe(120000)
  })

  it('defines 인별과세 기본공제 as 9억', () => {
    expect(PROPERTY_TAX.deduction.perPerson).toBe(90000)
  })

  it('defines fair market value ratio as 60%', () => {
    expect(PROPERTY_TAX.fairMarketValueRatio).toBe(0.60)
  })

  it('general rate brackets are sorted ascending by maxBase', () => {
    const bases = PROPERTY_TAX.rates.general.map(b => b.maxBase)
    const sorted = [...bases].sort((a, b) => a - b)
    expect(bases).toEqual(sorted)
  })
})
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd web && npx vitest run __tests__/regulations.test.ts`
Expected: FAIL — `PROPERTY_TAX` is not exported

- [ ] **Step 3: `regulations.ts` 끝에 `PROPERTY_TAX` 블록 추가**

```typescript
// ─── 종합부동산세 (2023년 개정 세법 기준) ──────────────────────────────────
// 근거: 국세청 안내자료 교차검증 (기본공제 12억/9억, 세율 0.5~2.7%/0.5~5.0%,
//       세부담상한 150% 통일(2023 개정, 종전 다주택 300%))
// ⚠️ 2026.7월 말 예정된 세제개편안에서 공정시장가액비율 상향이 논의 중 —
//    이 값이 바뀌면 반드시 아래 fairMarketValueRatio를 갱신할 것
export const PROPERTY_TAX = {
  fairMarketValueRatio: 0.60,
  deduction: {
    singleHouseSpecial: 120000,   // 1세대1주택자 특례: 12억
    perPerson: 90000,             // 인별 과세 기본공제: 9억 (공동명의는 1인당)
  },
  jointOwnershipOption: {
    note: '부부 공동명의 1주택: 특례(12억, 세액공제 가능) vs 인별과세(9억×2=18억, 세액공제 불가) 중 유리한 쪽 선택 가능. 매년 9.16~9.30 신청.',
  },
  rates: {
    general: [ // 2주택 이하 — 과세표준(만원) 기준
      { maxBase: 30000, rate: 0.005 },
      { maxBase: 60000, rate: 0.007 },
      { maxBase: 120000, rate: 0.010 },
      { maxBase: 250000, rate: 0.013 },
      { maxBase: 500000, rate: 0.015 },
      { maxBase: 940000, rate: 0.020 },
      { maxBase: Infinity, rate: 0.027 },
    ],
    multiHouse3plus: [ // 3주택 이상 — 과세표준 12억까지는 general과 동일, 초과분부터 중과
      { maxBase: 120000, rate: 0.010 },
      { maxBase: 250000, rate: 0.020 },
      { maxBase: 500000, rate: 0.030 },
      { maxBase: 940000, rate: 0.040 },
      { maxBase: Infinity, rate: 0.050 },
    ],
  } as const,
  taxBurdenCap: 1.50, // 전년 대비 세부담 상한 — 주택 수 무관 150% (2023 개정)
  seniorLongTermDeduction: { maxRate: 0.80 },
  lastUpdated: '2026-07-01',
  source: '종합부동산세법 (2023년 개정 세법 기준) — 국세청 자료 교차검증 완료',
} as const
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `cd web && npx vitest run __tests__/regulations.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add web/lib/regulations.ts web/__tests__/regulations.test.ts
git commit -m "feat: add comprehensive property tax (종부세) regulation data"
```

---

### Task 3: `lib/advisor/types.ts` — 공유 타입 정의

**Files:**
- Create: `web/lib/advisor/types.ts`

**Interfaces:**
- Produces: `HomeStatus`, `BuyerType`, `MarriageStatus`, `AdvisorProfile`, `RecommendationCard`, `ComparisonRow`, `ComparisonTable` — 이후 모든 advisor 모듈이 이 타입을 사용

- [ ] **Step 1: 파일 작성**

```typescript
export type HomeStatus = 'none' | 'one' | 'multiple'
export type BuyerType = 'solo' | 'couple'
export type MarriageStatus = 'registered' | 'planned' | 'undetermined'

export interface AdvisorProfile {
  buyerType: BuyerType
  marriageStatus: MarriageStatus | null
  selfHomeStatus: HomeStatus
  spouseHomeStatus: HomeStatus | null
  householdHead: boolean
  subscriptionAccountYears: number
  noHomeYears: number
  numChildren: number
  income: number       // 부부합산 또는 본인 연소득 (만원)
  assets: number        // 만원
  budgetMax: number     // 목표 매매가 (만원)
  sigungu?: string | null
}

export interface RecommendationCard {
  id: string
  title: string
  conclusion: string
  reasons: string[]
}

export interface ComparisonRow {
  label: string
  values: Record<string, string>
}

export interface ComparisonTable {
  id: string
  title: string
  scenarioLabels: Record<string, string>
  rows: ComparisonRow[]
}
```

- [ ] **Step 2: 타입체크**

Run: `cd web && npx tsc --noEmit --pretty false lib/advisor/types.ts` (또는 프로젝트 전체 `npx tsc --noEmit`으로 에러 없는지 확인)
Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add web/lib/advisor/types.ts
git commit -m "feat: add shared types for purchase-strategy advisor"
```

---

### Task 4: `lib/advisor/propertyTax.ts` — 종부세 계산 모듈

**Files:**
- Create: `web/lib/advisor/propertyTax.ts`
- Test: `web/__tests__/advisor/propertyTax.test.ts`

**Interfaces:**
- Consumes: `PROPERTY_TAX` from `../regulations` (Task 2)
- Produces: `estimateOfficialPrice(marketPrice: number): number`, `calcPropertyTax(officialPriceTotal: number, deduction: number, houseCount?: 1|2|3): number`, `compareOwnershipPropertyTax(marketPrice: number, houseCount?: 1|2|3): OwnershipTaxComparison` — Task 6(`ownershipAdvisor.ts`)이 `compareOwnershipPropertyTax`를 사용

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// web/__tests__/advisor/propertyTax.test.ts
import { describe, it, expect } from 'vitest'
import { estimateOfficialPrice, calcPropertyTax, compareOwnershipPropertyTax } from '../../lib/advisor/propertyTax'

describe('estimateOfficialPrice', () => {
  it('estimates official price as 67% of market price', () => {
    expect(estimateOfficialPrice(100000)).toBe(67000)
  })
})

describe('calcPropertyTax', () => {
  it('returns 0 when base is below deduction', () => {
    expect(calcPropertyTax(100000, 120000)).toBe(0)
  })

  it('computes tax for official price 20억, sole ownership deduction 12억', () => {
    // base = (200000-120000)*0.6 = 48000 → 30000*0.5% + 18000*0.7% = 150+126 = 276
    expect(calcPropertyTax(200000, 120000)).toBe(276)
  })

  it('computes tax for official price 20억, joint individual deduction 18억', () => {
    // base = (200000-180000)*0.6 = 12000 → 12000*0.5% = 60
    expect(calcPropertyTax(200000, 180000)).toBe(60)
  })

  it('applies multi-house 3plus surcharge brackets above 12억 base', () => {
    const generalTax = calcPropertyTax(300000, 120000, 1)
    const multiHouseTax = calcPropertyTax(300000, 120000, 3)
    expect(multiHouseTax).toBeGreaterThan(generalTax)
  })
})

describe('compareOwnershipPropertyTax', () => {
  it('recommends jointIndividual when it yields lower tax', () => {
    const result = compareOwnershipPropertyTax(200000, 1)
    expect(result.recommended).toBe('jointIndividual')
    expect(result.savings).toBe(216)
  })

  it('both scenarios are 0 below both deduction thresholds', () => {
    const result = compareOwnershipPropertyTax(100000, 1)
    expect(result.soleOrSpecialOwnership.propertyTax).toBe(0)
    expect(result.jointIndividual.propertyTax).toBe(0)
  })
})
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd web && npx vitest run __tests__/advisor/propertyTax.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

```typescript
// web/lib/advisor/propertyTax.ts
import { PROPERTY_TAX } from '../regulations'

function progressiveTax(base: number, brackets: readonly { maxBase: number; rate: number }[]): number {
  let tax = 0
  let prev = 0
  for (const b of brackets) {
    if (base <= prev) break
    const taxableInBracket = Math.min(base, b.maxBase) - prev
    tax += taxableInBracket * b.rate
    prev = b.maxBase
  }
  return Math.round(tax)
}

/** 매매가 대비 공시가격 비율 추정치(65~70%의 중간값 67%)로 공시가격을 추정한다. */
export function estimateOfficialPrice(marketPrice: number): number {
  return Math.round(marketPrice * 0.67)
}

/** 공시가격 합계, 공제액, 보유주택수를 받아 종합부동산세를 계산한다 (만원 단위). */
export function calcPropertyTax(
  officialPriceTotal: number,
  deduction: number,
  houseCount: 1 | 2 | 3 = 1,
): number {
  const base = Math.max(0, (officialPriceTotal - deduction) * PROPERTY_TAX.fairMarketValueRatio)
  const brackets = houseCount >= 3 ? PROPERTY_TAX.rates.multiHouse3plus : PROPERTY_TAX.rates.general
  return progressiveTax(base, brackets)
}

export interface OwnershipTaxComparison {
  soleOrSpecialOwnership: { propertyTax: number; label: string }
  jointIndividual: { propertyTax: number; label: string }
  recommended: 'soleOrSpecial' | 'jointIndividual'
  savings: number
}

/**
 * 단독명의(또는 공동명의+1세대1주택자 특례, 12억 공제)와 공동명의 인별과세(9억×2=18억 공제)를
 * 비교한다. 고령자·장기보유 세액공제(최대 80%)는 반영하지 않은 보수적 추정치다.
 */
export function compareOwnershipPropertyTax(
  marketPrice: number,
  houseCount: 1 | 2 | 3 = 1,
): OwnershipTaxComparison {
  const officialPrice = estimateOfficialPrice(marketPrice)
  const soleTax = calcPropertyTax(officialPrice, PROPERTY_TAX.deduction.singleHouseSpecial, houseCount)
  const jointIndividualTax = calcPropertyTax(officialPrice, PROPERTY_TAX.deduction.perPerson * 2, houseCount)
  const recommended = jointIndividualTax <= soleTax ? 'jointIndividual' : 'soleOrSpecial'
  return {
    soleOrSpecialOwnership: { propertyTax: soleTax, label: '단독명의 (또는 공동명의 1세대1주택자 특례)' },
    jointIndividual: { propertyTax: jointIndividualTax, label: '공동명의 (인별과세)' },
    recommended,
    savings: Math.abs(soleTax - jointIndividualTax),
  }
}
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `cd web && npx vitest run __tests__/advisor/propertyTax.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add web/lib/advisor/propertyTax.ts web/__tests__/advisor/propertyTax.test.ts
git commit -m "feat: add property tax calculation module for ownership comparison"
```

---

### Task 5: `lib/advisor/subscriptionScore.ts` — 청약 가점 추정 모듈

**Files:**
- Create: `web/lib/advisor/subscriptionScore.ts`
- Test: `web/__tests__/advisor/subscriptionScore.test.ts`

**Interfaces:**
- Produces: `calcSubscriptionScore(noHomeYears: number, dependents: number, accountYears: number): SubscriptionScoreResult` — Task 8(`purchaseMethodAdvisor.ts`)과 Task 9(`index.ts`)가 사용

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// web/__tests__/advisor/subscriptionScore.test.ts
import { describe, it, expect } from 'vitest'
import { calcSubscriptionScore } from '../../lib/advisor/subscriptionScore'

describe('calcSubscriptionScore', () => {
  it('returns max 84 points at max eligibility (15+ years, 6+ dependents, 15+ account years)', () => {
    const result = calcSubscriptionScore(15, 6, 15)
    expect(result.total).toBe(84)
    expect(result.noHomeYearsScore).toBe(32)
    expect(result.dependentsScore).toBe(35)
    expect(result.accountPeriodScore).toBe(17)
  })

  it('returns minimum scores for a brand-new applicant', () => {
    const result = calcSubscriptionScore(0, 0, 0)
    expect(result.noHomeYearsScore).toBe(2)
    expect(result.dependentsScore).toBe(5)
    expect(result.accountPeriodScore).toBe(1)
    expect(result.total).toBe(8)
  })

  it('caps no-home-years score at 32 beyond 15 years', () => {
    expect(calcSubscriptionScore(20, 0, 0).noHomeYearsScore).toBe(32)
  })

  it('caps dependents score at 35 beyond 6 dependents', () => {
    expect(calcSubscriptionScore(0, 10, 0).dependentsScore).toBe(35)
  })
})
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd web && npx vitest run __tests__/advisor/subscriptionScore.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

```typescript
// web/lib/advisor/subscriptionScore.ts
// 근거: 주택공급에 관한 규칙 — 청약가점제 (무주택기간 32점 + 부양가족수 35점 + 청약통장가입기간 17점 = 84점)

export function calcNoHomeYearsScore(years: number): number {
  if (years >= 15) return 32
  return Math.min(32, 2 * (Math.floor(Math.max(0, years)) + 1))
}

export function calcDependentsScore(dependents: number): number {
  return Math.min(35, 5 + Math.max(0, dependents) * 5)
}

export function calcAccountPeriodScore(years: number): number {
  if (years < 0.5) return 1
  if (years < 1) return 2
  return Math.min(17, Math.floor(years) + 2)
}

export interface SubscriptionScoreResult {
  noHomeYearsScore: number
  dependentsScore: number
  accountPeriodScore: number
  total: number
}

export function calcSubscriptionScore(
  noHomeYears: number,
  dependents: number,
  accountYears: number,
): SubscriptionScoreResult {
  const noHomeYearsScore = calcNoHomeYearsScore(noHomeYears)
  const dependentsScore = calcDependentsScore(dependents)
  const accountPeriodScore = calcAccountPeriodScore(accountYears)
  return {
    noHomeYearsScore,
    dependentsScore,
    accountPeriodScore,
    total: noHomeYearsScore + dependentsScore + accountPeriodScore,
  }
}
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `cd web && npx vitest run __tests__/advisor/subscriptionScore.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add web/lib/advisor/subscriptionScore.ts web/__tests__/advisor/subscriptionScore.test.ts
git commit -m "feat: add subscription (청약) score estimation module"
```

---

### Task 6: `lib/advisor/ownershipAdvisor.ts` — 명의 구성 추천

**Files:**
- Create: `web/lib/advisor/ownershipAdvisor.ts`
- Test: `web/__tests__/advisor/ownershipAdvisor.test.ts`

**Interfaces:**
- Consumes: `AdvisorProfile`, `RecommendationCard`, `ComparisonTable` (Task 3); `compareOwnershipPropertyTax` (Task 4)
- Produces: `recommendOwnership(profile: AdvisorProfile, price: number): OwnershipRecommendation | null` — Task 9(`index.ts`)가 사용

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// web/__tests__/advisor/ownershipAdvisor.test.ts
import { describe, it, expect } from 'vitest'
import { recommendOwnership } from '../../lib/advisor/ownershipAdvisor'
import type { AdvisorProfile } from '../../lib/advisor/types'

const baseProfile: AdvisorProfile = {
  buyerType: 'couple',
  marriageStatus: 'registered',
  selfHomeStatus: 'none',
  spouseHomeStatus: 'none',
  householdHead: true,
  subscriptionAccountYears: 5,
  noHomeYears: 5,
  numChildren: 0,
  income: 8000,
  assets: 30000,
  budgetMax: 200000,
}

describe('recommendOwnership', () => {
  it('returns null for solo buyers', () => {
    expect(recommendOwnership({ ...baseProfile, buyerType: 'solo' }, 200000)).toBeNull()
  })

  it('recommends joint ownership when it saves property tax', () => {
    const result = recommendOwnership(baseProfile, 200000)
    expect(result).not.toBeNull()
    expect(result!.card.conclusion).toContain('공동명의')
  })

  it('warns about first-buyer eligibility when a spouse already owns a home', () => {
    const result = recommendOwnership({ ...baseProfile, spouseHomeStatus: 'one' }, 200000)
    expect(result!.card.reasons.some(r => r.includes('생애최초'))).toBe(true)
  })

  it('includes a comparison table with both scenarios', () => {
    const result = recommendOwnership(baseProfile, 200000)
    expect(result!.table.rows.length).toBeGreaterThan(0)
    expect(Object.keys(result!.table.scenarioLabels)).toEqual(['sole', 'joint'])
  })
})
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd web && npx vitest run __tests__/advisor/ownershipAdvisor.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

```typescript
// web/lib/advisor/ownershipAdvisor.ts
import { compareOwnershipPropertyTax, type OwnershipTaxComparison } from './propertyTax'
import type { AdvisorProfile, RecommendationCard, ComparisonTable } from './types'

export interface OwnershipRecommendation {
  card: RecommendationCard
  table: ComparisonTable
  propertyTax: OwnershipTaxComparison
}

export function recommendOwnership(profile: AdvisorProfile, price: number): OwnershipRecommendation | null {
  if (profile.buyerType !== 'couple') return null

  const propertyTax = compareOwnershipPropertyTax(price, 1)
  const reasons: string[] = []
  const recommendedLabel = propertyTax.recommended === 'jointIndividual' ? '공동명의' : '단독명의'

  reasons.push(
    propertyTax.recommended === 'jointIndividual'
      ? `공동명의(인별과세) 시 종부세 공제가 1인당 9억씩 총 18억으로 단독명의(12억)보다 유리해, 연 ${propertyTax.savings.toLocaleString()}만원 절약 추정`
      : '두 방식의 종부세 차이가 크지 않아, 명의보다 대출 심사·향후 양도 계획을 우선 고려하세요'
  )
  if (profile.selfHomeStatus !== 'none' || profile.spouseHomeStatus !== 'none') {
    reasons.push('부부 중 한쪽이 이미 주택을 보유 중이면 공동명의 시 무주택인 배우자의 생애최초·무주택 세대주 자격에 영향이 갈 수 있어, 대출·청약 특례 조건을 함께 확인하세요')
  }
  reasons.push('고령자·장기보유 세액공제(최대 80%) 대상이라면 단독명의(특례)가 더 유리할 수 있습니다 — 이 비교는 세액공제를 반영하지 않은 보수적 추정치입니다')

  return {
    card: {
      id: 'ownership',
      title: '명의 구성',
      conclusion: `${recommendedLabel}가 유리할 가능성이 높습니다`,
      reasons,
    },
    table: {
      id: 'ownership-detail',
      title: '명의별 종합부동산세 비교 (추정)',
      scenarioLabels: { sole: '단독명의', joint: '공동명의(인별과세)' },
      rows: [
        {
          label: '예상 종부세 (연)',
          values: {
            sole: `${propertyTax.soleOrSpecialOwnership.propertyTax.toLocaleString()}만원`,
            joint: `${propertyTax.jointIndividual.propertyTax.toLocaleString()}만원`,
          },
        },
      ],
    },
    propertyTax,
  }
}
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `cd web && npx vitest run __tests__/advisor/ownershipAdvisor.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add web/lib/advisor/ownershipAdvisor.ts web/__tests__/advisor/ownershipAdvisor.test.ts
git commit -m "feat: add joint vs sole ownership recommendation module"
```

---

### Task 7: `lib/advisor/marriageTimingAdvisor.ts` — 혼인신고 시점 추천

**Files:**
- Create: `web/lib/advisor/marriageTimingAdvisor.ts`
- Test: `web/__tests__/advisor/marriageTimingAdvisor.test.ts`

**Interfaces:**
- Consumes: `AdvisorProfile`, `RecommendationCard` (Task 3)
- Produces: `recommendMarriageTiming(profile: AdvisorProfile): MarriageTimingRecommendation | null` — Task 9(`index.ts`)가 사용

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// web/__tests__/advisor/marriageTimingAdvisor.test.ts
import { describe, it, expect } from 'vitest'
import { recommendMarriageTiming } from '../../lib/advisor/marriageTimingAdvisor'
import type { AdvisorProfile } from '../../lib/advisor/types'

const baseProfile: AdvisorProfile = {
  buyerType: 'couple',
  marriageStatus: 'planned',
  selfHomeStatus: 'none',
  spouseHomeStatus: 'none',
  householdHead: true,
  subscriptionAccountYears: 5,
  noHomeYears: 5,
  numChildren: 0,
  income: 8000,
  assets: 30000,
  budgetMax: 200000,
}

describe('recommendMarriageTiming', () => {
  it('returns null for solo buyers', () => {
    expect(recommendMarriageTiming({ ...baseProfile, buyerType: 'solo' })).toBeNull()
  })

  it('returns null when marriage is already registered', () => {
    expect(recommendMarriageTiming({ ...baseProfile, marriageStatus: 'registered' })).toBeNull()
  })

  it('recommends delaying registration when a spouse already owns a home', () => {
    const result = recommendMarriageTiming({ ...baseProfile, spouseHomeStatus: 'one' })
    expect(result!.card.conclusion).toContain('미루는')
  })

  it('recommends registering promptly when both partners are homeless', () => {
    const result = recommendMarriageTiming(baseProfile)
    expect(result!.card.conclusion).toContain('먼저 신고')
  })
})
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd web && npx vitest run __tests__/advisor/marriageTimingAdvisor.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

```typescript
// web/lib/advisor/marriageTimingAdvisor.ts
import type { AdvisorProfile, RecommendationCard } from './types'

export interface MarriageTimingRecommendation {
  card: RecommendationCard
}

/** 혼인신고를 아직 하지 않은(marriageStatus !== 'registered') couple에게만 의미가 있다. */
export function recommendMarriageTiming(profile: AdvisorProfile): MarriageTimingRecommendation | null {
  if (profile.buyerType !== 'couple') return null
  if (profile.marriageStatus === 'registered' || profile.marriageStatus === null) return null

  const selfHasHome = profile.selfHomeStatus !== 'none'
  const spouseHasHome = profile.spouseHomeStatus !== 'none'
  const eitherHasHome = selfHasHome || spouseHasHome
  const reasons: string[] = []
  let conclusion: string

  if (eitherHasHome) {
    conclusion = '매수(또는 청약 당첨) 전까지 혼인신고를 미루는 것을 검토해볼 만합니다'
    reasons.push('혼인신고 시 세대가 합쳐져, 무주택인 배우자도 청약 무주택 세대주 요건과 생애최초 특별공급 자격을 잃을 수 있습니다')
    if (!selfHasHome) {
      reasons.push('본인이 무주택이라면 혼인신고 전 단독 명의로 생애최초 청약·대출을 먼저 진행하는 방법도 있습니다')
    }
    reasons.push('신혼부부 특례 대출(디딤돌·보금자리론)은 혼인신고 완료가 조건이므로, 정책대출을 우선 활용할지 청약 자격을 지킬지 먼저 정해야 합니다')
  } else {
    conclusion = '두 분 모두 무주택이라면 혼인신고를 미룰 실익이 적어, 먼저 신고하고 신혼부부 특례를 활용하는 것을 권장합니다'
    reasons.push('디딤돌 신혼특례(금리 1.85~3.0%, 한도 3.2억)·보금자리론 신혼특례(우대금리 최대 -1.0%p) 등은 혼인신고가 되어 있어야 신청 가능합니다')
    reasons.push('신혼부부 특별공급은 예비신혼부부도 지원 가능하지만, 당첨 후 계약 전까지는 혼인신고가 필요합니다')
  }

  return {
    card: { id: 'marriage-timing', title: '혼인신고 시점', conclusion, reasons },
  }
}
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `cd web && npx vitest run __tests__/advisor/marriageTimingAdvisor.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add web/lib/advisor/marriageTimingAdvisor.ts web/__tests__/advisor/marriageTimingAdvisor.test.ts
git commit -m "feat: add marriage-timing recommendation module"
```

---

### Task 8: `lib/advisor/purchaseMethodAdvisor.ts` — 매수 방식 추천

**Files:**
- Create: `web/lib/advisor/purchaseMethodAdvisor.ts`
- Test: `web/__tests__/advisor/purchaseMethodAdvisor.test.ts`

**Interfaces:**
- Consumes: `AdvisorProfile`, `RecommendationCard`, `ComparisonTable` (Task 3)
- Produces: `recommendPurchaseMethod(profile: AdvisorProfile, subscriptionScore: number): PurchaseMethodRecommendation` — Task 9(`index.ts`)가 사용

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// web/__tests__/advisor/purchaseMethodAdvisor.test.ts
import { describe, it, expect } from 'vitest'
import { recommendPurchaseMethod } from '../../lib/advisor/purchaseMethodAdvisor'
import type { AdvisorProfile } from '../../lib/advisor/types'

const baseProfile: AdvisorProfile = {
  buyerType: 'solo',
  marriageStatus: null,
  selfHomeStatus: 'none',
  spouseHomeStatus: null,
  householdHead: true,
  subscriptionAccountYears: 10,
  noHomeYears: 10,
  numChildren: 0,
  income: 6000,
  assets: 30000,
  budgetMax: 60000,
}

describe('recommendPurchaseMethod', () => {
  it('recommends subscription when score is high and not multi-home', () => {
    const result = recommendPurchaseMethod(baseProfile, 60)
    expect(result.card.conclusion).toContain('청약')
  })

  it('recommends sale when score is low', () => {
    const result = recommendPurchaseMethod(baseProfile, 10)
    expect(result.card.conclusion).toContain('일반매매')
  })

  it('excludes subscription for multi-home owners regardless of score', () => {
    const result = recommendPurchaseMethod({ ...baseProfile, selfHomeStatus: 'multiple' }, 70)
    expect(result.card.reasons.some(r => r.includes('다주택자'))).toBe(true)
  })

  it('includes a comparison table with three scenarios', () => {
    const result = recommendPurchaseMethod(baseProfile, 60)
    expect(Object.keys(result.table.scenarioLabels)).toEqual(['subscription', 'sale', 'auction'])
  })
})
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd web && npx vitest run __tests__/advisor/purchaseMethodAdvisor.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

```typescript
// web/lib/advisor/purchaseMethodAdvisor.ts
import type { AdvisorProfile, RecommendationCard, ComparisonTable } from './types'

export interface PurchaseMethodRecommendation {
  card: RecommendationCard
  table: ComparisonTable
}

export function recommendPurchaseMethod(
  profile: AdvisorProfile,
  subscriptionScore: number,
): PurchaseMethodRecommendation {
  const reasons: string[] = []
  const eligibleForSubscription = profile.selfHomeStatus !== 'multiple'
  const strongSubscription = eligibleForSubscription && subscriptionScore >= 40
  const recommended: 'subscription' | 'sale' = strongSubscription ? 'subscription' : 'sale'

  if (strongSubscription) {
    reasons.push(`청약 가점 추정 ${subscriptionScore}점(84점 만점)으로 경쟁력이 있어 청약을 우선 시도해볼 만합니다`)
    reasons.push('다만 인기 지역·단지는 커트라인이 60점 이상까지 올라가는 경우가 많으니 관심 지역의 최근 당첨 가점도 함께 확인하세요')
  } else if (!eligibleForSubscription) {
    reasons.push('다주택자는 대부분 청약 일반공급·특별공급 대상에서 제외되어 일반매매·경매가 현실적인 선택지입니다')
  } else {
    reasons.push(`청약 가점 추정 ${subscriptionScore}점으로 당첨 가능성이 낮아, 일반매매를 우선 고려하는 것을 권장합니다`)
  }

  if (profile.assets < profile.budgetMax * 0.15) {
    reasons.push('경매는 잔금 납부 기한이 짧고(통상 낙찰 후 1개월 내) 명도·수리비 등 추가 자금이 필요해, 현재 자기자본 대비 리스크가 큽니다')
  } else {
    reasons.push('자기자본 여력이 있다면 경매로 시세보다 낮게 매수하는 것도 검토할 수 있으나, 권리분석·명도 절차에 대한 사전 학습이 필요합니다')
  }

  return {
    card: {
      id: 'purchase-method',
      title: '매수 방식',
      conclusion: recommended === 'subscription'
        ? '청약을 우선 노려보는 것을 추천합니다'
        : '일반매매를 기본으로, 자금 여력에 따라 경매도 함께 검토하세요',
      reasons,
    },
    table: {
      id: 'purchase-method-detail',
      title: '매수 방식별 특징',
      scenarioLabels: { subscription: '청약', sale: '일반매매', auction: '경매' },
      rows: [
        { label: '초기 자금 부담', values: { subscription: '낮음 (계약금 10~20%)', sale: '중간 (통상 잔금까지 2~3개월)', auction: '높음 (낙찰 후 1개월 내 잔금)' } },
        { label: '가격 매력', values: { subscription: '분양가 상한제 적용 시 시세 대비 저렴', sale: '시세 수준', auction: '시세보다 낮게 낙찰 가능 (권리분석 필요)' } },
        { label: '리스크', values: { subscription: '당첨 확률 불확실', sale: '상대적으로 낮음', auction: '명도·하자·권리관계 리스크' } },
      ],
    },
  }
}
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `cd web && npx vitest run __tests__/advisor/purchaseMethodAdvisor.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add web/lib/advisor/purchaseMethodAdvisor.ts web/__tests__/advisor/purchaseMethodAdvisor.test.ts
git commit -m "feat: add purchase-method (auction/sale/subscription) recommendation module"
```

---

### Task 9: `lib/advisor/index.ts` — 리포트 조합

**Files:**
- Create: `web/lib/advisor/index.ts`
- Test: `web/__tests__/advisor/index.test.ts`

**Interfaces:**
- Consumes: `calcSubscriptionScore` (Task 5), `recommendOwnership` (Task 6), `recommendMarriageTiming` (Task 7), `recommendPurchaseMethod` (Task 8), `AdvisorProfile` (Task 3)
- Produces: `recommendPurchaseStrategy(profile: AdvisorProfile): AdvisorReport` — Task 13(`/advisor` 페이지)이 사용

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// web/__tests__/advisor/index.test.ts
import { describe, it, expect } from 'vitest'
import { recommendPurchaseStrategy } from '../../lib/advisor'
import type { AdvisorProfile } from '../../lib/advisor/types'

const coupleProfile: AdvisorProfile = {
  buyerType: 'couple',
  marriageStatus: 'planned',
  selfHomeStatus: 'none',
  spouseHomeStatus: 'one',
  householdHead: true,
  subscriptionAccountYears: 5,
  noHomeYears: 5,
  numChildren: 0,
  income: 8000,
  assets: 30000,
  budgetMax: 200000,
}

const soloProfile: AdvisorProfile = {
  ...coupleProfile,
  buyerType: 'solo',
  marriageStatus: null,
  spouseHomeStatus: null,
}

describe('recommendPurchaseStrategy', () => {
  it('includes ownership and marriage-timing cards for couples', () => {
    const report = recommendPurchaseStrategy(coupleProfile)
    const ids = report.cards.map(c => c.id)
    expect(ids).toContain('ownership')
    expect(ids).toContain('marriage-timing')
    expect(ids).toContain('purchase-method')
  })

  it('omits ownership and marriage-timing cards for solo buyers', () => {
    const report = recommendPurchaseStrategy(soloProfile)
    const ids = report.cards.map(c => c.id)
    expect(ids).not.toContain('ownership')
    expect(ids).not.toContain('marriage-timing')
    expect(ids).toContain('purchase-method')
  })

  it('computes subscription score once and reuses it', () => {
    const report = recommendPurchaseStrategy(coupleProfile)
    expect(report.subscriptionScore.total).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd web && npx vitest run __tests__/advisor/index.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

```typescript
// web/lib/advisor/index.ts
import type { AdvisorProfile, RecommendationCard, ComparisonTable } from './types'
import { calcSubscriptionScore, type SubscriptionScoreResult } from './subscriptionScore'
import { recommendOwnership } from './ownershipAdvisor'
import { recommendMarriageTiming } from './marriageTimingAdvisor'
import { recommendPurchaseMethod } from './purchaseMethodAdvisor'

export interface AdvisorReport {
  cards: RecommendationCard[]
  tables: ComparisonTable[]
  subscriptionScore: SubscriptionScoreResult
}

export function recommendPurchaseStrategy(profile: AdvisorProfile): AdvisorReport {
  const subscriptionScore = calcSubscriptionScore(
    profile.noHomeYears,
    profile.numChildren,
    profile.subscriptionAccountYears,
  )
  const cards: RecommendationCard[] = []
  const tables: ComparisonTable[] = []

  const ownership = recommendOwnership(profile, profile.budgetMax)
  if (ownership) {
    cards.push(ownership.card)
    tables.push(ownership.table)
  }

  const marriageTiming = recommendMarriageTiming(profile)
  if (marriageTiming) cards.push(marriageTiming.card)

  const purchaseMethod = recommendPurchaseMethod(profile, subscriptionScore.total)
  cards.push(purchaseMethod.card)
  tables.push(purchaseMethod.table)

  return { cards, tables, subscriptionScore }
}

export type { AdvisorProfile, RecommendationCard, ComparisonTable } from './types'
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `cd web && npx vitest run __tests__/advisor/index.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: 전체 advisor 테스트 스위트 실행**

Run: `cd web && npx vitest run __tests__/advisor __tests__/regulations.test.ts`
Expected: PASS (모든 테스트, 총 22개)

- [ ] **Step 6: Commit**

```bash
git add web/lib/advisor/index.ts web/__tests__/advisor/index.test.ts
git commit -m "feat: combine advisor modules into recommendPurchaseStrategy"
```

---

### Task 10: `NumInput`을 공유 컴포넌트로 추출

**Files:**
- Create: `web/components/settings/NumInput.tsx`
- Modify: `web/app/settings/page.tsx:68-88` (로컬 `NumInput` 함수 정의 삭제, import로 교체)

**Interfaces:**
- Produces: `NumInput` default export — Task 11(`AdvisorProfileSection.tsx`)과 `settings/page.tsx`가 공유

- [ ] **Step 1: 컴포넌트 파일 생성**

```typescript
// web/components/settings/NumInput.tsx
interface NumInputProps {
  label: string
  value: number
  onChange: (v: number) => void
  placeholder?: string
  unit?: string
  step?: number
  sub?: string
}

export default function NumInput({
  label, value, onChange, placeholder = '0', unit = '만원', step = 100, sub,
}: NumInputProps) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-gray-500 block">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="number" value={value || ''} onChange={e => onChange(Number(e.target.value))}
          placeholder={placeholder} step={step} min={0}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
        />
        <span className="text-xs text-gray-400 shrink-0">{unit}</span>
      </div>
      {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
    </div>
  )
}
```

- [ ] **Step 2: `settings/page.tsx`에서 로컬 정의 제거하고 import**

`web/app/settings/page.tsx`의 68~88번째 줄 근처(`function NumInput({...`로 시작하는 함수 전체)를 삭제하고, 파일 상단 import 목록에 추가:

```typescript
import NumInput from '@/components/settings/NumInput'
```

- [ ] **Step 3: 타입체크 + 빌드 확인**

Run: `cd web && npx tsc --noEmit`
Expected: 에러 없음 (기존 NumInput 사용처가 모두 동일한 props로 계속 동작)

- [ ] **Step 4: Commit**

```bash
git add web/components/settings/NumInput.tsx web/app/settings/page.tsx
git commit -m "refactor: extract NumInput into shared component"
```

---

### Task 11: `AdvisorProfileSection` 컴포넌트 + 설정 페이지·API 필드 연결

**Files:**
- Create: `web/components/settings/AdvisorProfileSection.tsx`
- Modify: `web/app/settings/page.tsx` (Prefs 인터페이스, DEFAULT_PREFS, 렌더링에 섹션 추가)
- Modify: `web/app/api/preferences/route.ts` (DEFAULT_PREFS, POST 병합 로직에 신규 필드 추가)

**Interfaces:**
- Consumes: `NumInput` (Task 10)
- Produces: `Prefs` 인터페이스에 `buyer_type`, `marriage_status`, `self_home_status`, `spouse_home_status`, `household_head`, `subscription_account_years` 추가 — Task 13(`/advisor` 페이지)이 DB에서 이 필드들을 읽음

- [ ] **Step 1: `AdvisorProfileSection.tsx` 작성**

```typescript
// web/components/settings/AdvisorProfileSection.tsx
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
      </div>

      <div className="space-y-2">
        <label className="text-xs text-gray-500 block">매수 형태</label>
        <div className="grid grid-cols-2 gap-2">
          {([
            { value: 'solo' as const, label: '단독매수' },
            { value: 'couple' as const, label: '공동매수 (부부·커플)' },
          ]).map(({ value, label }) => (
            <button key={value} onClick={() => onChange('buyer_type')(value)}
              className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                prefs.buyer_type === value ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:border-gray-400'
              }`}>{label}</button>
          ))}
        </div>
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
          <p className={`text-[11px] font-normal ${prefs.household_head ? 'text-indigo-200' : 'text-gray-400'}`}>청약 가점 계산에 반영</p>
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
```

- [ ] **Step 2: `settings/page.tsx`의 `Prefs` 인터페이스와 `DEFAULT_PREFS`에 필드 추가**

`web/app/settings/page.tsx`의 `Prefs` 인터페이스(현재 `income_mode`/`income_self`/`income_spouse` 다음)에 추가:

```typescript
  buyer_type: 'solo' | 'couple'
  marriage_status: 'registered' | 'planned' | 'undetermined' | null
  self_home_status: 'none' | 'one' | 'multiple'
  spouse_home_status: 'none' | 'one' | 'multiple' | null
  household_head: boolean
  subscription_account_years: number
```

`DEFAULT_PREFS`에 대응하는 기본값 추가:

```typescript
  buyer_type: 'solo',
  marriage_status: null,
  self_home_status: 'none',
  spouse_home_status: null,
  household_head: true,
  subscription_account_years: 0,
```

- [ ] **Step 3: `settings/page.tsx` 렌더링에 섹션 추가**

파일 상단 import에 추가:

```typescript
import AdvisorProfileSection from '@/components/settings/AdvisorProfileSection'
```

"재무 정보" 섹션(`{/* ══ 2. 재무 정보 ... */}`) 바로 앞에 삽입:

```tsx
      {/* ══ 1.5. 구매 전략 추천용 정보 ═══════════════════════════════════ */}
      <AdvisorProfileSection prefs={prefs} onChange={set} />
```

- [ ] **Step 4: `web/app/api/preferences/route.ts`에 필드 추가**

`DEFAULT_PREFS`에 추가:

```typescript
  buyer_type: 'solo' as 'solo' | 'couple',
  marriage_status: null as 'registered' | 'planned' | 'undetermined' | null,
  self_home_status: 'none' as 'none' | 'one' | 'multiple',
  spouse_home_status: null as 'none' | 'one' | 'multiple' | null,
  household_head: true,
  subscription_account_years: 0,
```

`POST` 핸들러의 upsert 객체에 추가 (기존 `income_spouse` 라인 다음):

```typescript
    buyer_type: has('buyer_type') ? body.buyer_type : base.buyer_type,
    marriage_status: has('marriage_status') ? body.marriage_status : base.marriage_status,
    self_home_status: has('self_home_status') ? body.self_home_status : base.self_home_status,
    spouse_home_status: has('spouse_home_status') ? body.spouse_home_status : base.spouse_home_status,
    household_head: has('household_head') ? Boolean(body.household_head) : base.household_head,
    subscription_account_years: has('subscription_account_years') ? Number(body.subscription_account_years) || 0 : base.subscription_account_years,
```

- [ ] **Step 5: 타입체크**

Run: `cd web && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 6: 수동 확인**

로컬 개발서버 실행 후 (`npm run dev`) 로그인 상태로 `/settings` 접속 → "구매 전략 추천용 정보" 섹션이 뜨는지, 공동매수 선택 시 배우자 필드가 나타나는지, 저장 후 새로고침해도 값이 유지되는지 확인.

- [ ] **Step 7: Commit**

```bash
git add web/components/settings/AdvisorProfileSection.tsx web/app/settings/page.tsx web/app/api/preferences/route.ts
git commit -m "feat: collect buyer type, marriage status, and home-ownership status in settings"
```

---

### Task 12: `/advisor` 페이지

**Files:**
- Create: `web/app/advisor/page.tsx`

**Interfaces:**
- Consumes: `recommendPurchaseStrategy` (Task 9), `AdvisorProfile` (Task 3), `user_preferences` 테이블(Task 1, 11의 신규 필드)

- [ ] **Step 1: 페이지 작성**

```typescript
// web/app/advisor/page.tsx
import { createServerClient } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { recommendPurchaseStrategy } from '@/lib/advisor'
import type { AdvisorProfile } from '@/lib/advisor/types'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '구매 전략 추천',
  description: '혼인신고 시점·명의 구성·매수 방식을 내 조건에 맞춰 추천합니다.',
}
export const dynamic = 'force-dynamic'

export default async function AdvisorPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/advisor')

  const db = createServerClient()
  const { data: prefs } = await db.from('user_preferences').select('*').eq('user_id', user.id).maybeSingle()

  if (!prefs || !prefs.budget_max) {
    return (
      <main className="max-w-xl mx-auto px-4 py-12 text-center space-y-3">
        <p className="text-gray-600 font-medium">추천을 받으려면 먼저 정보를 입력해주세요</p>
        <a href="/settings" className="inline-block px-4 py-2 rounded-lg bg-gray-900 text-white text-sm">내 정보 입력하러 가기 →</a>
      </main>
    )
  }

  const profile: AdvisorProfile = {
    buyerType: prefs.buyer_type ?? 'solo',
    marriageStatus: prefs.marriage_status ?? null,
    selfHomeStatus: prefs.self_home_status ?? 'none',
    spouseHomeStatus: prefs.spouse_home_status ?? null,
    householdHead: prefs.household_head ?? true,
    subscriptionAccountYears: prefs.subscription_account_years ?? 0,
    noHomeYears: prefs.no_home_years ?? 0,
    numChildren: prefs.num_children ?? 0,
    income: prefs.monthly_income ?? 0,
    assets: prefs.assets ?? 0,
    budgetMax: prefs.budget_max ?? 0,
    sigungu: null,
  }

  const report = recommendPurchaseStrategy(profile)

  return (
    <main className="max-w-2xl mx-auto px-4 py-10 space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">구매 전략 추천</h1>
        <p className="text-sm text-gray-500 mt-1">입력하신 정보를 기반으로 한 참고용 추천입니다. 실제 세무·법무 판단은 전문가 상담을 권장합니다.</p>
      </div>

      <div className="space-y-4">
        {report.cards.map(card => (
          <div key={card.id} className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-5 space-y-2">
            <h2 className="font-semibold text-gray-800">{card.title}</h2>
            <p className="text-sm font-medium text-indigo-900">{card.conclusion}</p>
            <ul className="space-y-1">
              {card.reasons.map((r, i) => (
                <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                  <span className="text-indigo-400">·</span><span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {report.tables.length > 0 && (
        <details className="rounded-xl border border-gray-200 p-4">
          <summary className="text-sm font-medium text-gray-700 cursor-pointer">상세 비교표 보기</summary>
          <div className="mt-4 space-y-6">
            {report.tables.map(table => (
              <div key={table.id} className="space-y-2">
                <p className="text-sm font-medium text-gray-700">{table.title}</p>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-3 py-2 text-left font-medium text-gray-500"> </th>
                        {Object.entries(table.scenarioLabels).map(([key, label]) => (
                          <th key={key} className="px-3 py-2 text-left font-medium text-gray-500">{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {table.rows.map(row => (
                        <tr key={row.label}>
                          <td className="px-3 py-2 text-gray-600">{row.label}</td>
                          {Object.keys(table.scenarioLabels).map(key => (
                            <td key={key} className="px-3 py-2 text-gray-800">{row.values[key] ?? '—'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      <p className="text-[11px] text-gray-400 text-center">
        ※ 참고용 정보이며 실제 세무·법무 상담이 필요합니다. 종합부동산세는 매매가 기준 공시가격 추정치로 계산된 근사값입니다.
      </p>
    </main>
  )
}
```

- [ ] **Step 2: 타입체크**

Run: `cd web && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 수동 확인**

로컬 개발서버에서 `/settings`에 정보를 입력·저장한 뒤 `/advisor` 접속 → 카드와 상세 비교표가 렌더링되는지, couple이 아닐 때 명의/혼인신고 카드가 숨겨지는지 확인.

- [ ] **Step 4: Commit**

```bash
git add web/app/advisor/page.tsx
git commit -m "feat: add /advisor page rendering purchase-strategy recommendations"
```

---

## Phase 2 — 정책 업데이트 감지 파이프라인

### Task 13: DB 마이그레이션 — `policy_change_proposals` 테이블

**Files:**
- Create: `supabase/migrations/012_policy_change_proposals.sql`

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- 012_policy_change_proposals.sql: 정책 변경 감지 제안 테이블

CREATE TABLE IF NOT EXISTS policy_change_proposals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_url     text,
  article_title   text NOT NULL,
  regulation_path text NOT NULL,
  ai_summary      text NOT NULL,
  proposed_diff   text NOT NULL,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  detected_at     timestamptz NOT NULL DEFAULT now(),
  reviewed_at     timestamptz
);

CREATE INDEX IF NOT EXISTS policy_change_proposals_status_idx ON policy_change_proposals (status);

ALTER TABLE policy_change_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "policy_change_proposals_service" ON policy_change_proposals;
CREATE POLICY "policy_change_proposals_service" ON policy_change_proposals
  FOR ALL USING (auth.role() = 'service_role');
```

- [ ] **Step 2: Supabase SQL 에디터에서 실행하도록 안내**

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/012_policy_change_proposals.sql
git commit -m "feat: add policy_change_proposals table"
```

---

### Task 14: `pipeline/processors/policy_watcher.py`

**Files:**
- Create: `pipeline/processors/policy_watcher.py`
- Test: `pipeline/tests/test_policy_watcher.py`

**Interfaces:**
- Produces: `async def detect_policy_changes(articles: list[dict], anthropic_api_key: str) -> list[dict]` — Task 15(`main.py` 연결)가 사용. 각 dict는 `{article_url, article_title, regulation_path, ai_summary, proposed_diff}` 형태.

- [ ] **Step 1: 실패하는 테스트 작성**

```python
# pipeline/tests/test_policy_watcher.py
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from processors.policy_watcher import detect_policy_changes, _extract_json


def test_extract_json_handles_plain_json():
    assert _extract_json('{"changed": false}') == {'changed': False}


def test_extract_json_handles_markdown_fence():
    text = '```json\n{"changed": true, "regulation_path": "X"}\n```'
    assert _extract_json(text) == {'changed': True, 'regulation_path': 'X'}


@pytest.mark.asyncio
async def test_detect_policy_changes_skips_non_policy_articles():
    articles = [{'title': 'A', 'category': '시세', 'importance': 9, 'summary': 'x'}]
    result = await detect_policy_changes(articles, 'fake-key')
    assert result == []


@pytest.mark.asyncio
async def test_detect_policy_changes_skips_low_importance():
    articles = [{'title': 'A', 'category': '정책', 'importance': 3, 'summary': 'x'}]
    result = await detect_policy_changes(articles, 'fake-key')
    assert result == []


@pytest.mark.asyncio
async def test_detect_policy_changes_returns_proposal_when_ai_detects_change():
    articles = [{
        'title': '종부세 공정시장가액비율 80%로 인상',
        'category': '정책', 'importance': 9, 'summary': '요약',
        'url': 'https://example.com/a',
    }]
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text='{"changed": true, "regulation_path": "PROPERTY_TAX.fairMarketValueRatio", "ai_summary": "80%로 인상", "proposed_diff": "fairMarketValueRatio: 0.80,", "confidence": "high"}')]

    with patch('processors.policy_watcher.sdk.AsyncAnthropic') as MockClient:
        instance = MockClient.return_value
        instance.messages.create = AsyncMock(return_value=mock_response)
        result = await detect_policy_changes(articles, 'fake-key')

    assert len(result) == 1
    assert result[0]['regulation_path'] == 'PROPERTY_TAX.fairMarketValueRatio'
    assert result[0]['article_url'] == 'https://example.com/a'
    assert result[0]['article_title'] == '종부세 공정시장가액비율 80%로 인상'


@pytest.mark.asyncio
async def test_detect_policy_changes_skips_when_ai_says_unchanged():
    articles = [{'title': 'A', 'category': '정책', 'importance': 9, 'summary': 'x', 'url': 'u'}]
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text='{"changed": false}')]

    with patch('processors.policy_watcher.sdk.AsyncAnthropic') as MockClient:
        instance = MockClient.return_value
        instance.messages.create = AsyncMock(return_value=mock_response)
        result = await detect_policy_changes(articles, 'fake-key')

    assert result == []
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd pipeline && python -m pytest tests/test_policy_watcher.py -v`
Expected: FAIL — `processors.policy_watcher` 모듈 없음 (`pytest-asyncio`가 설치돼 있어야 함 — `pipeline/requirements.txt`에 이미 포함되어 있는지 `pytest.ini`의 `asyncio_mode` 설정과 함께 확인)

- [ ] **Step 3: 구현**

```python
# pipeline/processors/policy_watcher.py
import json
import re
import logging
import anthropic as sdk

logger = logging.getLogger(__name__)

REGULATION_CONTEXT = """
현재 서비스에 반영된 주요 부동산 규정 요약:
- DSR: 은행권 40%, 스트레스DSR 3단계(수도권·규제지역 +3.0%p, 비규제 +0.75%p)
- LTV: 투기과열지구 일반 40%/생애최초 80%(9억이하), 비규제 일반 70%/생애최초 80%
- 디딤돌 신혼특례: 소득 8500만원, 한도 3.2억, 금리 1.85~3.0%
- 신생아 특례: 소득 2억, 한도 5억, 금리 1.6~3.3%
- 보금자리론: 일반 소득 7000만원/신혼 8500만원, 한도 3.6억
- 취득세: 1주택 1~3%, 2주택 8%, 3주택+ 12%, 생애최초 감면 최대 200만원
- 종합부동산세: 1세대1주택 공제 12억, 인별 9억, 공정시장가액비율 60%, 세부담상한 150%
- 청약: 서울 전역 토허제·투기과열·조정대상지역, 재당첨제한 10년
"""


def _extract_json(text: str):
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    m = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
    if m:
        return json.loads(m.group(1))
    m = re.search(r'\{[\s\S]*\}', text)
    if m:
        return json.loads(m.group(0))
    raise json.JSONDecodeError('No JSON found', text, 0)


async def detect_policy_changes(articles: list[dict], anthropic_api_key: str) -> list[dict]:
    """'정책' 카테고리 + importance>=7 기사 중, 기존 규정을 변경시키는 기사를 감지해
    {article_url, article_title, regulation_path, ai_summary, proposed_diff} 목록을 반환한다.
    변경이 없다고 판단되거나 파싱에 실패하면 해당 기사는 건너뛴다."""
    candidates = [
        a for a in articles
        if a.get('category') == '정책' and (a.get('importance') or 0) >= 7
    ]
    if not candidates:
        return []

    client = sdk.AsyncAnthropic(api_key=anthropic_api_key)
    proposals: list[dict] = []

    for article in candidates:
        prompt = f"""{REGULATION_CONTEXT}

아래 기사가 위 규정 중 하나를 실제로 변경하는 내용인지 판단하세요.

기사 제목: {article.get('title', '')}
기사 요약: {article.get('summary', '')}

변경사항이 없거나 확실하지 않으면 {{"changed": false}}만 응답하세요.
변경사항이 있으면 아래 JSON 형식으로만 응답하세요:
{{"changed": true, "regulation_path": "예: PROPERTY_TAX.rates.general", "ai_summary": "무엇이 어떻게 바뀌는지 2줄 요약", "proposed_diff": "regulations.ts에 적용할 TypeScript 코드 스니펫", "confidence": "high|medium|low"}}"""
        try:
            msg = await client.messages.create(
                model='claude-sonnet-5', max_tokens=1024,
                messages=[{'role': 'user', 'content': prompt}],
            )
            raw = msg.content[0].text if msg.content else ''
            result = _extract_json(raw)
            if result.get('changed'):
                proposals.append({
                    'article_url': article.get('url'),
                    'article_title': article.get('title', ''),
                    'regulation_path': result.get('regulation_path', ''),
                    'ai_summary': result.get('ai_summary', ''),
                    'proposed_diff': result.get('proposed_diff', ''),
                })
        except Exception as e:
            logger.warning(f'정책 변경 감지 실패 (기사: {article.get("title", "")[:30]}): {type(e).__name__}: {e}')

    logger.info(f'정책 변경 제안 {len(proposals)}건 감지')
    return proposals
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `cd pipeline && python -m pytest tests/test_policy_watcher.py -v`
Expected: PASS (6 tests). `pytest-asyncio`가 없다는 에러가 나오면 `pipeline/requirements.txt`에 `pytest-asyncio`를 추가하고 `pip install -r requirements.txt` 실행 (기존 `pipeline/pytest.ini`에 `asyncio_mode = auto` 설정이 있는지 먼저 확인 — 있으면 추가 설정 불필요).

- [ ] **Step 5: Commit**

```bash
git add pipeline/processors/policy_watcher.py pipeline/tests/test_policy_watcher.py
git commit -m "feat: add policy change detection processor"
```

---

### Task 15: `BackendClient`에 제안 전송 메서드 추가 + `main.py` 연결

**Files:**
- Modify: `pipeline/client.py` (파일 끝에 메서드 추가)
- Modify: `pipeline/main.py` (import 및 파이프라인 흐름에 호출 추가)

**Interfaces:**
- Consumes: `detect_policy_changes` (Task 14)
- Produces: `BackendClient.ingest_policy_proposals(proposals: list[dict]) -> dict` — `/api/pipeline/policy-proposals` 엔드포인트(Task 16) 호출

- [ ] **Step 1: `client.py`에 메서드 추가**

`pipeline/client.py` 파일 끝(`ingest_properties` 메서드 다음)에 추가:

```python
    async def ingest_policy_proposals(self, proposals: list[dict]) -> dict:
        if not proposals:
            return {'saved': 0}
        return await self._post('/api/pipeline/policy-proposals', {
            'proposals': proposals,
        })
```

- [ ] **Step 2: `main.py`에 import 추가**

`pipeline/main.py` 상단 import 목록(`from processors.briefing_generator import generate_briefing` 다음)에 추가:

```python
from processors.policy_watcher import detect_policy_changes
```

- [ ] **Step 3: `main.py` 파이프라인 흐름에 호출 추가**

`main.py`의 긴급 알림 발송 블록(`urgent = [d for d in serialized if d.get('urgent')]` 근처) 바로 다음에 추가:

```python
        try:
            proposals = await detect_policy_changes(serialized, config.anthropic_api_key)
            if proposals:
                await backend.ingest_policy_proposals(proposals)
        except Exception as e:
            logger.warning(f'정책 변경 감지 실패 (무시): {e}')
```

- [ ] **Step 4: Python 문법 확인**

Run: `cd pipeline && python -m py_compile client.py main.py`
Expected: 에러 없음

- [ ] **Step 5: 기존 파이프라인 테스트 스위트 회귀 확인**

Run: `cd pipeline && python -m pytest -v`
Expected: 기존 테스트 모두 PASS (새 호출은 try/except로 감싸져 있어 다른 흐름에 영향 없음)

- [ ] **Step 6: Commit**

```bash
git add pipeline/client.py pipeline/main.py
git commit -m "feat: wire policy change detection into main pipeline flow"
```

---

### Task 16: `/api/pipeline/policy-proposals` — 파이프라인 ingest 엔드포인트

**Files:**
- Create: `web/app/api/pipeline/policy-proposals/route.ts`

**Interfaces:**
- Consumes: `validatePipelineKey`, `unauthorized` (`@/lib/auth`), `createServerClient` (`@/lib/supabase`)
- Produces: `POST /api/pipeline/policy-proposals` — Task 15의 `ingest_policy_proposals`가 호출

- [ ] **Step 1: 라우트 작성**

```typescript
// web/app/api/pipeline/policy-proposals/route.ts
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { validatePipelineKey, unauthorized } from '@/lib/auth'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!validatePipelineKey(req)) return unauthorized()
  const { proposals } = await req.json()
  if (!Array.isArray(proposals))
    return Response.json({ error: 'proposals must be an array' }, { status: 400 })
  if (proposals.length === 0) return Response.json({ saved: 0 })

  const db = createServerClient()
  const rows = proposals.map((p: Record<string, unknown>) => ({
    article_url: p.article_url ?? null,
    article_title: p.article_title ?? '',
    regulation_path: p.regulation_path ?? '',
    ai_summary: p.ai_summary ?? '',
    proposed_diff: p.proposed_diff ?? '',
    status: 'pending',
  }))

  const { data, error } = await db.from('policy_change_proposals').insert(rows).select('id')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ saved: data?.length ?? 0 })
}
```

- [ ] **Step 2: 타입체크**

Run: `cd web && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 수동 확인 (curl)**

```bash
curl -X POST https://<배포URL>/api/pipeline/policy-proposals \
  -H "x-pipeline-key: $PIPELINE_API_KEY" -H "Content-Type: application/json" \
  -d '{"proposals":[{"article_url":"https://example.com","article_title":"테스트","regulation_path":"TEST.x","ai_summary":"테스트","proposed_diff":"x: 1,"}]}'
```

Expected: `{"saved":1}`

- [ ] **Step 4: Commit**

```bash
git add web/app/api/pipeline/policy-proposals/route.ts
git commit -m "feat: add pipeline ingest endpoint for policy change proposals"
```

---

### Task 17: `/api/admin/policy-proposals` — 관리자 조회·승인 엔드포인트

**Files:**
- Create: `web/app/api/admin/policy-proposals/route.ts`
- Create: `web/app/api/admin/policy-proposals/[id]/route.ts`

**Interfaces:**
- Consumes: `validateAdminRequest`, `unauthorized` (`@/lib/auth`)
- Produces: `GET /api/admin/policy-proposals?status=pending`, `PATCH /api/admin/policy-proposals/:id` — Task 18(관리자 UI)이 사용

- [ ] **Step 1: 목록 조회 라우트**

```typescript
// web/app/api/admin/policy-proposals/route.ts
import { createServerClient } from '@/lib/supabase'
import { validateAdminRequest, unauthorized } from '@/lib/auth'
export const dynamic = 'force-dynamic'

const ALLOWED_STATUS = ['pending', 'approved', 'rejected']

export async function GET(req: Request) {
  if (!await validateAdminRequest(req)) return unauthorized()
  const url = new URL(req.url)
  const rawStatus = url.searchParams.get('status') ?? 'pending'
  const status = ALLOWED_STATUS.includes(rawStatus) ? rawStatus : 'pending'

  const db = createServerClient()
  const { data, error } = await db.from('policy_change_proposals')
    .select('*')
    .eq('status', status)
    .order('detected_at', { ascending: false })
    .limit(50)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ proposals: data })
}
```

- [ ] **Step 2: 승인/거절 라우트**

```typescript
// web/app/api/admin/policy-proposals/[id]/route.ts
import { createServerClient } from '@/lib/supabase'
import { validateAdminRequest, unauthorized } from '@/lib/auth'
export const dynamic = 'force-dynamic'

const ALLOWED_STATUS = ['approved', 'rejected'] as const

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await validateAdminRequest(req)) return unauthorized()
  const { id } = await params
  const { status } = await req.json()
  if (!(ALLOWED_STATUS as readonly string[]).includes(status)) {
    return Response.json({ error: `status must be one of: ${ALLOWED_STATUS.join(', ')}` }, { status: 400 })
  }
  const db = createServerClient()
  const { error } = await db.from('policy_change_proposals')
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
```

- [ ] **Step 3: 타입체크**

Run: `cd web && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: Commit**

```bash
git add web/app/api/admin/policy-proposals
git commit -m "feat: add admin endpoints for reviewing policy change proposals"
```

---

### Task 18: 관리자 페이지 — "정책 변경 제안" 탭

**Files:**
- Modify: `web/app/admin/page.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/policy-proposals`, `PATCH /api/admin/policy-proposals/:id` (Task 17)

- [ ] **Step 1: 타입 및 state 추가**

`web/app/admin/page.tsx` 상단 인터페이스 목록(`interface Property {...}` 다음)에 추가:

```typescript
interface PolicyProposal {
  id: string
  article_url: string | null
  article_title: string
  regulation_path: string
  ai_summary: string
  proposed_diff: string
  status: string
  detected_at: string
}
```

`Tab` 타입 수정:

```typescript
type Tab = 'runs' | 'briefings' | 'articles' | 'properties' | 'policy'
```

컴포넌트 내부 state 목록(`const [propertyStatus, ...`) 다음에 추가:

```typescript
  const [proposals, setProposals] = useState<PolicyProposal[]>([])
```

- [ ] **Step 2: fetch 함수 추가 및 `fetchAll`에 연결**

`fetchProperties` 함수 다음에 추가:

```typescript
  const fetchProposals = async () => {
    const res = await fetch('/api/admin/policy-proposals?status=pending')
    if (!res.ok) return
    const json = await res.json()
    setProposals(json.proposals ?? [])
  }
```

`fetchAll` 함수 마지막 줄 `await Promise.all([fetchArticles(), fetchProperties()])`를 다음으로 교체:

```typescript
    await Promise.all([fetchArticles(), fetchProperties(), fetchProposals()])
```

- [ ] **Step 3: 승인/거절 핸들러 추가**

`togglePropertyStatus` 함수 다음에 추가:

```typescript
  const reviewProposal = async (id: string, status: 'approved' | 'rejected') => {
    setActionId(id)
    await fetch(`/api/admin/policy-proposals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setActionId(null)
    await fetchProposals()
  }
```

- [ ] **Step 4: 탭 목록에 'policy' 추가**

기존 탭 배열과 라벨 삼항연산자를 수정:

```tsx
            {(['runs', 'briefings', 'articles', 'properties', 'policy'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`pb-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  tab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {t === 'runs' ? '실행 이력' : t === 'briefings' ? '브리핑 이력' : t === 'articles' ? '기사 관리' : t === 'properties' ? '매물 관리' : '정책 변경 제안'}
              </button>
            ))}
```

- [ ] **Step 5: 탭 콘텐츠 추가**

`{tab === 'properties' && ( ... )}` 블록이 끝나는 지점 바로 다음에 추가:

```tsx
          {/* 정책 변경 제안 */}
          {tab === 'policy' && (
            <div className="space-y-3">
              {proposals.length === 0 && <p className="text-sm text-gray-400">대기 중인 제안 없음</p>}
              {proposals.map(p => (
                <div key={p.id} className="rounded border p-4 space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{p.regulation_path}</p>
                      {p.article_url ? (
                        <a href={p.article_url} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">
                          {p.article_title}
                        </a>
                      ) : (
                        <p className="text-xs text-gray-400">{p.article_title}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">
                      {new Date(p.detected_at).toLocaleString('ko-KR')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{p.ai_summary}</p>
                  <pre className="text-xs bg-gray-50 rounded p-2 overflow-x-auto whitespace-pre-wrap">{p.proposed_diff}</pre>
                  <div className="flex gap-2">
                    <button
                      onClick={() => reviewProposal(p.id, 'approved')}
                      disabled={actionId === p.id}
                      className="px-3 py-1 rounded bg-green-600 text-white text-xs disabled:opacity-50"
                    >승인</button>
                    <button
                      onClick={() => reviewProposal(p.id, 'rejected')}
                      disabled={actionId === p.id}
                      className="px-3 py-1 rounded bg-gray-200 text-gray-700 text-xs disabled:opacity-50"
                    >거절</button>
                  </div>
                </div>
              ))}
            </div>
          )}
```

- [ ] **Step 6: 타입체크**

Run: `cd web && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 7: 수동 확인**

관리자 계정으로 `/admin` 접속 → "정책 변경 제안" 탭 클릭 → 목록이 뜨는지 확인 (Task 16에서 curl로 넣은 테스트 데이터가 있다면 그것도 확인). 승인/거절 버튼 클릭 시 목록에서 사라지는지 확인.

- [ ] **Step 8: Commit**

```bash
git add web/app/admin/page.tsx
git commit -m "feat: add policy change proposal review tab to admin page"
```

---

## Self-Review 결과

**Spec coverage:** 스펙의 데이터 모델(Task 1, 11), `PROPERTY_TAX` 규정(Task 2), 5개 엔진 모듈(Task 4~9), `/advisor` UI(Task 12), 정책 파이프라인(Task 13~18) 모두 태스크로 매핑됨. 스펙의 "제외 목록"(법인명의 등)은 의도적으로 태스크화하지 않음.

**Type consistency:** `AdvisorProfile`, `RecommendationCard`, `ComparisonTable`은 Task 3에서 정의되고 Task 4~12까지 동일한 이름·필드로 일관되게 사용됨. `has()` 병합 패턴은 기존 `web/app/api/preferences/route.ts`(Task 11에서 확장)의 기존 구현과 동일한 패턴을 따름.

**Phase 2는 Phase 1과 독립적으로 동작** — `/advisor` 페이지는 Phase 2 없이도 완전히 작동한다.
