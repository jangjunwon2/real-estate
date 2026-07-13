import { createServerClient } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatPrice } from '@/lib/formatPrice'
import EligibilityBadge from '@/components/properties/EligibilityBadge'
import SubscriptionCountdown from '@/components/properties/SubscriptionCountdown'
import KakaoMapWrapper from '@/components/properties/KakaoMapWrapper'
import LoanEligibilityPanel from '@/components/properties/LoanEligibilityPanel'
import PropertyStrategyPanel from '@/components/properties/PropertyStrategyPanel'
import TotalCostCard from '@/components/properties/TotalCostCard'
import RegulationNotice from '@/components/properties/RegulationNotice'
import SubscriptionScoreCard from '@/components/properties/SubscriptionScoreCard'
import LocationEnvironmentCard from '@/components/properties/LocationEnvironmentCard'
import { calcLoanProducts, detectZoneType, type UserFinance } from '@/lib/koreanRealEstate'
import FavoriteButton from '@/components/FavoriteButton'
import ScoreRing from '@/components/properties/ScoreRing'
import PriceComparisonSection, { type SameComplexProp, type NearbyProp } from '@/components/properties/PriceComparisonSection'
import AIPriceForecastCard from '@/components/properties/AIPriceForecastCard'

export const dynamic = 'force-dynamic'

const TYPE_LABEL: Record<string, string> = { sale: '매매', auction: '경매', subscription: '청약' }
const TYPE_COLOR: Record<string, string> = {
  sale: 'bg-indigo-600 text-white',
  auction: 'bg-orange-500 text-white',
  subscription: 'bg-emerald-600 text-white',
}

const SQM_PER_PYEONG = 3.3058

function getExternalLink(propertyType: string, complexName: string) {
  if (propertyType === 'auction') return {
    url: 'https://www.courtauction.go.kr',
    label: '법원 경매 정보 확인 →',
    className: 'bg-orange-500 hover:bg-orange-600 text-white',
  }
  if (propertyType === 'subscription') return {
    url: 'https://www.applyhome.co.kr',
    label: '청약홈에서 공고 확인 →',
    className: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  }
  return {
    url: `https://search.naver.com/search.naver?query=${encodeURIComponent(complexName + ' 아파트')}`,
    label: '네이버 부동산에서 확인 →',
    className: 'bg-green-600 hover:bg-green-700 text-white',
  }
}

async function getProperty(id: string) {
  const db = createServerClient()
  const { data } = await db.from('properties')
    .select('*, complexes(id,name,sigungu,road_address,lat,lng,built_year,total_units,builder,location_scores(*)), property_scores(*)')
    .eq('id', id)
    .single()
  return data as any | null
}

async function getNearbyData(
  complexId: string,
  sigungu: string | null,
  propertyId: string,
  price: number,
): Promise<{ sameComplex: SameComplexProp[]; nearbyProps: NearbyProp[] }> {
  const db = createServerClient()
  const sameComplexQ = db.from('properties')
    .select('id, price, area_sqm, floor, property_type')
    .eq('complex_id', complexId)
    .neq('id', propertyId)
    .not('price', 'is', null)
    .order('area_sqm', { ascending: true })
    .limit(20)

  if (!sigungu) {
    const { data } = await sameComplexQ
    return { sameComplex: (data ?? []) as SameComplexProp[], nearbyProps: [] }
  }
  const [sameResult, sigunguResult] = await Promise.all([
    sameComplexQ,
    db.from('complexes').select('id').eq('sigungu', sigungu).neq('id', complexId).limit(50),
  ])
  const sigunguIds = ((sigunguResult.data ?? []) as { id: string }[]).map(c => c.id)
  let nearbyProps: NearbyProp[] = []
  if (sigunguIds.length > 0) {
    const { data } = await db.from('properties')
      .select('id, price, area_sqm, floor, property_type, complexes(name, sigungu)')
      .in('complex_id', sigunguIds)
      .gte('price', Math.floor(price * 0.7))
      .lte('price', Math.ceil(price * 1.3))
      .not('price', 'is', null)
      .order('price', { ascending: true })
      .limit(6)
    nearbyProps = (data ?? []) as unknown as NearbyProp[]
  }
  return { sameComplex: (sameResult.data ?? []) as SameComplexProp[], nearbyProps }
}

