# 단지 실거래가 바로보기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 매물 상세 페이지에서 버튼 한 번으로 해당 단지의 최근 6개월 아파트 매매 실거래가를 앱 안에서 바로 조회한다.

**Architecture:** 버튼 클릭 → `GET /api/properties/[id]/transactions` → 시군구명을 법정동코드(LAWD_CD)로 변환 → 국토부 공공데이터포털 API를 월 단위로 호출하되 Supabase `molit_deals_cache` 테이블에 (시군구, 월) 단위 24시간 캐시 → 단지명 매칭 후 거래 리스트+요약 반환 → 인라인 펼침 UI 표시.

**Tech Stack:** Next.js 15 App Router, Supabase(supabase-js), vitest. 새 npm 의존성 없음 (XML은 정규식 파싱).

**Spec:** `docs/superpowers/specs/2026-07-13-molit-transactions-design.md`

## Global Constraints

- 새 npm 의존성 추가 금지 — XML 파싱은 정규식 헬퍼로 구현
- 가격 단위는 **만원** (DB `properties.price`와 동일, `formatPrice()` 그대로 사용)
- UI 문구는 한국어, 기존 컴포넌트의 tailwind 스타일(rounded-xl, text-xs 계열)을 따른다
- Supabase 마이그레이션은 파일만 작성하고 **수동 적용** (사용자가 SQL 에디터에서 실행). `CREATE POLICY IF NOT EXISTS` 사용 금지
- 환경변수 `MOLIT_API_KEY` = data.go.kr "국토교통부_아파트 매매 실거래가 자료" 일반 인증키(**Decoding** 버전). 코드에서 `encodeURIComponent`로 인코딩
- 키 미설정/지역 미지원 시 기능이 조용히 비활성화되고 기존 외부 링크는 그대로 유지되어야 한다
- 테스트 실행은 `web/` 디렉토리에서: `npm run test:run`
- 커밋 메시지는 conventional commits (`feat:`, `test:` 등), 마지막에 `git push origin main`

---

### Task 1: 법정동코드 매핑 (`lib/lawdCodes.ts`)

**Files:**
- Create: `web/lib/lawdCodes.ts`
- Test: `web/__tests__/lawdCodes.test.ts`

**Interfaces:**
- Consumes: 없음 (순수 정적 데이터 + 함수)
- Produces: `resolveLawdCode(sigungu: string | null | undefined, roadAddress?: string | null): string | null` — Task 3(라우트)과 Task 4(페이지 노출 판단)가 사용

**배경:** `complexes.sigungu`는 `"서울 마포구"`, `"경기 성남시"` 형태. 국토부 API는 5자리 법정동 시군구코드(LAWD_CD)를 요구한다. 성남·수원처럼 일반구가 있는 시는 시 단위 코드가 없으므로 `road_address`(예: `"경기 성남시 분당구 판교역로 166"`)에서 구를 보완해 매칭한다. 서비스가 수도권 중심이므로 서울·인천·경기만 지원하고, 그 외 지역은 `null`을 반환해 기존 외부 링크로 폴백한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`web/__tests__/lawdCodes.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { resolveLawdCode } from '../lib/lawdCodes'

describe('resolveLawdCode', () => {
  it('서울 시군구를 직접 매칭한다', () => {
    expect(resolveLawdCode('서울 마포구')).toBe('11440')
    expect(resolveLawdCode('서울 송파구')).toBe('11710')
  })

  it('앞뒤 공백을 무시한다', () => {
    expect(resolveLawdCode(' 서울 강동구 ')).toBe('11740')
  })

  it('일반구가 있는 시는 도로명주소에서 구를 보완해 매칭한다', () => {
    expect(resolveLawdCode('경기 성남시', '경기 성남시 분당구 판교역로 166')).toBe('41135')
    expect(resolveLawdCode('경기 수원시', '경기 수원시 영통구 광교로 1')).toBe('41117')
  })

  it('일반구가 있는 시인데 주소로 구를 특정할 수 없으면 null', () => {
    expect(resolveLawdCode('경기 성남시')).toBeNull()
    expect(resolveLawdCode('경기 성남시', null)).toBeNull()
  })

  it('같은 구 이름이라도 시도가 다르면 혼동하지 않는다', () => {
    expect(resolveLawdCode('서울 중구')).toBe('11140')
    expect(resolveLawdCode('인천 중구')).toBe('28110')
  })

  it('미지원 지역과 빈 입력은 null', () => {
    expect(resolveLawdCode('부산 해운대구')).toBeNull()
    expect(resolveLawdCode(null)).toBeNull()
    expect(resolveLawdCode(undefined)).toBeNull()
    expect(resolveLawdCode('')).toBeNull()
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd web && npm run test:run -- __tests__/lawdCodes.test.ts`
Expected: FAIL — `Cannot find module '../lib/lawdCodes'` 또는 유사 에러

