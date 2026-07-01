import type { Property } from '@/types'
import PropertyCard from './PropertyCard'

export default function PropertyGrid({ properties }: { properties: Property[] }) {
  if (!properties.length) return <p className="text-gray-400">분석된 매물이 없습니다.</p>

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {properties.map(p => <PropertyCard key={p.id} property={p} />)}
    </div>
  )
}
