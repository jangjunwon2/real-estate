import { NextRequest, NextResponse } from 'next/server'

const WINDOW_MS = 60_000
const MAX_REQUESTS = 60
// 참고: Vercel 서버리스 환경에서는 인스턴스별로 동작 (인스턴스 간 공유 안 됨)
// 단일 사용자 MVP에서는 best-effort 제한으로 충분함
const counts = new Map<string, { count: number; reset: number }>()

export function middleware(req: NextRequest) {
  const isPublicApi =
    req.nextUrl.pathname.startsWith('/api/articles') ||
    req.nextUrl.pathname.startsWith('/api/properties') ||
    req.nextUrl.pathname.startsWith('/api/briefing')

  if (!isPublicApi) return NextResponse.next()

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
  const now = Date.now()

  // 만료된 항목 정리 (메모리 누수 방지)
  for (const [key, val] of counts) {
    if (now > val.reset) counts.delete(key)
  }

  const entry = counts.get(ip)

  if (!entry || now > entry.reset) {
    counts.set(ip, { count: 1, reset: now + WINDOW_MS })
    return NextResponse.next()
  }

  entry.count++
  if (entry.count > MAX_REQUESTS) {
    return NextResponse.json(
      { error: 'too many requests' },
      { status: 429, headers: { 'Retry-After': '60' } },
    )
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/api/articles/:path*', '/api/properties/:path*', '/api/briefing/:path*'],
}
