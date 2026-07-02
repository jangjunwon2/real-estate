interface LocationScores {
  nearest_subway?: string | null
  nearest_subway_min?: number | null
  school_score?: number | null
  school_count_1km?: number | null
  convenience_score?: number | null
  mart_min?: number | null
  hospital_min?: number | null
  park_min?: number | null
}

interface Props {
  loc: LocationScores
}

function walkLabel(min: number | null | undefined): string {
  if (min == null) return '정보 없음'
  if (min <= 3) return `${min}분 (도보 초근거리)`
  if (min <= 7) return `${min}분 (도보 근거리)`
  if (min <= 15) return `${min}분 (도보)`
  return `${min}분 (버스/자전거)`
}

function walkColor(min: number | null | undefined): string {
  if (min == null) return 'text-gray-400'
  if (min <= 5) return 'text-green-600'
  if (min <= 10) return 'text-amber-600'
  return 'text-red-500'
}

function walkBarWidth(min: number | null | undefined, maxMin = 20): number {
  if (min == null) return 0
  return Math.max(0, Math.round((1 - Math.min(min, maxMin) / maxMin) * 100))
}

function scoreColor(score: number | null | undefined): string {
  if (score == null) return 'text-gray-400'
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-amber-600'
  return 'text-red-500'
}

