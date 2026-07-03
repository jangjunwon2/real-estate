'use client'
import { useEffect, useRef } from 'react'

declare global {
  interface Window { naver: any }
}

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

export default function NaverMapEmbed({ lat, lng, name }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID

    function initMap() {
      if (!container || !window.naver?.maps) return
      const center = new window.naver.maps.LatLng(lat, lng)
      const map = new window.naver.maps.Map(container, { center, zoom: 16 })
      new window.naver.maps.Marker({ position: center, map, title: name })
    }

    if (window.naver?.maps) {
      initMap()
      return
    }

    const existing = document.getElementById('naver-maps-sdk')
    if (existing) {
      existing.addEventListener('load', initMap)
      return () => existing.removeEventListener('load', initMap)
    }

    const script = document.createElement('script')
    script.id = 'naver-maps-sdk'
    script.src = `https://openapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${clientId}`
    script.async = true
    script.onload = initMap
    document.head.appendChild(script)
  }, [lat, lng, name])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: 320, borderRadius: 12, border: '1px solid #e5e7eb' }}
    />
  )
}