async function getPrefs(userId: string | null) {
  if (!userId) return null
  try {
    const db = createServerClient()
    const { data } = await db.from('user_preferences').select('*').eq('user_id', userId).maybeSingle()
    return data
  } catch { return null }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const property = await getProperty(id)
  if (!property) return {}
  const name = property.complexes?.name ?? property.title ?? '매물'
  const type = TYPE_LABEL[property.property_type] ?? ''
  const sigungu = property.complexes?.sigungu ?? ''
  const title = `${name} ${sigungu ? `(${sigungu})` : ''} — ${type}`
  const description = sigungu
    ? `${sigungu} · ${type}${property.price ? ' · ' + formatPrice(property.price) : ''}`
    : '부동산AI 매물 상세'
  return { title, description, openGraph: { title, description, type: 'website' } }
}

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const db = createServerClient()

  const [property, prefs, favRes] = await Promise.all([
    getProperty(id),
    getPrefs(user?.id ?? null),
    user
      ? db.from('favorites').select('id').eq('user_id', user.id).eq('property_id', id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const favData = (favRes as any)?.data
  const isFavorited = !!favData
  const favoriteId: string | null = favData?.id ?? null
  if (!property) notFound()

  const complexId = property.complexes?.id ?? null
  const sigunguForNearby = property.complexes?.sigungu ?? null
  const priceForNearby = property.price ?? 0
  const nearbyData = complexId && priceForNearby > 0
    ? await getNearbyData(complexId, sigunguForNearby, id, priceForNearby)
    : { sameComplex: [], nearbyProps: [] }

  const complex = property.complexes
  const score = property.property_scores
  const loc = complex?.location_scores
  const typeLabel = TYPE_LABEL[property.property_type] ?? property.property_type
  const typeColor = TYPE_COLOR[property.property_type] ?? 'bg-gray-600 text-white'

  // 세대(본인+배우자) 보유 주택 수 — 유주택자 대출 규제 판정에 사용
  const HOME_COUNT: Record<string, number> = { none: 0, one: 1, multiple: 2 }
  const ownedHomes = prefs
    ? (HOME_COUNT[prefs.self_home_status ?? 'none'] ?? 0) + (HOME_COUNT[prefs.spouse_home_status ?? 'none'] ?? 0)
    : 0

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
    ownedHomes,
    disposalPlanned: prefs.disposal_planned ?? false,
  } : null

  const price = property.price ?? 0
  const sigungu = complex?.sigungu ?? null
  let effectiveLoan = 0
  let bestLoanName = ''
  if (finance && price > 0) {
    const products = calcLoanProducts(price, finance, sigungu)
    const best = products.find(p => p.eligible)
    if (best) { effectiveLoan = best.calcLoan(price); bestLoanName = best.name }
  }
  const selfFunds = finance ? (finance.assets + finance.depositToRecover + finance.giftAmount) : 0
  const renovationBudget = prefs?.renovation_budget ?? 0

  const sqm = property.area_sqm ? Number(property.area_sqm) : null
  const pyeong = sqm ? Math.round(sqm / SQM_PER_PYEONG) : null
  const ppp = price && sqm ? Math.round(price / (sqm / SQM_PER_PYEONG)) : null

  const scoreItems = score ? [
    { label: '가격', value: score.price_score ?? 0, max: 20 },
    { label: '입지', value: score.location_score ?? 0, max: 25 },
    { label: '단지', value: score.complex_score ?? 0, max: 20 },
    { label: '수요', value: score.demand_score ?? 0, max: 20 },
    { label: '규제', value: score.regulatory_score ?? 0, max: 15 },
  ] : []

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">

      {/* ── HERO ── */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-50 via-white to-indigo-50/60 border border-gray-200 overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 pt-5 pb-0">
          <Link href="/properties" className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
            ← 매물 목록
          </Link>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${typeColor}`}>{typeLabel}</span>
            {user && <FavoriteButton propertyId={id} initialFavorited={isFavorited} initialFavoriteId={favoriteId} />}
          </div>
        </div>

        {/* Name + location */}
        <div className="px-5 pt-4">
          <h1 className="text-2xl font-black text-gray-900 leading-snug">
            {complex?.name ?? property.title ?? '매물'}
          </h1>
          {complex?.sigungu && <p className="text-sm text-gray-500 mt-1">{complex.sigungu}</p>}
        </div>

        {/* Price — BIG */}
        {price > 0 && (
          <div className="px-5 pt-5">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-1.5">매물가</p>
            <p className="text-5xl font-black text-gray-900 tracking-tight leading-none">
              {formatPrice(price)}
            </p>
            {ppp && (
              <p className="text-sm text-gray-500 mt-2">
                평당 <span className="font-bold text-gray-700">{ppp.toLocaleString()}만원</span>
                {sqm && <span className="ml-2 text-gray-400">({sqm.toFixed(1)}m² · {pyeong}평)</span>}
              </p>
            )}
          </div>
        )}

        {/* Loan quick callout */}
        {effectiveLoan > 0 && (
          <div className="mx-5 mt-4 rounded-xl bg-indigo-600 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-indigo-200 font-medium">최대 대출 가능 ({bestLoanName})</p>
              <p className="text-lg font-black text-white mt-0.5">{formatPrice(effectiveLoan)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-indigo-200">실부담금</p>
              <p className="text-sm font-bold text-white">{formatPrice(Math.max(0, price - effectiveLoan))}</p>
            </div>
          </div>
        )}

        {/* Quick stat pills */}
        <div className="px-5 pt-4 pb-5 flex flex-wrap gap-2">
          {property.floor && (
            <span className="bg-white border border-gray-200 shadow-sm rounded-full px-3 py-1.5 text-xs font-semibold text-gray-700">
              {property.floor}층
            </span>
          )}
          {complex?.built_year && (
            <span className="bg-white border border-gray-200 shadow-sm rounded-full px-3 py-1.5 text-xs font-semibold text-gray-700">
              {complex.built_year}년 준공
              {complex.built_year ? ` · ${new Date().getFullYear() - complex.built_year}년차` : ''}
            </span>
          )}
          {complex?.total_units && (
            <span className="bg-white border border-gray-200 shadow-sm rounded-full px-3 py-1.5 text-xs font-semibold text-gray-700">
              총 {complex.total_units.toLocaleString()}세대
            </span>
          )}
          {complex?.builder && (
            <span className="bg-white border border-gray-200 shadow-sm rounded-full px-3 py-1.5 text-xs font-semibold text-gray-700">
              {complex.builder}
            </span>
          )}
        </div>
      </div>

      <EligibilityBadge propertyType={property.property_type} price={property.price} />

      {/* 규제 안내 */}
      <RegulationNotice sigungu={complex?.sigungu} />

      {/* 청약 일정 */}
      {property.property_type === 'subscription' && (property.subscription_start || property.subscription_end) && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-bold text-emerald-800">📅 청약 일정</p>
            {property.subscription_end && <SubscriptionCountdown endDate={property.subscription_end} />}
          </div>
          {property.subscription_start && (
            <p className="text-sm text-emerald-700">접수 시작: {new Date(property.subscription_start).toLocaleDateString('ko-KR')}</p>
          )}
          {property.subscription_end && (
            <p className="text-sm text-emerald-700">접수 마감: {new Date(property.subscription_end).toLocaleDateString('ko-KR')}</p>
          )}
        </div>
      )}

      {/* 경매 정보 */}
      {property.property_type === 'auction' && property.auction_date && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 space-y-2">
          <p className="font-bold text-amber-800">🔨 경매 정보</p>
          <p className="text-sm text-amber-700">경매일: {new Date(property.auction_date).toLocaleDateString('ko-KR')}</p>
          {property.bid_count > 0 && <p className="text-sm text-amber-700">응찰 횟수: {property.bid_count}회</p>}
        </div>
      )}

      {/* 대출 상세 */}
      {price > 0 && <LoanEligibilityPanel price={price} finance={finance} sigungu={sigungu} />}

      {/* 이 매물 기준 What-if 전략 — 조건 변경 시 구매 가능 여부 */}
      {price > 0 && finance && prefs && (
        <PropertyStrategyPanel
          price={price}
          input={{
            finance,
            selfFunds,
            zone: detectZoneType(sigungu),
            buyerType: prefs.buyer_type ?? 'solo',
            marriageStatus: prefs.marriage_status ?? null,
            selfHomeStatus: prefs.self_home_status ?? 'none',
            spouseHomeStatus: prefs.spouse_home_status ?? null,
            incomeSelf: prefs.income_mode === 'individual' ? (prefs.income_self ?? 0) : 0,
            subscriptionAccountYears: prefs.subscription_account_years ?? 0,
            householdHead: prefs.household_head ?? true,
          }}
        />
      )}

      {/* 총 비용 */}
      {price > 0 && (
        <TotalCostCard
          price={price}
          isFirstBuyer={finance?.isFirstBuyer ?? false}
          selfFunds={selfFunds}
          renovationBudget={renovationBudget}
          effectiveLoan={effectiveLoan}
        />
      )}

      {/* 청약 가점 */}
      {property.property_type === 'subscription' && finance && (
        <SubscriptionScoreCard
          noHomeYears={finance.noHomeYears}
          numChildren={finance.numChildren}
          isNewlywed={finance.isNewlywed}
        />
      )}

      {/* ── AI 분석 점수 ── */}
      {score && (
        <section className="rounded-2xl border border-gray-100 p-5 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="font-bold text-gray-800">AI 분석 점수</h2>
              <p className="text-xs text-gray-400">100점 만점 종합 평가</p>
              {score.ai_summary && (
                <p className="text-sm text-gray-600 leading-relaxed mt-2 max-w-xs">{score.ai_summary}</p>
              )}
            </div>
            <ScoreRing score={score.total_score} />
          </div>

          {/* Score bars — color coded */}
          <div className="space-y-2.5">
            {scoreItems.map(item => {
              const pct = (item.value / item.max) * 100
              const barColor =
                pct >= 80 ? 'bg-emerald-500' :
                pct >= 65 ? 'bg-indigo-500' :
                pct >= 45 ? 'bg-amber-400' : 'bg-red-400'
              return (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-8 shrink-0">{item.label}</span>
                  <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${Math.round(pct)}%` }} />
                  </div>
                  <span className="text-xs font-bold w-10 text-right text-gray-700">{item.value}<span className="font-normal text-gray-400">/{item.max}</span></span>
                </div>
              )
            })}
          </div>

          {score.personalized_reason && (
            <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3">
              <p className="text-xs font-semibold text-indigo-500 mb-1">맞춤 분석</p>
              <p className="text-sm text-indigo-800 leading-relaxed">{score.personalized_reason}</p>
            </div>
          )}

          {((score.pros?.length ?? 0) > 0 || (score.cons?.length ?? 0) > 0) && (
            <div className="grid grid-cols-2 gap-3">
              {score.pros?.length > 0 && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 space-y-2">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide">장점</p>
                  <ul className="space-y-1.5">
                    {(score.pros as string[]).map((p: string, i: number) => (
                      <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                        <span className="text-emerald-500 shrink-0 font-bold mt-0.5">+</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {score.cons?.length > 0 && (
                <div className="rounded-xl bg-red-50 border border-red-100 p-3 space-y-2">
                  <p className="text-[10px] font-bold text-red-500 uppercase tracking-wide">단점</p>
                  <ul className="space-y-1.5">
                    {(score.cons as string[]).map((c: string, i: number) => (
                      <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                        <span className="text-red-400 shrink-0 font-bold mt-0.5">−</span>
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── 가격 비교 분석 ── */}
      <PriceComparisonSection
        currentId={id}
        currentPrice={property.price ?? null}
        currentSqm={property.area_sqm ?? null}
        currentFloor={property.floor ?? null}
        sameComplex={nearbyData.sameComplex}
        nearbyProps={nearbyData.nearbyProps}
        sigungu={sigungu}
        complexName={complex?.name ?? null}
      />

      {/* ── AI 시세 전망 ── */}
      {price > 0 && <AIPriceForecastCard propertyId={id} currentPrice={price} />}

      {/* ── 위치 ── */}
      {complex?.lat && complex?.lng && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">📍</span>
            <h2 className="font-bold text-gray-800">위치</h2>
          </div>
          {complex.road_address && (
            <p className="text-sm text-gray-500">{complex.road_address}</p>
          )}
          <KakaoMapWrapper
            lat={Number(complex.lat)} lng={Number(complex.lng)} name={complex.name}
            locationInfo={loc ? {
              nearest_subway: loc.nearest_subway, nearest_subway_min: loc.nearest_subway_min,
              mart_min: loc.mart_min, hospital_min: loc.hospital_min,
              park_min: loc.park_min, school_count_1km: loc.school_count_1km,
            } : null}
          />
        </section>
      )}

      {/* 주변 환경 상세 */}
      {loc && <LocationEnvironmentCard loc={loc} />}

      {/* ── 외부 링크 ── */}
      {complex?.name && (() => {
        const ext = getExternalLink(property.property_type, complex.name)
        return (
          <div className="flex flex-col gap-2 pt-2">
            <a href={ext.url} target="_blank" rel="noopener noreferrer"
              className={`flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-bold text-sm transition-colors ${ext.className}`}>
              {ext.label}
            </a>
            {complex.lat && complex.lng && (
              <a href={`https://map.kakao.com/link/map/${encodeURIComponent(complex.name)},${Number(complex.lat)},${Number(complex.lng)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-yellow-400 text-gray-900 font-bold text-sm hover:bg-yellow-300 transition-colors">
                카카오맵에서 위치 보기 →
              </a>
            )}
          </div>
        )
      })()}
    </main>
  )
}