- [ ] **Step 3: 최소 구현 작성**

`web/lib/lawdCodes.ts`:

```typescript
// 법정동 시군구코드 (법정동코드 앞 5자리) — 수도권만 지원
// 출처: 행정표준코드관리시스템 법정동코드. 미지원 지역은 null 반환 → 외부 링크 폴백
const LAWD_CODES: Record<string, string> = {
  // ── 서울 25개 구 ──
  '서울 종로구': '11110', '서울 중구': '11140', '서울 용산구': '11170',
  '서울 성동구': '11200', '서울 광진구': '11215', '서울 동대문구': '11230',
  '서울 중랑구': '11260', '서울 성북구': '11290', '서울 강북구': '11305',
  '서울 도봉구': '11320', '서울 노원구': '11350', '서울 은평구': '11380',
  '서울 서대문구': '11410', '서울 마포구': '11440', '서울 양천구': '11470',
  '서울 강서구': '11500', '서울 구로구': '11530', '서울 금천구': '11545',
  '서울 영등포구': '11560', '서울 동작구': '11590', '서울 관악구': '11620',
  '서울 서초구': '11650', '서울 강남구': '11680', '서울 송파구': '11710',
  '서울 강동구': '11740',
  // ── 인천 ──
  '인천 중구': '28110', '인천 동구': '28140', '인천 미추홀구': '28177',
  '인천 연수구': '28185', '인천 남동구': '28200', '인천 부평구': '28237',
  '인천 계양구': '28245', '인천 서구': '28260', '인천 강화군': '28710',
  '인천 옹진군': '28720',
  // ── 경기 (일반구가 있는 시는 구 단위 키만 등록 — 시 단위 코드는 API에서 무효) ──
  '경기 수원시 장안구': '41111', '경기 수원시 권선구': '41113',
  '경기 수원시 팔달구': '41115', '경기 수원시 영통구': '41117',
  '경기 성남시 수정구': '41131', '경기 성남시 중원구': '41133',
  '경기 성남시 분당구': '41135',
  '경기 의정부시': '41150',
  '경기 안양시 만안구': '41171', '경기 안양시 동안구': '41173',
  '경기 부천시 원미구': '41192', '경기 부천시 소사구': '41194',
  '경기 부천시 오정구': '41196',
  '경기 광명시': '41210', '경기 평택시': '41220', '경기 동두천시': '41250',
  '경기 안산시 상록구': '41271', '경기 안산시 단원구': '41273',
  '경기 고양시 덕양구': '41281', '경기 고양시 일산동구': '41285',
  '경기 고양시 일산서구': '41287',
  '경기 과천시': '41290', '경기 구리시': '41310', '경기 남양주시': '41360',
  '경기 오산시': '41370', '경기 시흥시': '41390', '경기 군포시': '41410',
  '경기 의왕시': '41430', '경기 하남시': '41450',
  '경기 용인시 처인구': '41461', '경기 용인시 기흥구': '41463',
  '경기 용인시 수지구': '41465',
  '경기 파주시': '41480', '경기 이천시': '41500', '경기 안성시': '41550',
  '경기 김포시': '41570', '경기 화성시': '41590', '경기 광주시': '41610',
  '경기 양주시': '41630', '경기 포천시': '41650', '경기 여주시': '41670',
  '경기 연천군': '41800', '경기 가평군': '41820', '경기 양평군': '41830',
}

/**
 * 시군구명(+도로명주소)을 법정동 시군구코드로 변환.
 * 직접 매칭 실패 시, 키의 모든 어절이 `sigungu + roadAddress` 안에
 * 존재하는 가장 긴 키를 선택한다 (다구 도시의 구 보완 매칭).
 */
export function resolveLawdCode(
  sigungu: string | null | undefined,
  roadAddress?: string | null,
): string | null {
  if (!sigungu?.trim()) return null
  const s = sigungu.trim()
  if (LAWD_CODES[s]) return LAWD_CODES[s]

  const source = `${s} ${roadAddress ?? ''}`
  const matched = Object.keys(LAWD_CODES)
    .filter(key => key.split(' ').every(part => source.includes(part)))
    .sort((a, b) => b.length - a.length)
  return matched.length > 0 ? LAWD_CODES[matched[0]] : null
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd web && npm run test:run -- __tests__/lawdCodes.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add web/lib/lawdCodes.ts web/__tests__/lawdCodes.test.ts
git commit -m "feat: 수도권 시군구 법정동코드 매핑 및 resolveLawdCode 추가"
```

