import Link from 'next/link'

const LINKS = [
  { href: '/',            label: '홈' },
  { href: '/articles',   label: '뉴스' },
  { href: '/properties', label: '매물' },
  { href: '/pricing',    label: '요금제' },
]

export default function Nav() {
  return (
    <header className="border-b border-gray-100 bg-white sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-gray-900 text-base">🏠 부동산AI</Link>
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
          <Link
            href="/admin"
            className="ml-2 px-3 py-1.5 rounded-md text-xs text-gray-400 hover:text-gray-600"
          >
            관리자
          </Link>
        </nav>
      </div>
    </header>
  )
}
