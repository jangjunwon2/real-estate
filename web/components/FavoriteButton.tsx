'use client'
import { useState } from 'react'

interface Props {
  propertyId: string
  initialFavorited: boolean
  initialFavoriteId: string | null
}

export default function FavoriteButton({ propertyId, initialFavorited, initialFavoriteId }: Props) {
  const [favorited, setFavorited] = useState(initialFavorited)
  const [favoriteId, setFavoriteId] = useState(initialFavoriteId)
  const [loading, setLoading] = useState(false)

  const toggle = async () => {
    setLoading(true)
    try {
      if (favorited && favoriteId) {
        const res = await fetch(`/api/favorites/${favoriteId}`, { method: 'DELETE' })
        if (res.ok) { setFavorited(false); setFavoriteId(null) }
      } else {
        const res = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ property_id: propertyId }),
        })
        if (res.ok) {
          const data = await res.json()
          setFavorited(true)
          setFavoriteId(data.id ?? null)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      aria-label={favorited ? '즐겨찾기 삭제' : '즐겨찾기 추가'}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 ${
        favorited
          ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
          : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50'
      }`}
    >
      <span>{favorited ? '♥' : '♡'}</span>
      <span>{favorited ? '저장됨' : '즐겨찾기'}</span>
    </button>
  )
}