function GradeTag({ value, thresholds }: { value: number | null | undefined; thresholds: [number, number] }) {
  if (value == null) return null
  const [good, mid] = thresholds
  const label = value <= good ? '매우 좋음' : value <= mid ? '보통' : '멀어요'
  const cls = value <= good
    ? 'bg-green-50 text-green-700'
    : value <= mid
    ? 'bg-amber-50 text-amber-700'
    : 'bg-red-50 text-red-600'
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${cls}`}>{label}</span>
  )
}

function Bar({ width, color }: { width: number; color: string }) {
  return (
    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden w-full">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} />
    </div>
  )
}

export default function LocationEnvironmentCard({ loc }: Props) {
  const subwayBar = walkBarWidth(loc.nearest_subway_min, 20)
  const martBar = walkBarWidth(loc.mart_min, 20)
  const hospitalBar = walkBarWidth(loc.hospital_min, 25)
  const parkBar = walkBarWidth(loc.park_min, 20)
  const schoolBar = Math.round((loc.school_score ?? 0) / 100 * 100)
  const convBar = Math.round((loc.convenience_score ?? 0) / 100 * 100)

  const categories = [
    {
      icon: '🚇',
      title: '교통',
      subtitle: loc.nearest_subway ?? '정보 없음',
      metric: loc.nearest_subway_min != null ? `${loc.nearest_subway_min}분` : '—',
      metricColor: walkColor(loc.nearest_subway_min),
      bar: subwayBar,
      barColor: loc.nearest_subway_min != null && loc.nearest_subway_min <= 5 ? 'bg-green-400' : loc.nearest_subway_min != null && loc.nearest_subway_min <= 10 ? 'bg-amber-400' : 'bg-red-400',
      grade: <GradeTag value={loc.nearest_subway_min} thresholds={[5, 10]} />,
      detail: loc.nearest_subway_min != null ? walkLabel(loc.nearest_subway_min) : '정보 없음',
    },
    {
      icon: '🏫',
      title: '교육',
      subtitle: `반경 1km 내 학교 ${loc.school_count_1km ?? 0}개`,
      metric: loc.school_score != null ? `${loc.school_score}점` : '—',
      metricColor: scoreColor(loc.school_score),
      bar: schoolBar,
      barColor: (loc.school_score ?? 0) >= 80 ? 'bg-green-400' : (loc.school_score ?? 0) >= 60 ? 'bg-amber-400' : 'bg-red-400',
      grade: loc.school_score != null ? (
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
          loc.school_score >= 80 ? 'bg-green-50 text-green-700' :
          loc.school_score >= 60 ? 'bg-amber-50 text-amber-700' :
          'bg-red-50 text-red-600'
        }`}>
          {loc.school_score >= 80 ? '학군 우수' : loc.school_score >= 60 ? '보통' : '다소 부족'}
        </span>
      ) : null,
      detail: `학교 ${loc.school_count_1km ?? 0}개 (1km 이내)`,
    },
    {
      icon: '🏥',
      title: '의료',
      subtitle: '종합병원·의원',
      metric: loc.hospital_min != null ? `${loc.hospital_min}분` : '—',
      metricColor: walkColor(loc.hospital_min),
      bar: hospitalBar,
      barColor: loc.hospital_min != null && loc.hospital_min <= 8 ? 'bg-green-400' : loc.hospital_min != null && loc.hospital_min <= 15 ? 'bg-amber-400' : 'bg-red-400',
      grade: <GradeTag value={loc.hospital_min} thresholds={[8, 15]} />,
      detail: walkLabel(loc.hospital_min),
    },
    {
      icon: '🛒',
      title: '생활편의',
      subtitle: '마트·편의시설',
      metric: loc.mart_min != null ? `${loc.mart_min}분` : '—',
      metricColor: walkColor(loc.mart_min),
      bar: Math.round((convBar + martBar) / 2),
      barColor: (loc.convenience_score ?? 0) >= 75 ? 'bg-green-400' : (loc.convenience_score ?? 0) >= 50 ? 'bg-amber-400' : 'bg-red-400',
      grade: loc.convenience_score != null ? (
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
          loc.convenience_score >= 75 ? 'bg-green-50 text-green-700' :
          loc.convenience_score >= 50 ? 'bg-amber-50 text-amber-700' :
          'bg-red-50 text-red-600'
        }`}>
          {loc.convenience_score >= 75 ? '편의 우수' : loc.convenience_score >= 50 ? '보통' : '불편'}
        </span>
      ) : null,
      detail: loc.mart_min != null ? `마트 ${walkLabel(loc.mart_min)}` : '정보 없음',
    },
    {
      icon: '🌳',
      title: '자연·공원',
      subtitle: '근린공원·산책로',
      metric: loc.park_min != null ? `${loc.park_min}분` : '—',
      metricColor: walkColor(loc.park_min),
      bar: parkBar,
      barColor: loc.park_min != null && loc.park_min <= 5 ? 'bg-green-400' : loc.park_min != null && loc.park_min <= 12 ? 'bg-amber-400' : 'bg-red-400',
      grade: <GradeTag value={loc.park_min} thresholds={[5, 12]} />,
      detail: walkLabel(loc.park_min),
    },
  ]

  // 종합 점수 계산 (5개 카테고리 평균)
  const scores = [
    subwayBar,
    schoolBar,
    hospitalBar,
    Math.round((convBar + martBar) / 2),
    parkBar,
  ]
  const total = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
  const totalGrade =
    total >= 80 ? { label: '입지 최상', color: 'text-green-600', bg: 'bg-green-50' } :
    total >= 65 ? { label: '입지 양호', color: 'text-indigo-600', bg: 'bg-indigo-50' } :
    total >= 50 ? { label: '입지 보통', color: 'text-amber-600', bg: 'bg-amber-50' } :
    { label: '입지 개선 여지', color: 'text-red-500', bg: 'bg-red-50' }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">주변 환경</h2>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${totalGrade.bg} ${totalGrade.color}`}>
          {totalGrade.label}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {categories.map(cat => (
          <div key={cat.title} className="rounded-xl border border-gray-100 bg-white p-3.5 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-lg leading-none">{cat.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-800 leading-tight">{cat.title}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">{cat.subtitle}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-base font-bold leading-none ${cat.metricColor}`}>{cat.metric}</p>
                <div className="mt-1">{cat.grade}</div>
              </div>
            </div>
            <Bar width={cat.bar} color={cat.barColor} />
            <p className="text-[11px] text-gray-500">{cat.detail}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 flex items-center gap-3">
        <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${total >= 80 ? 'bg-green-500' : total >= 65 ? 'bg-indigo-500' : total >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
            style={{ width: `${total}%` }}
          />
        </div>
        <span className={`text-sm font-bold shrink-0 ${totalGrade.color}`}>{total}점</span>
      </div>
    </section>
  )
}