---

### Task 2: 국토부 API 클라이언트 (`lib/molit.ts`)

**Files:**
- Create: `web/lib/molit.ts`
- Test: `web/__tests__/molit.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces (Task 3이 사용):
  - `interface MolitDeal { aptName: string; dealDate: string /* YYYY-MM-DD */; floor: number | null; areaSqm: number | null; priceManwon: number }`
  - `interface DealSummary { count: number; avgPriceManwon: number | null; vsCurrentPct: number | null }`
  - `class MolitApiError extends Error`
  - `parseMolitXml(xml: string): MolitDeal[]` — 에러 응답이면 `MolitApiError` throw
  - `matchesComplex(aptName: string, complexName: string): boolean`
  - `normalizeAptName(name: string): string`
  - `summarizeDeals(deals: MolitDeal[], currentPriceManwon: number | null): DealSummary`
  - `recentMonths(count: number, now?: Date): string[]` — `['202607', '202606', ...]`
  - `fetchMonthDeals(lawdCd: string, dealYm: string): Promise<MolitDeal[]>` — 네트워크 호출 (단위 테스트 제외)

**배경:** 국토부 신규 엔드포인트 `https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade`는 XML을 반환한다 (영문 camelCase 태그: `aptNm`, `dealAmount`, `dealYear`, `dealMonth`, `dealDay`, `excluUseAr`, `floor`, `cdealType`). `dealAmount`는 `" 84,000"` 형태의 만원 단위 문자열. `cdealType`이 `'O'`이면 해제(취소)된 거래이므로 제외한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`web/__tests__/molit.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  parseMolitXml, normalizeAptName, matchesComplex,
  summarizeDeals, recentMonths, MolitApiError,
} from '../lib/molit'

const OK_XML = `<?xml version="1.0" encoding="UTF-8"?>
<response>
  <header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header>
  <body><items>
    <item><aptNm>마포래미안푸르지오</aptNm><dealAmount> 184,000</dealAmount><dealYear>2026</dealYear><dealMonth>6</dealMonth><dealDay>15</dealDay><excluUseAr>84.59</excluUseAr><floor>12</floor></item>
    <item><aptNm>취소된아파트</aptNm><dealAmount>100,000</dealAmount><dealYear>2026</dealYear><dealMonth>6</dealMonth><dealDay>2</dealDay><cdealType>O</cdealType></item>
    <item><aptNm>층없는아파트</aptNm><dealAmount>50,000</dealAmount><dealYear>2026</dealYear><dealMonth>5</dealMonth><dealDay>3</dealDay></item>
  </items></body>
</response>`

const EMPTY_XML = `<?xml version="1.0" encoding="UTF-8"?>
<response><header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header><body><items></items></body></response>`

const AUTH_ERROR_XML = `<OpenAPI_ServiceResponse><cmmMsgHeader><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg><returnReasonCode>30</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>`

