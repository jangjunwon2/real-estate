// 청약 가점 자동 계산 (주택청약 가점제 기준)
// 총점 84점 = 무주택기간(32) + 부양가족(35) + 청약통장 가입기간(17)

interface Props {
  noHomeYears: number
  numChildren: number
  isNewlywed: boolean
}

function calcNoHomeScore(years: number): { score: number; label: string } {
  if (years <= 0) return { score: 2, label: '1년 미만' }
  if (years < 1) return { score: 2, label: '1년 미만' }
  const table = [
    { y: 1, s: 2 }, { y: 2, s: 4 }, { y: 3, s: 6 }, { y: 4, s: 8 },
    { y: 5, s: 10 }, { y: 6, s: 12 }, { y: 7, s: 14 }, { y: 8, s: 16 },
    { y: 9, s: 18 }, { y: 10, s: 20 }, { y: 11, s: 22 }, { y: 12, s: 24 },
    { y: 13, s: 26 }, { y: 14, s: 28 }, { y: 15, s: 30 }, { y: 32, s: 32 },
  ]
  const matched = table.filter(t => years >= t.y).pop()
  return matched ? { score: matched.s, label: `${years}년` } : { score: 2, label: `${years}년` }
}

function calcDependentScore(numChildren: number, isNewlywed: boolean): { score: number; count: number } {
  // 본인 + 배우자 포함, 부양가족 최대 6명 (35점)
  // 신혼부부는 본인+배우자 = 부양가족 1명으로 시작
  const baseCount = isNewlywed ? 1 : 0  // 배우자
  const total = Math.min(baseCount + numChildren, 6)
  const score = Math.min(total * 5 + 5, 35)
  return { score, count: total }
}

export default function SubscriptionScoreCard({ noHomeYears, numChildren, isNewlywed }: Props) {
  const noHome = calcNoHomeScore(noHomeYears)
  const dep = calcDependentScore(numChildren, isNewlywed)
  // 청약통장 2년 이상 가입 가정 (최소 기준 점수 4점)
  const savingsScore = 4
  const total = noHome.score + dep.score + savingsScore
  const maxTotal = 84

  const percent = Math.round((total / maxTotal) * 100)
  const grade = total >= 70 ? '최상' : total >= 55 ? '양호' : total >= 40 ? '보통' : '낮음'
  const gradeColor = total >= 70 ? 'text-green-600' : total >= 55 ? 'text-indigo-600' : total >= 40 ? 'text-amber-600' : 'text-red-500'

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800">청약 가점 예상</h2>
        <div className="flex items-baseline gap-1">
          <span className={`text-2xl font-bold ${gradeColor}`}>{total}</span>
          <span className="text-xs text-gray-400">/ 84점</span>
          <span className={`text-xs font-medium ml-1 ${gradeColor}`}>{grade}</span>
        </div>
      </div>

      {/* 점수 바 */}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            total >= 70 ? 'bg-green-500' : total >= 55 ? 'bg-indigo-500' : total >= 40 ? 'bg-amber-400' : 'bg-red-400'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* 세부 항목 */}
      <div className="space-y-2">
        {[
          { label: '무주택 기간', score: noHome.score, max: 32, desc: noHome.label },
          { label: '부양가족', score: dep.score, max: 35, desc: `${dep.count}명 (본인·배우자 포함)` },
          { label: '청약통장 가입', score: savingsScore, max: 17, desc: '2년 이상 가정 (최소 기준)' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-3">
            <div className="w-20 shrink-0">
              <p className="text-xs text-gray-600">{item.label}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{item.desc}</p>
            </div>
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-400 rounded-full"
                style={{ width: `${Math.round((item.score / item.max) * 100)}%` }}
              />
            </div>
            <span className="text-xs font-medium text-gray-700 w-10 text-right shrink-0">
              {item.score}/{item.max}
            </span>
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-gray-50 p-3 space-y-1">
        <p className="text-xs font-medium text-gray-700">가점 높이는 방법</p>
        {noHomeYears < 15 && (
          <p className="text-xs text-gray-500">· 무주택 유지 시 {15 - noHomeYears}년 후 최대 30점</p>
        )}
        {dep.count < 6 && (
          <p className="text-xs text-gray-500">· 부양가족 추가 시 1인당 +5점 (현재 {dep.count}명)</p>
        )}
        <p className="text-xs text-gray-500">· 청약통장 장기 유지 시 최대 17점 (현재 {savingsScore}점 추정)</p>
      </div>

      <p className="text-[11px] text-gray-400">※ 청약통장 실제 가입기간을 알 수 없어 최소값(2년)으로 계산. 실제 점수는 다를 수 있음.</p>
    </section>
  )
}
