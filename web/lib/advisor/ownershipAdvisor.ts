import { compareOwnershipPropertyTax, type OwnershipTaxComparison } from './propertyTax'
import type { AdvisorProfile, RecommendationCard, ComparisonTable } from './types'
import { formatPrice } from '../formatPrice'

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
      ? `공동명의(인별과세) 시 종부세 공제가 1인당 9억씩 총 18억으로 단독명의(12억)보다 유리해, 연 ${formatPrice(propertyTax.savings)} 절약 추정`
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
            sole: formatPrice(propertyTax.soleOrSpecialOwnership.propertyTax),
            joint: formatPrice(propertyTax.jointIndividual.propertyTax),
          },
        },
      ],
    },
    propertyTax,
  }
}