describe('parseMolitXml', () => {
  it('거래 항목을 파싱한다', () => {
    const deals = parseMolitXml(OK_XML)
    expect(deals).toHaveLength(2)
    expect(deals[0]).toEqual({
      aptName: '마포래미안푸르지오',
      dealDate: '2026-06-15',
      floor: 12,
      areaSqm: 84.59,
      priceManwon: 184000,
    })
  })

  it('해제(취소) 거래는 제외한다', () => {
    const names = parseMolitXml(OK_XML).map(d => d.aptName)
    expect(names).not.toContain('취소된아파트')
  })

  it('층/면적이 없으면 null로 파싱한다', () => {
    const deal = parseMolitXml(OK_XML).find(d => d.aptName === '층없는아파트')
    expect(deal?.floor).toBeNull()
    expect(deal?.areaSqm).toBeNull()
  })

  it('빈 결과는 빈 배열', () => {
    expect(parseMolitXml(EMPTY_XML)).toEqual([])
  })

  it('인증 오류 응답이면 MolitApiError를 던진다', () => {
    expect(() => parseMolitXml(AUTH_ERROR_XML)).toThrow(MolitApiError)
    expect(() => parseMolitXml(AUTH_ERROR_XML)).toThrow(/SERVICE_KEY/)
  })
})

describe('normalizeAptName / matchesComplex', () => {
  it('공백·괄호·특수문자를 제거해 정규화한다', () => {
    expect(normalizeAptName('마포 래미안-푸르지오 (1단지)')).toBe('마포래미안푸르지오')
  })

  it('부분일치를 허용한다 (양방향)', () => {
    expect(matchesComplex('래미안푸르지오', '마포래미안푸르지오')).toBe(true)
    expect(matchesComplex('마포래미안푸르지오', '래미안푸르지오')).toBe(true)
  })

  it('무관한 단지는 매칭하지 않는다', () => {
    expect(matchesComplex('송파헬리오시티', '마포래미안푸르지오')).toBe(false)
  })

  it('빈 문자열은 매칭하지 않는다', () => {
    expect(matchesComplex('', '마포래미안푸르지오')).toBe(false)
  })
})

describe('summarizeDeals', () => {
  const deals = [
    { aptName: 'a', dealDate: '2026-06-01', floor: 1, areaSqm: 84, priceManwon: 80000 },
    { aptName: 'a', dealDate: '2026-05-01', floor: 2, areaSqm: 84, priceManwon: 90000 },
  ]

  it('건수·평균가·현재가 대비 %를 계산한다', () => {
    const s = summarizeDeals(deals, 90000)
    expect(s.count).toBe(2)
    expect(s.avgPriceManwon).toBe(85000)
    expect(s.vsCurrentPct).toBeCloseTo(5.9, 1)
  })

  it('현재가가 없으면 vsCurrentPct는 null', () => {
    expect(summarizeDeals(deals, null).vsCurrentPct).toBeNull()
  })

  it('거래가 없으면 모두 null/0', () => {
    expect(summarizeDeals([], 90000)).toEqual({ count: 0, avgPriceManwon: null, vsCurrentPct: null })
  })
})

