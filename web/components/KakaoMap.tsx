'use client'
import { useEffect, useRef } from 'react'

declare global { interface Window { L: any } }

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
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    function initMap() {
      if (!containerRef.current || mapRef.current) return
      const L = window.L

      const map = L.map(containerRef.current).setView([lat, lng], 16)
      mapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map)

      const safe = name.replace(/</g, '&lt;').replace(/>/g, '&gt;')
      const icon = L.divIcon({
        className: '',
        iconAnchor: [50, 52],
        html:
          `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;pointer-events:none">` +
          `<div style="padding:5px 14px;background:#1E3A5F;color:#fff;border-radius:20px;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.3)">${safe}</div>` +
          `<div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:9px solid #1E3A5F"></div>` +
          `</div>`,
      })
      L.marker([lat, lng], { icon }).addTo(map)
    }

    // CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    // JS
    if (window.L) {
      initMap()
      return
    }

    const script = document.createElement('script')
    script.id = 'leaflet-js'
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.addEventListener('load', initMap)
    document.head.appendChild(script)

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [lat, lng, name])

  const naverUrl = `https://map.naver.com/p/search/${encodeURIComponent(name)}`

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        style={{ width: '100%', height: '320px', borderRadius: '12px', background: '#e5e7eb' }}
      />
      <a
        href={naverUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-green-600 transition-colors"
      >
        네이버 지도에서 보기 ↗
      </a>
    </div>
  )
}
