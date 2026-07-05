import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '요금제',
  description: '신혼부부 생애최초 부동산 AI 어드바이저 요금제 안내. 무료·Basic·Premium 플랜을 비교하세요.',
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
