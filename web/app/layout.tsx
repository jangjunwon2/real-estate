import type { Metadata, Viewport } from 'next'
import Nav from '@/components/Nav'
import './globals.css'

const SITE_NAME = '부동산AI'
const SITE_TITLE = '부동산AI — 신혼부부 맞춤 부동산 어드바이저'
const SITE_DESC = '생애최초 주택 구매를 위한 AI 부동산 뉴스 큐레이션. 청약·경매·매매 맞춤 분석.'

export const metadata: Metadata = {
  title: { default: SITE_TITLE, template: `%s — ${SITE_NAME}` },
  description: SITE_DESC,
  manifest: '/manifest.json',
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESC,
    type: 'website',
    locale: 'ko_KR',
    siteName: SITE_NAME,
  },
  twitter: {
    card: 'summary',
    title: SITE_TITLE,
    description: SITE_DESC,
  },
  icons: { icon: '/favicon.svg' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#4f46e5',
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
