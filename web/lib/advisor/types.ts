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
