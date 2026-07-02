import { createServerClient } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatPrice } from '@/lib/formatPrice'
import EligibilityBadge from '@/components/properties/EligibilityBadge'
import SubscriptionCountdown from '@/components/properties/SubscriptionCountdown'
import KakaoMapWrapper from '@/components/properties/KakaoMapWrapper'
import LoanEligibilityPanel from '@/components/properties/LoanEligibilityPanel'
import TotalCostCard from '@/components/properties/TotalCostCard'
import RegulationNotice from '@/components/properties/RegulationNotice'
import SubscriptionScoreCard from '@/components/properties/SubscriptionScoreCard'
import LocationEnvironmentCard from '@/components/properties/LocationEnvironmentCard'
import { calcLoanProducts, type UserFinance } from '@/lib/koreanRealEstate'

export const dynamic = 'force-dynamic'

const TYPE_LABEL: Record<string, string> = { sale: '매매', auction: '경매', subscription: '청약' }
const PREF_ID = '00000000-0000-0000-0000-000000000001'

// 네이버 부동산은 /search?query= 만 지원 — 타입 무관하게 단지명 검색
function getNaverUrl(complexName: string): string {
  return `https://new.land.naver.com/search?query=${encodeURIComponent(complexName)}`
}

const NAVER_BUTTON_LABEL: Record<string, string> = {
  auction:      '네이버 부동산에서 단지 검색 (경매 탭 확인)',
  subscription: '네이버 부동산에서 단지 검색 (분양 탭 확인)',
  sale:         '네이버 부동산에서 단지 검색',
}

async function getProperty(id: string) {
  const db = createServerClient()
  const { data } = await db.from('properties')
    .select('*, complexes(id,name,sigungu,road_address,lat,lng,built_year,total_units,builder,location_scores(*)), property_scores(*)')
    .eq('id', id)
    .single()
  return data as any | null
}

