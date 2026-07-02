'use client'
import { useEffect, useRef, useState } from 'react'

declare global { interface Window { naver: any } }

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

function labelHtml(name: string) {
  const safe = name.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return (
    `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;pointer-events:none">` +
    `<div style="padding:5px 14px;background:#1E3A5F;color:#fff;border-radius:20px;` +
    `font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.3)">` +
    `${safe}</div>` +
    `<div style="width:0;height:0;border-left:7px solid transparent;` +
    `border-right:7px solid transparent;border-top:9px solid #1E3A5F"></div>` +
    `</div>`
  )
}

export default function NaverMap({ lat, lng, name }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [ready, setReady]  = useState(false)
  const [error, setError]  = useState<string | null>(null)

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID
    if (!clientId) {
      setError('NEXT_PUBLIC_NAVER_MAP_CLIENT_ID 환경변수가 없습니다.\n.env.local에 추가하세요.')
      return
    }
    if (!containerRef.current) return

    let tid: ReturnType<typeof setTimeout>

    function initMap() {
      if (!containerRef.current) return
      // 5초 안에 지도 생성 안 되면 도메인 문제로 판단
      tid = setTimeout(() => {
        const host = window.location.origin
        setError(`도메인 미등록 오류\nNCP 콘솔 → 내 애플리케이션 → Web 서비스 URL에\n${host}\n을 추가하세요.`)
      }, 5000)
      try {
        const center = new window.naver.maps.LatLng(lat, lng)
        const map = new window.naver.maps.Map(containerRef.current, {
          center,
          zoom: 16,
          mapTypeId: window.naver.maps.MapTypeId.NORMAL,
        })

        new window.naver.maps.Marker({
          position: center,
          map,
          icon: {
            content: labelHtml(name),
            anchor: new window.naver.maps.Point(50, 52),
          },
        })

        clearTimeout(tid)
        setReady(true)
      } catch (err) {
        clearTimeout(tid)
        setError(`지도 생성 오류: ${String(err)}`)
      }
    }

    if (window.naver?.maps) {
      initMap()
      return () => clearTimeout(tid)
    }

    const script = document.createElement('script')
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${clientId}`
    script.async = true
    script.addEventListener('load', initMap)
    script.addEventListener('error', () => {
      clearTimeout(tid)
      setError('네이버 지도 SDK 로드 실패\nNCP 콘솔에서 도메인을 등록했는지 확인하세요.')
    })
    document.head.appendChild(script)

    return () => {
      clearTimeout(tid)
      if (document.head.contains(script)) document.head.removeChild(script)
    }
  }, [lat, lng, name])

  const naverWebUrl = `https://map.naver.com/p/search/${encodeURIComponent(name)}`

  return (
    <div className="space-y-2">
      <div className="relative">
        <div
          ref={containerRef}
          style={{ width: '100%', height: '320px', borderRadius: '12px', background: '#e5e7eb' }}
        />

        {/* 에러 오버레이 */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-gray-100 px-6 text-center gap-3">
            <p className="text-xs text-gray-500 whitespace-pre-line leading-relaxed">{error}</p>
            <a
              href={naverWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-400 transition-colors"
            >
              네이버 지도로 보기 →
            </a>
          </div>
        )}

        {/* 로딩 */}
        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl pointer-events-none">
            <span className="text-xs text-gray-400">지도 로딩 중...</span>
          </div>
        )}
      </div>

      <a
        href={naverWebUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-green-600 transition-colors"
      >
        네이버 지도에서 보기 ↗
      </a>
    </div>
  )
}
