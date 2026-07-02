'use client'
import { useEffect, useRef, useState } from 'react'

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

const LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
const LEAFLET_JS  = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'

export default function PropertyMap({ lat, lng, name }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<any>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    if (mapRef.current) return

    function initMap() {
      const el = containerRef.current
      if (!el || mapRef.current) return
      try {
        const L   = window.L
        const map = L.map(el).setView([lat, lng], 16)
        mapRef.current = map

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
          maxZoom: 19,
        }).addTo(map)

        const safe = name.replace(/</g, '&lt;').replace(/>/g, '&gt;')
        L.marker([lat, lng], {
          icon: L.divIcon({
            className: '',
            iconAnchor: [50, 52],
            html:
              `<div style="display:flex;flex-direction:column;align-items:center;gap:3px">` +
              `<div style="padding:5px 14px;background:#1E3A5F;color:#fff;border-radius:20px;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.3)">${safe}</div>` +
              `<div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:9px solid #1E3A5F"></div>` +
              `</div>`,
          }),
        }).addTo(map)

        setStatus('ready')
      } catch (e) {
        setStatus('error')
      }
    }

    // CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id   = 'leaflet-css'
      link.rel  = 'stylesheet'
      link.href = LEAFLET_CSS
      document.head.appendChild(link)
    }

    // JS
    if (window.L) {
      initMap()
      return
    }

    if (!document.getElementById('leaflet-js')) {
      const script  = document.createElement('script')
      script.id     = 'leaflet-js'
      script.src    = LEAFLET_JS
      script.onload = initMap
      script.onerror = () => setStatus('error')
      document.head.appendChild(script)
    } else {
      // script tag exists but L not ready yet — wait
      const id = setInterval(() => {
        if (window.L) { clearInterval(id); initMap() }
      }, 100)
    }

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
      <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden' }}>
        <div
          ref={containerRef}
          style={{ width: '100%', height: '320px', background: '#e5e7eb' }}
        />
        {status === 'loading' && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: '#e5e7eb', color: '#9ca3af', fontSize: '13px',
          }}>
            지도 로딩 중…
          </div>
        )}
        {status === 'error' && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '12px',
            background: '#f3f4f6', color: '#6b7280', fontSize: '13px',
          }}>
            <span>지도를 불러올 수 없습니다</span>
            <a href={naverUrl} target="_blank" rel="noopener noreferrer"
              style={{ color: '#059669', textDecoration: 'underline' }}>
              네이버 지도에서 보기 →
            </a>
          </div>
        )}
      </div>
      <a
        href={naverUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontSize: '12px', color: '#9ca3af' }}
      >
        네이버 지도에서 보기 ↗
      </a>
    </div>
  )
}