describe('recentMonths', () => {
  it('현재 월부터 과거로 YYYYMM 목록을 만든다', () => {
    expect(recentMonths(3, new Date(2026, 6, 13))).toEqual(['202607', '202606', '202605'])
  })

  it('연도 경계를 넘는다', () => {
    expect(recentMonths(3, new Date(2026, 0, 5))).toEqual(['202601', '202512', '202511'])
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd web && npm run test:run -- __tests__/molit.test.ts`
Expected: FAIL — `Cannot find module '../lib/molit'`

- [ ] **Step 3: 최소 구현 작성**

`web/lib/molit.ts`:

```typescript
// 국토교통부 아파트 매매 실거래가 API 클라이언트
// 엔드포인트는 XML만 반환하므로 의존성 없이 정규식으로 파싱한다

export interface MolitDeal {
  aptName: string
  dealDate: string // 'YYYY-MM-DD'
  floor: number | null
  areaSqm: number | null
  priceManwon: number
}

export interface DealSummary {
  count: number
  avgPriceManwon: number | null
  vsCurrentPct: number | null
}

export class MolitApiError extends Error {}

const MOLIT_ENDPOINT =
  'https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade'
const FETCH_TIMEOUT_MS = 8000
const SUCCESS_CODES = ['000', '00']

function tagValue(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))
  const value = m?.[1].trim()
  return value ? value : null
}

export function parseMolitXml(xml: string): MolitDeal[] {
  const resultCode = tagValue(xml, 'resultCode')
  if (!resultCode || !SUCCESS_CODES.includes(resultCode)) {
    const msg =
      tagValue(xml, 'resultMsg') ?? tagValue(xml, 'returnAuthMsg') ?? '알 수 없는 오류'
    throw new MolitApiError(`국토부 API 오류: ${msg}`)
  }

  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? []
  const deals: MolitDeal[] = []
  for (const block of items) {
    if (tagValue(block, 'cdealType') === 'O') continue // 해제(취소)된 거래
    const aptName = tagValue(block, 'aptNm')
    const amountRaw = tagValue(block, 'dealAmount')
    const year = tagValue(block, 'dealYear')
    const month = tagValue(block, 'dealMonth')
    if (!aptName || !amountRaw || !year || !month) continue

    const priceManwon = Number(amountRaw.replace(/,/g, ''))
    if (!Number.isFinite(priceManwon) || priceManwon <= 0) continue

    const day = tagValue(block, 'dealDay') ?? '1'
    const floorRaw = tagValue(block, 'floor')
    const areaRaw = tagValue(block, 'excluUseAr')
    deals.push({
      aptName,
      dealDate: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
      floor: floorRaw !== null ? Number(floorRaw) : null,
      areaSqm: areaRaw !== null ? Number(areaRaw) : null,
      priceManwon,
    })
  }
  return deals
}

export function normalizeAptName(name: string): string {
  return name
    .replace(/\([^)]*\)/g, '')
    .replace(/[^가-힣a-zA-Z0-9]/g, '')
    .toLowerCase()
}

export function matchesComplex(aptName: string, complexName: string): boolean {
  const a = normalizeAptName(aptName)
  const c = normalizeAptName(complexName)
  if (!a || !c) return false
  return a.includes(c) || c.includes(a)
}

export function summarizeDeals(
  deals: MolitDeal[],
  currentPriceManwon: number | null,
): DealSummary {
  if (deals.length === 0) return { count: 0, avgPriceManwon: null, vsCurrentPct: null }
  const avg = deals.reduce((sum, d) => sum + d.priceManwon, 0) / deals.length
  const vsCurrentPct =
    currentPriceManwon && currentPriceManwon > 0
      ? Math.round(((currentPriceManwon - avg) / avg) * 1000) / 10
      : null
  return { count: deals.length, avgPriceManwon: Math.round(avg), vsCurrentPct }
}

export function recentMonths(count: number, now: Date = new Date()): string[] {
  const months: string[] = []
  const cursor = new Date(now.getFullYear(), now.getMonth(), 1)
  for (let i = 0; i < count; i++) {
    months.push(`${cursor.getFullYear()}${String(cursor.getMonth() + 1).padStart(2, '0')}`)
    cursor.setMonth(cursor.getMonth() - 1)
  }
  return months
}

export async function fetchMonthDeals(lawdCd: string, dealYm: string): Promise<MolitDeal[]> {
  const key = process.env.MOLIT_API_KEY
  if (!key) throw new MolitApiError('MOLIT_API_KEY가 설정되지 않았습니다')
  const url = `${MOLIT_ENDPOINT}?serviceKey=${encodeURIComponent(key)}&LAWD_CD=${lawdCd}&DEAL_YMD=${dealYm}&numOfRows=1000&pageNo=1`
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!res.ok) throw new MolitApiError(`국토부 API HTTP ${res.status}`)
  return parseMolitXml(await res.text())
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd web && npm run test:run -- __tests__/molit.test.ts`
Expected: PASS (14 tests)

- [ ] **Step 5: 커밋**

```bash
git add web/lib/molit.ts web/__tests__/molit.test.ts
git commit -m "feat: 국토부 실거래가 API 클라이언트 (XML 파싱·단지명 매칭·요약)"
```

---

### Task 3: 캐시 마이그레이션 + 조회 API 라우트

**Files:**
- Create: `supabase/migrations/015_molit_deals_cache.sql`
- Create: `web/app/api/properties/[id]/transactions/route.ts`

**Interfaces:**
- Consumes: `resolveLawdCode` (Task 1), `fetchMonthDeals`/`matchesComplex`/`recentMonths`/`summarizeDeals`/`MolitApiError`/`MolitDeal` (Task 2), `createServerClient` (`web/lib/supabase.ts`, 기존)
- Produces: `GET /api/properties/[id]/transactions` → 성공 시 `{ deals: MolitDeal[], summary: DealSummary, months: number }`, 실패 시 `{ error: string }` — Task 4의 프론트엔드가 사용

**주의:** 캐시 테이블이 아직 없어도 기능이 동작해야 한다 (캐시 조회/저장 실패는 무시하고 API 직접 조회). 마이그레이션은 파일만 만들고 적용은 사용자가 수동으로 한다.

- [ ] **Step 1: 마이그레이션 파일 작성**

`supabase/migrations/015_molit_deals_cache.sql`:

```sql
-- 국토부 실거래가 조회 캐시: (시군구 법정동코드, 거래년월) 단위로 원본 거래 전체를 저장
-- TTL(24시간) 판단은 애플리케이션(fetched_at 비교)에서 수행
CREATE TABLE IF NOT EXISTS molit_deals_cache (
  lawd_cd    text NOT NULL,
  deal_ym    text NOT NULL,
  deals      jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lawd_cd, deal_ym)
);

