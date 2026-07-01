import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
      <p className="text-7xl font-bold text-gray-100">404</p>
      <h2 className="text-lg font-semibold text-gray-800">페이지를 찾을 수 없습니다</h2>
      <p className="text-sm text-gray-500">주소를 확인하거나 홈으로 돌아가세요.</p>
      <Link
        href="/"
        className="inline-block px-5 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
      >
        홈으로
      </Link>
    </main>
  )
}
