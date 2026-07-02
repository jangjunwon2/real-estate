/**
 * 만원 단위 금액을 "N억 N천만원" 형태로 변환
 * 1억 미만은 "N,NNN만원" 그대로 반환
 */
export function formatPrice(manwon: number): string {
  if (manwon <= 0) return '0만원'

  const eok = Math.floor(manwon / 10000)
  const remainder = manwon % 10000
  const cheonman = Math.floor(remainder / 1000)

  if (eok === 0) return `${manwon.toLocaleString()}만원`

  const eokStr = `${eok.toLocaleString()}억`
  if (cheonman === 0) return eokStr
  return `${eokStr} ${cheonman}천만원`
}

/** 월 상환액 등 만원 단위 소액 — 원 단위 통화 표기 */
export function formatWon(won: number): string {
  if (won >= 10000) return `${Math.round(won / 10000).toLocaleString()}만원`
  return `${won.toLocaleString()}원`
}
