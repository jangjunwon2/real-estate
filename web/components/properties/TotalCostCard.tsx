import { calcAcquisitionTax, calcBrokerFee } from '@/lib/koreanRealEstate'

interface Props {
  price: number
  isFirstBuyer: boolean
  selfFunds: number
  renovationBudget: number
  effectiveLoan: number
}

export default function TotalCostCard({
  price, isFirstBuyer, selfFunds, renovationBudget, effectiveLoan,
}: Props) {
  const tax = calcAcquisitionTax(price, isFirstBuyer)
  const broker = calcBrokerFee(price)
  const legal = Math.round(50 + price * 0.00015)   // 법무사·등기: 기본 50만원 + 가격 비례
  const moving = 150
  const legalCapped = Math.min(legal, 200)          // 개인 거래 기준 상한

  const totalCost = price + tax.totalTax + broker + legalCapped + moving + renovationBudget
  const gap = totalCost - selfFunds - effectiveLoan
  const isShortfall = gap > 0

  const rows = [
    { label: '매입가', value: price, sub: '' },
    {
      label: '취득세',
      value: tax.final,
      sub: isFirstBuyer && tax.discount > 0 ? `생애최초 감면 −${tax.discount.toLocaleString()}만원` : '',
    },
    { label: '지방교육세', value: tax.localEduTax, sub: '취득세의 20%' },
    ...(tax.stampTax > 0 ? [{ label: '인지세', value: tax.stampTax, sub: '' }] : []),
    { label: '중개수수료', value: broker, sub: '' },
    { label: '법무사·등기', value: legalCapped, sub: '이전등기 + 취득세 신고' },
    { label: '이사비', value: moving, sub: '평균 추정' },
    ...(renovationBudget > 0 ? [{ label: '인테리어', value: renovationBudget, sub: '' }] : []),
  ]

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <h2 className="text-sm font-semibold text-gray-800">총 소요 비용</h2>

      <div className="divide-y divide-gray-50">
        {rows.map(r => (
          <div key={r.label} className="flex items-center justify-between py-1.5">
            <div>
              <span className="text-sm text-gray-700">{r.label}</span>
              {r.sub && <span className="ml-1.5 text-[11px] text-gray-400">{r.sub}</span>}
            </div>
            <span className="text-sm font-medium text-gray-800">{r.value.toLocaleString()}만원</span>
          </div>
        ))}
      </div>

      {/* 합계 */}
      <div className="border-t-2 border-gray-200 pt-2.5 space-y-2">
        <div className="flex justify-between text-sm font-semibold">
          <span className="text-gray-700">총 필요 자금</span>
          <span className="text-gray-900">{totalCost.toLocaleString()}만원</span>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-sm text-gray-400">
            <span>내 자기자본</span>
            <span>{selfFunds.toLocaleString()}만원</span>
          </div>
          {effectiveLoan > 0 && (
            <div className="flex justify-between text-sm text-gray-400">
              <span>대출 가능액 (추정)</span>
              <span>{effectiveLoan.toLocaleString()}만원</span>
            </div>
          )}
        </div>
        <div className={`flex items-center justify-between text-sm font-bold pt-2 border-t border-dashed ${isShortfall ? 'text-red-600' : 'text-green-600'}`}>
          <span>{isShortfall ? '⚠️ 자금 부족' : '✅ 자금 충족'}</span>
          <span>
            {isShortfall
              ? `${Math.abs(gap).toLocaleString()}만원 부족`
              : `${Math.abs(gap).toLocaleString()}만원 여유`}
          </span>
        </div>
        {selfFunds === 0 && effectiveLoan === 0 && (
          <p className="text-[11px] text-gray-400">자금 계획 비교를 위해 <a href="/settings" className="underline text-indigo-500">내 정보</a>를 입력해주세요.</p>
        )}
      </div>

      <p className="text-[11px] text-gray-400">※ 취득세는 1주택 기준. 농어촌특별세(취득세의 10%) 별도 발생할 수 있음.</p>
    </section>
  )
}
