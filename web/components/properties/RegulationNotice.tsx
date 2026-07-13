import { detectRegulations } from '@/lib/koreanRealEstate'

const TYPE_COLOR = {
  tohe:      { bg: 'bg-red-50',    border: 'border-red-200',    title: 'text-red-800',    badge: 'bg-red-100 text-red-700'    },
  overheat:  { bg: 'bg-orange-50', border: 'border-orange-200', title: 'text-orange-800', badge: 'bg-orange-100 text-orange-700' },
  regulated: { bg: 'bg-yellow-50', border: 'border-yellow-200', title: 'text-yellow-800', badge: 'bg-yellow-100 text-yellow-700' },
  metro:     { bg: 'bg-blue-50',   border: 'border-blue-200',   title: 'text-blue-800',   badge: 'bg-blue-100 text-blue-700'  },
  'price-cap': { bg: 'bg-gray-50', border: 'border-gray-200',   title: 'text-gray-800',   badge: 'bg-gray-100 text-gray-700'  },
}

interface Props {
  sigungu: string | null | undefined
}

export default function RegulationNotice({ sigungu }: Props) {
  const zones = detectRegulations(sigungu)
  if (zones.length === 0) return null

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-800">⚠️ 규제 안내</h2>
      {zones.map(z => {
        const c = TYPE_COLOR[z.type]
        return (
          <div key={z.type} className={`rounded-xl border ${c.border} ${c.bg} p-4 space-y-2`}>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${c.badge}`}>{z.label}</span>
              {z.ltvCap && (
                <span className={`text-xs px-2 py-0.5 rounded ${c.badge}`}>
                  LTV 최대 {Math.round(z.ltvCap * 100)}%
                </span>
              )}
            </div>
            <p className={`text-sm font-medium ${c.title}`}>{z.description}</p>
            <ul className="space-y-1">
              {z.notes.map((n, i) => (
                <li key={i} className={`text-xs ${c.title} flex items-start gap-1`}>
                  <span className="shrink-0 mt-0.5">·</span><span>{n}</span>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </section>
  )
}
