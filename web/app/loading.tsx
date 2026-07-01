export default function Loading() {
  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="animate-pulse space-y-6">
        <div className="h-6 bg-gray-100 rounded w-40" />
        <div className="space-y-3">
          <div className="h-4 bg-gray-100 rounded w-full" />
          <div className="h-4 bg-gray-100 rounded w-4/5" />
          <div className="h-4 bg-gray-100 rounded w-3/5" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    </main>
  )
}
