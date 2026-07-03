interface Props {
  endDate: string
}

export default function SubscriptionCountdown({ endDate }: Props) {
  const end = new Date(endDate)
  if (isNaN(end.getTime())) return null
  const now = new Date()
  const days = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (days < 0) {
    return <span className="text-xs text-gray-400 font-medium">접수 마감</span>
  }
  if (days === 0) {
    return (
      <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
        오늘 마감
      </span>
    )
  }

  const style =
    days <= 3
      ? 'text-red-600 bg-red-50 border-red-200'
      : days <= 7
        ? 'text-orange-600 bg-orange-50 border-orange-200'
        : 'text-green-700 bg-green-50 border-green-200'

  return (
    <span className={`text-xs font-bold border px-2 py-0.5 rounded-full ${style}`}>
      D-{days}
    </span>
  )
}
