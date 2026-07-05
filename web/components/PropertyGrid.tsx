import type { Property } from '@/types'
import PropertyCard from './PropertyCard'

export default function PropertyGrid({ properties }: { properties: Property[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {properties.map(p => <PropertyCard key={p.id} property={p} />)}
    </div>
  )
}