-- 서버(service_role)만 접근: RLS 활성화 + 정책 없음 = anon/authenticated 차단
ALTER TABLE molit_deals_cache ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: API 라우트 작성**

`web/app/api/properties/[id]/transactions/route.ts`:

```typescript
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { resolveLawdCode } from '@/lib/lawdCodes'
import {
  fetchMonthDeals, matchesComplex, recentMonths, summarizeDeals,
  MolitApiError, type MolitDeal,
} from '@/lib/molit'

export const dynamic = 'force-dynamic'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const LOOKBACK_MONTHS = 6
const MAX_DEALS = 30

type Db = ReturnType<typeof createServerClient>

async function getMonthDealsCached(db: Db, lawdCd: string, dealYm: string): Promise<MolitDeal[]> {
  // 캐시는 최적화 수단일 뿐이므로 테이블 부재 등 캐시 계층 오류는 API 직접 조회로 폴백
  const { data: cached } = await db
    .from('molit_deals_cache')
    .select('deals, fetched_at')
    .eq('lawd_cd', lawdCd)
    .eq('deal_ym', dealYm)
    .maybeSingle()

  if (cached && Date.now() - new Date(cached.fetched_at).getTime() < CACHE_TTL_MS) {
    return cached.deals as MolitDeal[]
  }

  const deals = await fetchMonthDeals(lawdCd, dealYm)
  await db.from('molit_deals_cache').upsert({
    lawd_cd: lawdCd,
    deal_ym: dealYm,
    deals,
    fetched_at: new Date().toISOString(),
  })
  return deals
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!process.env.MOLIT_API_KEY) {
    return Response.json({ error: '실거래가 조회가 설정되지 않았습니다' }, { status: 503 })
  }

  const db = createServerClient()
  const { data: property, error } = await db
    .from('properties')
    .select('id, price, complexes(name, sigungu, road_address)')
    .eq('id', id)
    .single()
  if (error || !property) return Response.json({ error: 'not found' }, { status: 404 })

  const complex = property.complexes as unknown as
    { name: string; sigungu: string; road_address: string | null } | null
  if (!complex?.name) {
    return Response.json({ error: '단지 정보가 없는 매물입니다' }, { status: 404 })
  }

  const lawdCd = resolveLawdCode(complex.sigungu, complex.road_address)
  if (!lawdCd) {
    return Response.json({ error: '지원하지 않는 지역입니다' }, { status: 422 })
  }

  try {
    const monthly = await Promise.all(
      recentMonths(LOOKBACK_MONTHS).map(m => getMonthDealsCached(db, lawdCd, m)),
    )
    const matched = monthly
      .flat()
      .filter(d => matchesComplex(d.aptName, complex.name))
      .sort((a, b) => b.dealDate.localeCompare(a.dealDate))

    return Response.json({
      deals: matched.slice(0, MAX_DEALS),
      summary: summarizeDeals(matched, property.price ?? null),
      months: LOOKBACK_MONTHS,
    })
  } catch (e: unknown) {
    const message = e instanceof MolitApiError
      ? e.message
      : '실거래가 조회에 실패했습니다. 잠시 후 다시 시도해 주세요.'
    return Response.json({ error: message }, { status: 502 })
  }
}
```

- [ ] **Step 3: 타입 체크로 검증**

Run: `cd web && npx tsc --noEmit`
Expected: 에러 없음 (기존 에러가 있다면 이 라우트 관련 에러가 없는지만 확인)

- [ ] **Step 4: 커밋**

