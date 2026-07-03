'use client'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

export default function NavUserButton({ email }: { email: string | null }) {
  const router = useRouter()

  const logout = async () => {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (!email) return null

  return (
    <div className="ml-2 flex items-center gap-1.5">
      <span className="text-xs text-gray-400 hidden md:inline max-w-[140px] truncate">{email}</span>
      <button
        onClick={logout}
        className="px-3 py-1.5 rounded-md text-xs text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
      >
        로그아웃
      </button>
    </div>
  )
}
