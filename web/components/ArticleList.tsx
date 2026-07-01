import type { Article } from '@/types'

const CATEGORY_COLOR: Record<string, string> = {
  정책:   'bg-purple-100 text-purple-700',
  금리:   'bg-red-100 text-red-700',
  시세:   'bg-blue-100 text-blue-700',
  청약:   'bg-green-100 text-green-700',
  세금:   'bg-orange-100 text-orange-700',
  경매:   'bg-yellow-100 text-yellow-700',
  재개발: 'bg-teal-100 text-teal-700',
  기타:   'bg-gray-100 text-gray-600',
}

export default function ArticleList({ articles }: { articles: Article[] }) {
  if (!articles.length) return <p className="text-gray-400">기사가 없습니다.</p>

  return (
    <ul className="divide-y divide-gray-100">
      {articles.map(a => (
        <li key={a.id} className="py-3 flex items-start gap-3">
          {a.urgent && (
            <span className="shrink-0 text-xs font-bold text-red-500 pt-0.5">긴급</span>
          )}
          <div className="min-w-0 flex-1">
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-gray-900 hover:underline line-clamp-2"
            >
              {a.title}
            </a>
            {a.summary && (
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.summary}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              {a.category && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${CATEGORY_COLOR[a.category] ?? CATEGORY_COLOR.기타}`}>
                  {a.category}
                </span>
              )}
              <span className="text-xs text-gray-400">{a.source}</span>
              <span className="text-xs text-gray-400">중요도 {a.importance}/10</span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
