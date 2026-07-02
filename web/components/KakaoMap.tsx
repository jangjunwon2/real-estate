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
  const delta = 0.008
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`
  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`
  const naverUrl = `https://map.naver.com/p/search/${encodeURIComponent(name)}`
  const kakaoUrl = `https://map.kakao.com/?q=${encodeURIComponent(name)}`

  return (
    <div className="space-y-2">
      <iframe
        src={embedUrl}
        title={`${name} 위치`}
        style={{ width: '100%', height: '320px', border: 'none', borderRadius: '12px', display: 'block' }}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      <div className="flex gap-3">
        <a
          href={naverUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-green-600 transition-colors"
        >
          네이버 지도 ↗
        </a>
        <a
          href={kakaoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-yellow-500 transition-colors"
        >
          카카오맵 ↗
        </a>
      </div>
    </div>
  )
}