```bash
git add supabase/migrations/015_molit_deals_cache.sql "web/app/api/properties/[id]/transactions/route.ts"
git commit -m "feat: 단지 실거래가 조회 API 라우트 + molit_deals_cache 마이그레이션"
```

---

### Task 4: 인라인 펼침 UI + 페이지 연결

**Files:**
- Create: `web/components/properties/TransactionHistorySection.tsx`
- Modify: `web/components/properties/PriceComparisonSection.tsx` (Props 인터페이스 + 공공 데이터 블록)
- Modify: `web/app/properties/[id]/page.tsx:424` 부근 (`PriceComparisonSection` 호출부)

**Interfaces:**
- Consumes: `GET /api/properties/[id]/transactions` (Task 3), `resolveLawdCode` (Task 1), `formatPrice` (`web/lib/formatPrice.ts`, 기존)
- Produces: `<TransactionHistorySection propertyId={string} />` (클라이언트 컴포넌트), `PriceComparisonSection`에 `showTransactions?: boolean` prop 추가

- [ ] **Step 1: 클라이언트 컴포넌트 작성**

`web/components/properties/TransactionHistorySection.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { formatPrice } from '@/lib/formatPrice'

const SQM_PER_PYEONG = 3.3058
const MAX_ROWS = 15

interface Deal {
  aptName: string
  dealDate: string
  floor: number | null
  areaSqm: number | null
  priceManwon: number
}

interface Summary {
  count: number
  avgPriceManwon: number | null
  vsCurrentPct: number | null
}

type Status = 'idle' | 'loading' | 'loaded' | 'error'

export default function TransactionHistorySection({ propertyId }: { propertyId: string }) {
  const [status, setStatus] = useState<Status>('idle')
  const [deals, setDeals] = useState<Deal[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  async function load() {
    setStatus('loading')
    try {
      const res = await fetch(`/api/properties/${propertyId}/transactions`)
      const json = await res.json()
      if (!res.ok) {
        setErrorMsg(json.error ?? '조회에 실패했습니다')
        setStatus('error')
        return
      }
      setDeals(json.deals)
      setSummary(json.summary)
      setStatus('loaded')
    } catch {
      setErrorMsg('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.')
      setStatus('error')
    }
  }

  if (status === 'idle' || status === 'loading') {
    return (
      <button
        onClick={load}
        disabled={status === 'loading'}
        className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold px-3 py-2.5 hover:bg-indigo-700 transition-colors disabled:opacity-60"
      >
        {status === 'loading' ? '실거래가 조회 중...' : '⚡ 이 단지 실거래가 바로보기'}
      </button>
    )
  }

  if (status === 'error') {
    return (
      <div className="rounded-xl bg-red-50 border border-red-100 px-3 py-2.5 space-y-1">
        <p className="text-xs text-red-500">{errorMsg}</p>
        <button onClick={load} className="text-[10px] text-red-400 underline">다시 시도</button>
      </div>
    )
  }

  if (deals.length === 0) {
    return (
      <div className="rounded-xl bg-white border border-gray-200 px-3 py-2.5">
        <p className="text-xs text-gray-500">최근 6개월 내 이 단지의 실거래 내역이 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-white border border-gray-200 p-3 space-y-2.5">
      {summary?.avgPriceManwon != null && (
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-800">
            최근 6개월 {summary.count}건 · 평균 {formatPrice(summary.avgPriceManwon)}
          </p>
          {summary.vsCurrentPct !== null && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${summary.vsCurrentPct > 0 ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-600'}`}>
              현재가 {summary.vsCurrentPct > 0 ? '+' : ''}{summary.vsCurrentPct}%
            </span>
          )}
        </div>
      )}
      <div className="space-y-1">
        {deals.slice(0, MAX_ROWS).map((d, i) => (
          <div key={i} className="flex items-center justify-between text-xs border-b border-gray-50 last:border-0 py-1.5">
            <div className="flex gap-2 text-gray-500">
              <span>{d.dealDate.slice(0, 7).replace('-', '.')}</span>
              {d.floor !== null && <span>{d.floor}층</span>}
              {d.areaSqm !== null && <span>{Math.round(d.areaSqm / SQM_PER_PYEONG)}평</span>}
            </div>
            <span className="font-bold text-gray-900">{formatPrice(d.priceManwon)}</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-gray-400">국토교통부 실거래가 공개시스템 제공</p>
    </div>
  )
}
```

- [ ] **Step 2: PriceComparisonSection에 삽입**

`web/components/properties/PriceComparisonSection.tsx` 수정 — 3곳:

(a) 상단 import 추가 (`import Link from 'next/link'` 아래):

```typescript
import TransactionHistorySection from './TransactionHistorySection'
```

(b) `Props` 인터페이스에 필드 추가:

```typescript
interface Props {
  currentId: string; currentPrice: number | null; currentSqm: number | null; currentFloor: number | null
  sameComplex: SameComplexProp[]; nearbyProps: NearbyProp[]; sigungu: string | null; complexName: string | null
  showTransactions?: boolean
}
```

함수 시그니처의 구조분해에도 `showTransactions = false` 추가:

```typescript
export default function PriceComparisonSection({
  currentId, currentPrice, currentSqm, currentFloor,
  sameComplex, nearbyProps, sigungu, complexName,
  showTransactions = false,
}: Props) {
```

(c) `{/* 공공 데이터 */}` 블록에서 `<p className="text-xs font-semibold text-gray-600">실거래가 · 공시지가 공공 데이터</p>` 바로 아래에 삽입:

```tsx
{showTransactions && <TransactionHistorySection propertyId={currentId} />}
```

- [ ] **Step 3: 페이지에서 노출 조건 계산**

`web/app/properties/[id]/page.tsx` 수정 — 2곳:

(a) 상단에 import 추가:

```typescript
import { resolveLawdCode } from '@/lib/lawdCodes'
```

(b) `<PriceComparisonSection ...>` 호출부(424행 부근)에 prop 추가:

```tsx
<PriceComparisonSection
  currentId={id}
  currentPrice={property.price ?? null}
  currentSqm={property.area_sqm ?? null}
  currentFloor={property.floor ?? null}
  sameComplex={nearbyData.sameComplex}
  nearbyProps={nearbyData.nearbyProps}
  sigungu={sigungu}
  complexName={complex?.name ?? null}
  showTransactions={
    Boolean(process.env.MOLIT_API_KEY) &&
    !!complex?.name &&
    resolveLawdCode(complex?.sigungu ?? null, complex?.road_address ?? null) !== null
  }
/>
```

- [ ] **Step 4: 전체 테스트 + 빌드 검증**

Run: `cd web && npm run test:run`
Expected: 전체 PASS (기존 테스트 + 신규 20개)

Run: `cd web && npm run build`
Expected: 빌드 성공

- [ ] **Step 5: 커밋**

```bash
git add web/components/properties/TransactionHistorySection.tsx web/components/properties/PriceComparisonSection.tsx "web/app/properties/[id]/page.tsx"
git commit -m "feat: 매물 상세에 단지 실거래가 인라인 조회 UI 추가"
```

---

### Task 5: 배포 준비 및 사용자 작업 안내

**Files:** 없음 (운영 작업)

**Interfaces:**
- Consumes: Task 1~4 전체
- Produces: 프로덕션 동작 상태

- [ ] **Step 1: push**

```bash
git push origin main
```

- [ ] **Step 2: 사용자에게 수동 작업 안내** (구현자가 대신할 수 없는 작업 — 완료 보고에 포함할 것)

1. **API 키 발급**: data.go.kr → "국토교통부_아파트 매매 실거래가 자료" 검색 → 활용신청 (즉시 승인) → 마이페이지에서 **일반 인증키(Decoding)** 복사
2. **환경변수 등록**: `web/.env.local`에 `MOLIT_API_KEY=<키>` 추가 + Vercel 프로젝트 환경변수에 동일하게 추가 후 재배포
3. **마이그레이션 적용**: Supabase SQL 에디터에서 `supabase/migrations/015_molit_deals_cache.sql` 내용 실행 (미적용 시에도 기능은 동작하나 매 조회마다 국토부 API를 호출)

- [ ] **Step 3: 동작 확인** (키 등록 후)

로컬에서 `cd web && npm run dev` → 서울/경기 매물 상세 페이지 → "⚡ 이 단지 실거래가 바로보기" 클릭 → 거래 내역 표시 확인. 같은 시군구 매물에서 재클릭 시 캐시 히트(빠른 응답) 확인.
