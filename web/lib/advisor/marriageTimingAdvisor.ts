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
