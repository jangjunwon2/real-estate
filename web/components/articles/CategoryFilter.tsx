import type { Category } from '@/types'

const CATEGORIES: Category[] = ['정책', '금리', '시세', '청약', '세금', '경매', '재개발', '기타']

interface Props {
  currentCategory?: string
  currentDate?: string
}

function buildHref(category?: string, date?: string) {
  const p = new URLSearchParams()
  if (category) p.set('category', category)
  if (date) p.set('date', date)
  const s = p.toString()
  return `/articles${s ? `?${s}` : ''}`
}

export default function CategoryFilter({ currentCategory, currentDate }: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const active = 'bg-gray-900 text-white border-gray-900'
  const inactive = 'border-gray-200 text-gray-600 hover:border-gray-400'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <a
          href={buildHref(undefined, currentDate)}
          className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${!currentCategory ? active : inactive}`}
        >
          전체
        </a>
        {CATEGORIES.map(cat => (
          <a
            key={cat}
            href={buildHref(cat, currentDate)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              currentCategory === cat ? active : inactive
            }`}
          >
            {cat}
          </a>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">날짜:</span>
        <a
          href={buildHref(currentCategory)}
          className={`text-sm px-2 py-1 rounded ${!currentDate ? 'bg-gray-100 font-medium' : 'text-gray-500 hover:text-gray-800'}`}
        >
          전체
        </a>
        <a
          href={buildHref(currentCategory, today)}
          className={`text-sm px-2 py-1 rounded ${currentDate === today ? 'bg-gray-100 font-medium' : 'text-gray-500 hover:text-gray-800'}`}
        >
          오늘
        </a>
      </div>
    </div>
  )
}
