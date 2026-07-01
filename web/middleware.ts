import { NextRequest, NextResponse } from 'next/server'

const WINDOW_MS = 60_000
const MAX_REQUESTS = 60
const counts = new Map<string, { count: number; reset: number }>()

export function middleware(req: NextRequest) {
  const isPublicApi =
    req.nextUrl.pathname.startsWith('/api/articles') ||
    req.nextUrl.pathname.startsWith('/api/properties') ||
    req.nextUrl.pathname.startsWith('/api/briefing')

  if (!isPublicApi) return NextResponse.next()

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
  const now = Date.now()
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
