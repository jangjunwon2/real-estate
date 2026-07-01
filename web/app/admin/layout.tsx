import Link from 'next/link'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 bg-white px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            ← 홈
          </Link>
          <span className="text-gray-200">/</span>
          <span className="text-sm font-medium text-gray-700">관리자</span>
        </div>
      </div>
      {children}
    </div>
  )
}
