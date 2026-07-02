import { calcLoanProducts, calcMonthlyPayment, detectZoneType, type UserFinance } from '@/lib/koreanRealEstate'
import Link from 'next/link'

interface Props {
  price: number
  finance: UserFinance | null
  sigungu?: string | null
}

export default function LoanEligibilityPanel({ price, finance, sigungu }: Props) {
  if (!finance || finance.income === 0) {
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
        <h2 className="text-sm font-semibold text-gray-800">대출 적격성 분석</h2>
        <p className="text-sm text-amber-700">소득 정보를 입력하면 대출 적격성과 월 상환액을 자동 계산합니다.</p>
        <Link href="/settings" className="inline-block text-xs text-indigo-600 font-medium underline">내 정보 입력하기 →</Link>
      </section>
    )
  }

  const zone = detectZoneType(sigungu)
  const products = calcLoanProducts(price, finance, sigungu)
  const eligible = products.filter(p => p.eligible)
  const best = eligible[0]
  const bestLoan = best ? best.calcLoan(price) : 0
  const bestMonthly = best ? calcMonthlyPayment(bestLoan, best.repRate) : 0

  return (
    <section className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800">대출 적격성 분석</h2>
        <Link href="/settings" className="text-xs text-indigo-500 hover:underline">조건 수정</Link>
      </div>

      {/* 사용자 조건 */}
      <div className="flex flex-wrap gap-1.5">
        {finance.isNewlywed && <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">💍 신혼부부</span>}
        {finance.isFirstBuyer && <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">🏠 생애최초</span>}
        {finance.numChildren > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">👶 자녀 {finance.numChildren}명</span>}
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">연소득 {finance.income.toLocaleString()}만원</span>
        {finance.existingLoanPayment > 0 && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
            기존 상환 월 {finance.existingLoanPayment.toLocaleString()}만원
          </span>
        )}
        {zone !== 'none' && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700">
            {zone === 'overheat' ? '투기과열지구' : zone === 'regulated' ? '조정대상' : '토허제'}
          </span>
        )}
      </div>

      {/* 최적 상품 월 상환액 하이라이트 */}
      {bestLoan > 0 && (
        <div className="rounded-lg bg-indigo-600 text-white p-3.5 flex justify-between items-center">
          <div>
            <p className="text-xs text-indigo-200">{best?.name} ({best?.subName}) 기준</p>
            <p className="text-lg font-bold mt-0.5">월 {bestMonthly.toLocaleString()}만원</p>
            <p className="text-xs text-indigo-200 mt-0.5">30년 원리금균등 · {best?.rateRange}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-indigo-200">대출 가능액</p>
            <p className="text-base font-semibold">{bestLoan.toLocaleString()}만원</p>
          </div>
        </div>
      )}

      {/* 상품 목록 */}
      <div className="space-y-2">
        {products.map(p => {
          const loan = p.eligible ? p.calcLoan(price) : 0
          const monthly = loan > 0 ? calcMonthlyPayment(loan, p.repRate) : 0
          const isBest = p.id === best?.id
          return (
            <div
              key={p.id}
              className={`rounded-lg border p-3 ${
                p.eligible
                  ? isBest
                    ? 'border-indigo-300 bg-white shadow-sm'
                    : 'border-gray-200 bg-white'
                  : 'border-gray-100 bg-gray-50 opacity-55'
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="text-[11px] mt-0.5 shrink-0">{p.eligible ? '✅' : '❌'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-medium text-gray-800">{p.name}</span>
                    <span className="text-xs text-gray-500">{p.subName}</span>
                    {isBest && <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-600 text-white">추천</span>}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">금리 {p.rateRange} · LTV {Math.round(p.ltvRate * 100)}% · 한도 {p.maxAmount >= 999999 ? '제한없음' : `${p.maxAmount.toLocaleString()}만원`}</p>
                  {!p.eligible && p.blockedReasons.map((r, i) => (
                    <p key={i} className="text-xs text-red-500 mt-0.5">· {r}</p>
                  ))}
                </div>
                {p.eligible && loan > 0 && (
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-indigo-700">{loan.toLocaleString()}만원</p>
                    <p className="text-[11px] text-gray-500">월 {monthly.toLocaleString()}만원</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {eligible.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-2">현재 조건으로 적격한 정책 대출이 없습니다. 일반 주담대를 검토하세요.</p>
      )}

      <p className="text-[11px] text-gray-400">※ 금리·한도는 기준 금리 변동 및 개인 신용도에 따라 다를 수 있습니다. 은행 심사 후 최종 확정됩니다.</p>
    </section>
  )
}
