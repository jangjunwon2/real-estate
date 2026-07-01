import type { Metadata } from 'next'
import Nav from '@/components/Nav'
import './globals.css'

export const metadata: Metadata = {
  title: '부동산AI — 신혼부부 맞춤 부동산 어드바이저',
  description: '생애최초 주택 구매를 위한 AI 부동산 뉴스 큐레이션',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-white">
        <Nav />
        {children}
      </body>
    </html>
  )
}
