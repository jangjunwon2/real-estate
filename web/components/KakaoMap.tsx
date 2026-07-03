'use client'

interface Props {
  lat: number
  lng: number
  name: string
  locationInfo?: {
    nearest_subway?: string | null
    nearest_subway_min?: number | null
    mart_min?: number | null
    hospital_min?: number | null
    park_min?: number | null
    school_count_1km?: number | null
  } | null
}

export default function PropertyMap({ lat, lng, name }: Props) {
  const delta = 0.005
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', height: 320, border: '1px solid #e5e7eb' }}>
      <iframe
        src={src}
        width="100%"
        height="320"
        style={{ border: 0, display: 'block' }}
        title={`${name} 위치 지도`}
        loading="lazy"
      />
    </div>
  )
}
