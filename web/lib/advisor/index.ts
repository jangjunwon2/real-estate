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
