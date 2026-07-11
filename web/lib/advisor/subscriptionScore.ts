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
