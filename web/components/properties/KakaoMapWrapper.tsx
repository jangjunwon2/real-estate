'use client'
import dynamic from 'next/dynamic'

const KakaoMap = dynamic(() => import('@/components/KakaoMap'), { ssr: false })

export default KakaoMap
