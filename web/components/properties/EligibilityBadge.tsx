interface Props {
  propertyType: string
  price?: number | null
}

export default function EligibilityBadge({ propertyType, price }: Props) {
  if (propertyType !== 'subscription') return null

  const isUnder5 = price != null && price <= 50000

  return (
    <div className="flex flex-wrap gap-1.5">
      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
        생애최초 특별공급 가능
      </span>
      {isUnder5 && (
        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-medium">
          신혼부부 특별공급 가능
        </span>
      )}
    </div>
  )
}
