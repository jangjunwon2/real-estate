# 주택구매 전략 추천 기능 설계

- 날짜: 2026-07-11
- 상태: 승인 대기 (브레인스토밍 완료, 스펙 리뷰 전)

## 배경 / 목표

기존 `/settings`에는 사용자가 소득·자산·신혼부부 여부 등을 입력하면 `calcAffordableScenarios`/`calcLoanProducts`(`web/lib/koreanRealEstate.ts`)가 대출상품별 구매가능금액을 계산해주는 기능이 있다. 이번에 추가하는 건 그 위에 얹는 **종합 의사결정 추천 레이어**로, 아래 세 가지를 사용자 데이터 기반으로 자동 추천한다:

1. 혼인신고를 지금 할지 미룰지 (청약 무주택 세대주 요건, 신혼부부 특례 대출 자격, 취득세·종부세 영향)
2. 공동명의 vs 단독명의
3. 경매 / 일반매매 / 청약 중 어떤 매수 방식이 유리한지

## 대상 사용자

서비스 자체는 "신혼부부 생애최초" 중심으로 설계돼 있지만, 이 추천 기능은 **주택구매를 고려하는 모든 개인**(1인 단독매수 포함)으로 확대한다. 단, 문자 그대로 "모든 요소"가 아니라 대다수 매수자에게 적용되는 요소로 범위를 확정한다.

### 포함
- 매수자 구성: 1인 단독매수 / 부부(기혼)·커플(예비) 공동매수, 혼인신고 상태(완료/예정/미정), 세대주 여부, 부양가족 수
- 주택보유현황: 본인·배우자/공동매수인 각각 무주택/1주택/다주택
- 자금·대출: 기존 `calcAffordableScenarios`/`calcLoanProducts` 그대로 활용
- 세금: 취득세(다주택 중과 포함, 기존), 종합부동산세(신규), 양도소득세(기존 데이터로 "주의사항" 수준 안내)
- 매물 유형 추천: 경매/일반매매/청약 (청약은 가점 추정 + 특공 자격 포함)
- 지역 규제: 기존 `detectZoneType`/`detectRegulations` 그대로 활용
- 혼인신고 시점 / 명의 구성 추천: 커플일 때만, 위 요소를 조합

### 제외 (니치 케이스, 이번 버전 범위 밖)
법인 명의, 해외거주자/비거주자 특례, 상속·증여 취득, 재건축·재개발 조합원 입주권, 농지·상가겸용주택, 신혼/생애최초/노부모부양 외 세부 특별공급 유형

## 데이터 모델 변경

`user_preferences` 테이블 + `web/app/settings/page.tsx`의 `Prefs`에 추가 (기존 `is_newlywed`/`is_first_buyer`는 하위호환을 위해 유지, 기존 대출계산 로직이 계속 사용):

| 필드 | 타입 | 설명 |
|---|---|---|
| `buyer_type` | `'solo' \| 'couple'` | 단독매수 / 공동매수 |
| `marriage_status` | `'registered' \| 'planned' \| 'undetermined' \| null` | couple일 때만 사용 |
| `self_home_status` | `'none' \| 'one' \| 'multiple'` | 본인 주택보유현황 |
| `spouse_home_status` | `'none' \| 'one' \| 'multiple' \| null` | couple일 때만 |
| `household_head` | `boolean` | 세대주 여부 (청약 가점) |
| `subscription_account_years` | `number` | 청약통장 가입기간 (청약 가점 추정용) |

기존 `num_children`(부양가족수 대용), `no_home_years`(무주택기간)는 청약 가점 추정에 그대로 재사용한다.

마이그레이션: `supabase/migrations/011_advisor_fields.sql` (모두 `ADD COLUMN IF NOT EXISTS`, 안전한 additive 변경). **`CREATE POLICY IF NOT EXISTS` 문법은 PostgreSQL에 존재하지 않으므로 절대 사용하지 않는다** — `DROP POLICY IF EXISTS` + `CREATE POLICY` 패턴을 쓴다 (009번 마이그레이션에서 이미 한 번 이 문법 오류로 프로덕션 장애가 있었음).

## `lib/regulations.ts` 확장 — 종합부동산세

신규 `PROPERTY_TAX` 블록 추가 (웹 검색으로 교차검증한 수치, 2023년 개정 세법 기준):

```typescript
export const PROPERTY_TAX = {
  deduction: {
    singleHouseSpecial: 120000,   // 1세대1주택자 특례: 12억
    perPerson: 90000,             // 인별 과세 기본공제: 9억 (공동명의는 1인당)
  },
  jointOwnershipOption: {
    note: '부부 공동명의 1주택: 특례(12억, 세액공제 가능) vs 인별과세(9억×2=18억, 세액공제 불가) 중 유리한 쪽 선택 가능. 9.16~9.30 신청 필요.',
  },
  rates: {
    general: [ // 2주택 이하
      { maxBase: 30000, rate: 0.005 }, { maxBase: 60000, rate: 0.007 },
      { maxBase: 120000, rate: 0.010 }, { maxBase: 250000, rate: 0.013 },
      { maxBase: 500000, rate: 0.015 }, { maxBase: 940000, rate: 0.020 },
      { maxBase: Infinity, rate: 0.027 },
    ],
    multiHouse3plus: [ // 3주택 이상, 과세표준 12억까지는 general과 동일
      { maxBase: 120000, rate: 0.010 }, { maxBase: 250000, rate: 0.020 },
      { maxBase: 500000, rate: 0.030 }, { maxBase: 940000, rate: 0.040 },
      { maxBase: Infinity, rate: 0.050 },
    ],
  },
  taxBurdenCap: 1.50, // 전년 대비 세부담 상한 — 주택 수 무관 150% (2023 개정으로 다주택 300%→150%)
  seniorLongTermDeduction: { maxRate: 0.80 },
  lastUpdated: '2026-07-01',
  source: '종합부동산세법 (2023년 개정 세법 기준) — 국세청 자료로 교차검증 완료',
} as const
```

