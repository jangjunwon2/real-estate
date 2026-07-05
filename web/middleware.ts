import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const WINDOW_MS = 60_000
const MAX_REQUESTS = 60
// 참고: Vercel 서버리스 환경에서는 인스턴스별로 동작 (인스턴스 간 공유 안 됨)
const counts = new Map<string, { count: number; reset: number }>()

// 로그인 없이 접근 가능한 경로
const PUBLIC_PATHS = ['/login', '/signup', '/forgot-password', '/reset-password', '/auth/callback', '/api/auth']
// 자체 API 키 인증을 사용하는 경로 (Supabase 세션 체크 제외)
const KEY_AUTH_PATHS = ['/api/admin', '/api/pipeline', '/api/cron']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p))
  if (isPublic) return NextResponse.next()

  const isKeyAuth = KEY_AUTH_PATHS.some(p => pathname.startsWith(p))
  if (isKeyAuth) return NextResponse.next()

  // Supabase 세션 갱신 + 인증 체크
  let response = NextResponse.next({ request: req })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          response = NextResponse.next({ request: req })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const loginUrl = new URL('/login', req.url)
    if (pathname !== '/') loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Rate limiting (API 경로)
  const isRateLimited = ['/api/articles', '/api/properties', '/api/briefing'].some(
    p => pathname.startsWith(p)
  )
  if (isRateLimited) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
    const now = Date.now()
    // 만료된 항목 정리
    for (const [key, val] of counts) {
      if (now > val.reset) counts.delete(key)
    }
    const entry = counts.get(ip)
    if (!entry || now > entry.reset) {
      counts.set(ip, { count: 1, reset: now + WINDOW_MS })
    } else {
      entry.count++
      if (entry.count > MAX_REQUESTS) {
        return NextResponse.json(
          { error: 'too many requests' },
          { status: 429, headers: { 'Retry-After': '60' } },
        )
      }
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.svg|.*\\.ico).*)'],
}
