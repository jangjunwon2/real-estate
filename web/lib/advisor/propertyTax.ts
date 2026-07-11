import { PROPERTY_TAX } from '../regulations'

function progressiveTax(base: number, brackets: readonly { maxBase: number; rate: number }[]): number {
  let tax = 0
  let prev = 0
  for (const b of brackets) {
    if (base <= prev) break
    const taxableInBracket = Math.min(base, b.maxBase) - prev
    tax += taxableInBracket * b.rate
    prev = b.maxBase
  }
  return Math.round(tax)
}

/** 매매가 대비 공시가격 비율 추정치(65~70%의 중간값 67%)로 공시가격을 추정한다. */
export function estimateOfficialPrice(marketPrice: number): number {
  return Math.round(marketPrice * 0.67)
}

/** 공시가격 합계, 공제액, 보유주택수를 받아 종합부동산세를 계산한다 (만원 단위). */
export function calcPropertyTax(
  officialPriceTotal: number,
  deduction: number,
  houseCount: 1 | 2 | 3 = 1,
): number {
  const base = Math.max(0, (officialPriceTotal - deduction) * PROPERTY_TAX.fairMarketValueRatio)
  const brackets = houseCount >= 3 ? PROPERTY_TAX.rates.multiHouse3plus : PROPERTY_TAX.rates.general
  return progressiveTax(base, brackets)
}

export interface OwnershipTaxComparison {
  soleOrSpecialOwnership: { propertyTax: number; label: string }
  jointIndividual: { propertyTax: number; label: string }
  recommended: 'soleOrSpecial' | 'jointIndividual'
  savings: number
}

/**
 * 단독명의(또는 공동명의+1세대1주택자 특례, 12억 공제)와 공동명의 인별과세(9억×2=18억 공제)를
 * 비교한다. 고령자·장기보유 세액공제(최대 80%)는 반영하지 않은 보수적 추정치다.
 */
export function compareOwnershipPropertyTax(
  marketPrice: number,
  houseCount: 1 | 2 | 3 = 1,
): OwnershipTaxComparison {
  const officialPrice = estimateOfficialPrice(marketPrice)
  const soleTax = calcPropertyTax(officialPrice, PROPERTY_TAX.deduction.singleHouseSpecial, houseCount)
  const jointIndividualTax = calcPropertyTax(officialPrice, PROPERTY_TAX.deduction.perPerson * 2, houseCount)
  const recommended = jointIndividualTax <= soleTax ? 'jointIndividual' : 'soleOrSpecial'
  return {
    soleOrSpecialOwnership: { propertyTax: soleTax, label: '단독명의 (또는 공동명의 1세대1주택자 특례)' },
    jointIndividual: { propertyTax: jointIndividualTax, label: '공동명의 (인별과세)' },
    recommended,
    savings: Math.abs(soleTax - jointIndividualTax),
  }
}
