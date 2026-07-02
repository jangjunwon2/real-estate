'use client'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

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

const markerIcon = (name: string) =>
  L.divIcon({
    className: '',
    iconAnchor: [50, 52],
    html:
      `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;pointer-events:none">` +
      `<div style="padding:5px 14px;background:#1E3A5F;color:#fff;border-radius:20px;` +
      `font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.3)">` +
      `${name.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>` +
      `<div style="width:0;height:0;border-left:7px solid transparent;` +
      `border-right:7px solid transparent;border-top:9px solid #1E3A5F"></div>` +
      `</div>`,
  })

export default function PropertyMap({ lat, lng, name }: Props) {
  const naverUrl = `https://map.naver.com/p/search/${encodeURIComponent(name)}`
  const kakaoUrl = `https://map.kakao.com/?q=${encodeURIComponent(name)}`

  return (
    <div className="space-y-2">
      <MapContainer
        center={[lat, lng]}
        zoom={16}
        style={{ width: '100%', height: '320px', borderRadius: '12px', zIndex: 0 }}
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <Marker position={[lat, lng]} icon={markerIcon(name)} />
      </MapContainer>
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
