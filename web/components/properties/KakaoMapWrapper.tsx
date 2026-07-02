'use client'
import dynamic from 'next/dynamic'
import { Suspense } from 'react'

const Map = dynamic(() => import('@/components/KakaoMap'), { ssr: false })

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

export default function KakaoMapWrapper(props: Props) {
  return (
    <Suspense
      fallback={
        <div style={{ width: '100%', height: '320px', borderRadius: '12px', background: '#e5e7eb' }} />
      }
    >
      <Map {...props} />
    </Suspense>
  )
}
