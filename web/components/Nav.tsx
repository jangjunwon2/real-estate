import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import NavUserButton from '@/components/NavUserButton'

const LINKS = [
  { href: '/',            label: '홈' },
  { href: '/articles',   label: '뉴스' },
  { href: '/properties', label: '매물' },
  { href: '/settings',   label: '내 정보' },
  { href: '/pricing',    label: '요금제' },
]

const ADMIN_EMAIL = process.env.ADMIN_EMAIL

export default async function Nav() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isAdmin = !!user && user.email === ADMIN_EMAIL

  return (
    <header className="border-b border-gray-100 bg-white sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-gray-900 text-base">🏠 부동산AI</Link>

        {user ? (
          <nav className="flex items-center gap-1">
            {LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="px-3 py-1.5 rounded-md text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
              >
                {label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                className="ml-2 px-3 py-1.5 rounded-md text-xs text-gray-400 hover:text-gray-600"
              >
                관리자
              </Link>
            )}
            <NavUserButton email={user.email ?? null} />
          </nav>
        ) : (
          <Link
            href="/login"
            className="px-4 py-1.5 rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            로그인
          </Link>
        )}
      </div>
    </header>
  )
}
