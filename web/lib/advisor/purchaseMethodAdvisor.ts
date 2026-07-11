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
