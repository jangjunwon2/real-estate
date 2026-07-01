'use client'
import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    kakao: any
  }
}

interface Props {
  lat: number
  lng: number
  name: string
}

export default function KakaoMap({ lat, lng, name }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const script = document.createElement('script')
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_KEY}&autoload=false`
    script.async = true
    script.onload = () => {
      window.kakao.maps.load(() => {
        if (!containerRef.current) return
        const map = new window.kakao.maps.Map(containerRef.current, {
          center: new window.kakao.maps.LatLng(lat, lng),
          level: 4,
        })
        new window.kakao.maps.Marker({
          position: new window.kakao.maps.LatLng(lat, lng),
          map,
        })
        new window.kakao.maps.CustomOverlay({
          position: new window.kakao.maps.LatLng(lat, lng),
          content: `<div style="padding:4px 8px;background:#fff;border-radius:4px;border:1px solid #ddd;font-size:12px;margin-top:-40px">${name}</div>`,
          yAnchor: 1,
          map,
        })
      })
    }
    document.head.appendChild(script)
    return () => {
      document.head.removeChild(script)
    }
  }, [lat, lng, name])

  return <div ref={containerRef} className="w-full h-64 rounded-lg bg-gray-100" />
}
