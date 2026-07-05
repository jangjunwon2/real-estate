import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '내 정보 설정',
  description: '신혼부부·생애최초 정보, 재무 상태, 관심 지역을 설정하여 맞춤 매물 추천을 받으세요.',
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
