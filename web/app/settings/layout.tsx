import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '분석 및 추천',
  description: '재무 상태·가구 정보를 입력하면 구매 가능 금액을 분석하고, 혼인신고·출산·대출 정리 등 더 유리해지는 전략을 추천합니다.',
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
