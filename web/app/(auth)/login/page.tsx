'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import Link from 'next/link'

const URL_ERRORS: Record<string, string> = {
  link_expired: '인증 링크가 만료되었거나 이미 사용되었습니다. 다시 시도해주세요.',
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawRedirect = searchParams.get('redirect') ?? '/'
  // 오픈 리다이렉트 방지: 내부 경로만 허용
  const redirectTo = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/'
  const urlError = searchParams.get('error')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const login = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      setLoading(false)
    } else {
      router.push(redirectTo)
      router.refresh()
    }
  }

  const displayError = error || (urlError ? (URL_ERRORS[urlError] ?? '오류가 발생했습니다. 다시 시도해주세요.') : '')

  return (
    <form onSubmit={login} className="bg-white rounded-2xl border border-gray-200 p-7 space-y-4 shadow-sm">
      {displayError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
          {displayError}
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-700">이메일</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoFocus
          autoComplete="email"
          placeholder="you@example.com"
          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-gray-700">비밀번호</label>
          <Link href="/forgot-password" className="text-xs text-indigo-500 hover:underline">
            비밀번호를 잊으셨나요?
          </Link>
        </div>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          placeholder="••••••••"
          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {loading ? '로그인 중...' : '로그인'}
      </button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <main className="min-h-[calc(100vh-56px)] bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">로그인</h1>
          <p className="text-sm text-gray-500">부동산AI 어드바이저에 오신 것을 환영합니다</p>
        </div>

        <Suspense fallback={<div className="h-56 animate-pulse bg-white rounded-2xl border" />}>
          <LoginForm />
        </Suspense>

        <p className="text-center text-xs text-gray-400">
          계정이 없으신가요?{' '}
          <Link href="/signup" className="text-indigo-600 hover:underline font-medium">
            회원가입
          </Link>
        </p>
      </div>
    </main>
  )
}
