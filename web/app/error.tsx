'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
      <p className="text-5xl">⚠️</p>
      <h2 className="text-lg font-semibold text-gray-800">오류가 발생했습니다</h2>
      <p className="text-sm text-gray-500">
        {error.message || '잠시 후 다시 시도해 주세요.'}
      </p>
      <button
        onClick={reset}
        className="px-5 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
      >
        다시 시도
      </button>
    </main>
  )
}
