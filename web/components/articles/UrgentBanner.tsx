import type { Article } from '@/types'

interface Props {
  articles: Article[]
}

export default function UrgentBanner({ articles }: Props) {
  const urgent = articles.filter(a => a.urgent)
  if (urgent.length === 0) return null

  return (
    <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 space-y-1.5">
      <p className="text-xs font-bold text-red-600 uppercase tracking-wide">긴급 뉴스</p>
      <ul className="space-y-1">
        {urgent.slice(0, 3).map(a => (
          <li key={a.id}>
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-red-800 hover:underline line-clamp-1"
            >
              {a.title}
            </a>
          </li>
        ))}
      </ul>
      {urgent.length > 3 && (
        <p className="text-xs text-red-400">외 {urgent.length - 3}건</p>
      )}
    </div>
  )
}