## 엔진 구조

```
web/lib/advisor/
├── propertyTax.ts            # 종부세 계산 (매매가×0.65~0.70으로 공시가 추정 → 과세표준 → 세액, 단독/공동 비교)
├── subscriptionScore.ts      # 청약 가점 추정 (무주택기간+부양가족+통장기간, 84점 만점)
├── ownershipAdvisor.ts       # 공동명의 vs 단독명의 비교 (취득세+종부세+양도세 종합)
├── marriageTimingAdvisor.ts  # 혼인신고 시점 비교 (청약자격+대출특례+세금 종합)
├── purchaseMethodAdvisor.ts  # 경매/일반매매/청약 추천
└── index.ts                  # 위 모듈을 조합해 최종 리포트 생성 (recommendPurchaseStrategy)
```

각 모듈은 순수 함수(입력: 사용자 재무·상태 데이터, 출력: 시나리오별 숫자 비교 + 추천 사유 문자열 배열)로, `koreanRealEstate.ts`와 동일한 스타일을 따른다. 정보가 부족한 모듈(예: 청약통장 기간 미입력)은 해당 부분만 "정보 입력 필요"를 반환하고 나머지는 정상 계산한다.

## UI

새 `/advisor` 페이지(서버 컴포넌트):
- `user_preferences` 로드 → `recommendPurchaseStrategy()` 실행
- 상단: 추천 카드 3개(혼인신고 시점 / 명의 / 매물유형) — 결론 한 줄 + 근거 3~4개 bullet
- 하단: 접이식 상세 비교표 — 시나리오별 취득세·종부세·대출한도·청약가점 등 숫자 나열
- couple이 아니면 혼인신고/명의 카드는 자동 숨김
- 페이지 전체에 "참고용 정보이며 실제 세무·법무 상담이 필요합니다" 면책 문구 고정 노출

## 정책 업데이트 파이프라인 (AI 감지 → 관리자 승인)

기존 파이프라인이 이미 뉴스를 '정책' 카테고리로 분류하고 있는 흐름에 연결한다.

1. **감지**: `pipeline/processors/policy_watcher.py` 신규 — `category=='정책'` 이고 importance 높은 기사를 대상으로, 현재 `regulations.ts`의 관련 값을 컨텍스트로 함께 주고 Claude에게 "이 기사로 인해 바뀐 규정이 있는가?"를 구조화된 JSON으로 질의. 있으면 `{regulation_path, old_value, new_value, reasoning, confidence}` 반환.
2. **저장**: 새 테이블 `policy_change_proposals` (id, article_id, regulation_path, ai_summary, proposed_diff, status: pending/approved/rejected, detected_at, reviewed_at) — `/api/pipeline/policy-proposals`로 ingest (기존 `/api/pipeline/ingest` 패턴과 동일하게 API 키 인증).
3. **검토**: `/admin` 페이지에 새 탭 "정책 변경 제안" 추가 — 제안 목록, 원문 기사 링크, AI 요약, 제안된 코드 diff를 보여주고 승인/거절 버튼.
4. **반영**: 승인은 상태만 `approved`로 바꾸고, 제안된 diff를 그대로 보여줌 — **실제 `regulations.ts` 수정·커밋·배포는 사람이 수동으로 진행** (git 버전관리 유지, 세율처럼 민감한 수치가 리뷰 없이 바로 라이브에 나가는 걸 방지).

## 구현 순서 (제안)

이 기능은 두 개의 독립적인 서브프로젝트로 나눠서 구현하는 게 안전하다:

- **Phase 1 — 추천 엔진 + UI** (데이터 모델, `lib/advisor/*`, `PROPERTY_TAX` 규정 데이터, `/advisor` 페이지, 유닛 테스트). 사용자가 바로 체감하는 핵심 가치.
- **Phase 2 — 정책 업데이트 파이프라인** (`policy_watcher.py`, `policy_change_proposals` 테이블, 관리자 승인 탭). Phase 1과 독립적으로 동작 가능하며, 별도 스펙 검토 없이 이 문서의 설계 그대로 이어서 구현 가능.

각 Phase는 별도 구현 계획(writing-plans)으로 진행한다.

## 테스트

`web/__tests__/advisor/`에 각 모듈별 vitest 유닛 테스트 (기존 `koreanRealEstate.test.ts`와 동일한 AAA 스타일):
- `propertyTax.test.ts`: 단독명의 vs 공동명의 종부세 손익분기점(공시가 18억 부근) 케이스
- `ownershipAdvisor.test.ts`, `marriageTimingAdvisor.test.ts`, `purchaseMethodAdvisor.test.ts`: 각 시나리오별 결정론적 케이스 (예: 배우자 1주택 보유 시 혼인신고 미루는 쪽 추천되는지)

파이프라인 쪽 `policy_watcher.py`는 `pipeline/tests/`에 Claude 응답을 모킹한 파싱 테스트 추가.