async function getPrefs() {
  try {
    const db = createServerClient()
    const { data } = await db.from('user_preferences').select('*').eq('id', PREF_ID).single()
    return data
  } catch { return null }
}

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [property, prefs] = await Promise.all([getProperty(id), getPrefs()])
  if (!property) notFound()

  const complex = property.complexes
  const score = property.property_scores
  const loc = complex?.location_scores
  const typeLabel = TYPE_LABEL[property.property_type] ?? property.property_type

  // Map prefs to UserFinance
  const finance: UserFinance | null = prefs ? {
    income: prefs.monthly_income ?? 0,
    assets: prefs.assets ?? 0,
    depositToRecover: prefs.deposit_to_recover ?? 0,
    giftAmount: prefs.gift_amount ?? 0,
    existingLoanPayment: prefs.existing_loan_payment ?? 0,
    isNewlywed: prefs.is_newlywed ?? false,
    isFirstBuyer: prefs.is_first_buyer ?? false,
    noHomeYears: prefs.no_home_years ?? 0,
    numChildren: prefs.num_children ?? 0,
  } : null

  // Compute best loan for TotalCostCard
  const price = property.price ?? 0
  const sigungu = complex?.sigungu ?? null
  let effectiveLoan = 0
  if (finance && price > 0) {
    const products = calcLoanProducts(price, finance, sigungu)
    const best = products.find(p => p.eligible)
    if (best) effectiveLoan = best.calcLoan(price)
  }
  const selfFunds = finance
    ? (finance.assets + finance.depositToRecover + finance.giftAmount)
    : 0
  const renovationBudget = prefs?.renovation_budget ?? 0

  const scoreItems = score
    ? [
        { label: '가격', value: score.price_score ?? 0, max: 20 },
        { label: '입지', value: score.location_score ?? 0, max: 25 },
        { label: '단지', value: score.complex_score ?? 0, max: 20 },
        { label: '수요', value: score.demand_score ?? 0, max: 20 },
        { label: '규제', value: score.regulatory_score ?? 0, max: 15 },
      ]
    : []

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* 뒤로가기 + 헤더 */}
      <div>
        <Link href="/properties" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← 매물 목록
        </Link>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {complex?.name ?? property.title ?? '매물'}
            </h1>
            {complex?.sigungu && (
              <p className="text-sm text-gray-500 mt-0.5">{complex.sigungu}</p>
            )}
          </div>
          <span className="shrink-0 px-2 py-0.5 rounded bg-gray-100 text-sm text-gray-600">
            {typeLabel}
          </span>
        </div>
        <EligibilityBadge propertyType={property.property_type} price={property.price} />
      </div>

      {/* 기본 정보 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {property.price && (
          <div className="rounded-lg border p-3">
            <p className="text-xs text-gray-400">가격</p>
            <p className="font-semibold mt-0.5 text-sm">{formatPrice(property.price)}</p>
          </div>
        )}
        {property.area_sqm && (
          <div className="rounded-lg border p-3">
            <p className="text-xs text-gray-400">전용면적</p>
            <p className="font-semibold mt-0.5 text-sm">{Number(property.area_sqm).toFixed(1)}m²</p>
          </div>
        )}
        {property.floor && (
          <div className="rounded-lg border p-3">
            <p className="text-xs text-gray-400">층</p>
            <p className="font-semibold mt-0.5 text-sm">{property.floor}층</p>
          </div>
        )}
        {complex?.built_year && (
          <div className="rounded-lg border p-3">
            <p className="text-xs text-gray-400">준공연도</p>
            <p className="font-semibold mt-0.5 text-sm">{complex.built_year}년</p>
          </div>
        )}
      </div>

      {/* 규제 안내 */}
      <RegulationNotice sigungu={complex?.sigungu} />

      {/* 청약 일정 */}
      {property.property_type === 'subscription' &&
        (property.subscription_start || property.subscription_end) && (
          <div className="rounded-xl bg-green-50 border border-green-200 p-4 space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-green-800">청약 일정</p>
              {property.subscription_end && (
                <SubscriptionCountdown endDate={property.subscription_end} />
              )}
            </div>
            {property.subscription_start && (
              <p className="text-sm text-green-700">
                접수 시작: {new Date(property.subscription_start).toLocaleDateString('ko-KR')}
              </p>
            )}
            {property.subscription_end && (
              <p className="text-sm text-green-700">
                접수 마감: {new Date(property.subscription_end).toLocaleDateString('ko-KR')}
              </p>
            )}
          </div>
        )}

      {/* 경매 정보 */}
      {property.property_type === 'auction' && property.auction_date && (
        <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-4 space-y-1">
          <p className="text-sm font-semibold text-yellow-800">경매 정보</p>
          <p className="text-sm text-yellow-700">
            경매일: {new Date(property.auction_date).toLocaleDateString('ko-KR')}
          </p>
          {property.bid_count > 0 && (
            <p className="text-sm text-yellow-700">응찰 횟수: {property.bid_count}회</p>
          )}
        </div>
      )}

      {/* 대출 적격성 분석 */}
      {price > 0 && <LoanEligibilityPanel price={price} finance={finance} sigungu={sigungu} />}

      {/* 총 소요 비용 */}
      {price > 0 && (
        <TotalCostCard
          price={price}
          isFirstBuyer={finance?.isFirstBuyer ?? false}
          selfFunds={selfFunds}
          renovationBudget={renovationBudget}
          effectiveLoan={effectiveLoan}
        />
      )}

      {/* 청약 가점 (청약 타입 + 내 정보 있을 때만) */}
      {property.property_type === 'subscription' && finance && (
        <SubscriptionScoreCard
          noHomeYears={finance.noHomeYears}
          numChildren={finance.numChildren}
          isNewlywed={finance.isNewlywed}
        />
      )}

      {/* AI 점수 */}
      {score && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">AI 분석 점수</h2>
            <span className="text-2xl font-bold text-indigo-600">{score.total_score}점</span>
          </div>

          <div className="space-y-2.5">
            {scoreItems.map(item => (
              <div key={item.label} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-8 shrink-0">{item.label}</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all"
                    style={{ width: `${Math.round((item.value / item.max) * 100)}%` }}
                  />
                </div>
                <span className="text-xs font-medium w-10 text-right text-gray-700">
                  {item.value}/{item.max}
                </span>
              </div>
            ))}
          </div>

          {score.ai_summary && (
            <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-lg p-3">
              {score.ai_summary}
            </p>
          )}

          {score.personalized_reason && (
            <p className="text-sm text-indigo-700 bg-indigo-50 rounded-lg p-3">
              💡 {score.personalized_reason}
            </p>
          )}

          {((score.pros?.length ?? 0) > 0 || (score.cons?.length ?? 0) > 0) && (
            <div className="grid grid-cols-2 gap-4">
              {score.pros?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">장점</p>
                  <ul className="space-y-1.5">
                    {(score.pros as string[]).map((p: string, i: number) => (
                      <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                        <span className="text-green-500 shrink-0 mt-0.5">+</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {score.cons?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">단점</p>
                  <ul className="space-y-1.5">
                    {(score.cons as string[]).map((c: string, i: number) => (
                      <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                        <span className="text-red-400 shrink-0 mt-0.5">−</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* 위치 + 주변 환경 통합 섹션 */}
      {complex?.lat && complex?.lng && (
        <section className="space-y-4">
          <div>
            <h2 className="font-semibold text-gray-800">위치</h2>
            {complex.road_address && (
              <p className="text-sm text-gray-500 mt-0.5">{complex.road_address}</p>
            )}
          </div>
          <KakaoMapWrapper
            lat={Number(complex.lat)}
            lng={Number(complex.lng)}
            name={complex.name}
            locationInfo={loc ? {
              nearest_subway: loc.nearest_subway,
              nearest_subway_min: loc.nearest_subway_min,
              mart_min: loc.mart_min,
              hospital_min: loc.hospital_min,
              park_min: loc.park_min,
              school_count_1km: loc.school_count_1km,
            } : null}
          />
        </section>
      )}

      {/* 주변 환경 상세 */}
      {loc && <LocationEnvironmentCard loc={loc} />}

      {/* 원문 링크 — 매물 타입별 네이버 부동산 탭으로 직접 이동 */}
      {complex?.name && (
        <a
          href={getNaverUrl(complex.name)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
        >
          {NAVER_BUTTON_LABEL[property.property_type] ?? '네이버 부동산에서 보기'} →
        </a>
      )}
    </main>
  )
}
