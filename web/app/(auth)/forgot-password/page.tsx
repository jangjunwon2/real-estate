'use client'
import { useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    })

    if (error) {
      setError('이메일 발송에 실패했습니다. 다시 시도해주세요.')
      setLoading(false)
    } else {
      setSent(true)
    }
  }

  if (sent) {
    return (
      <main className="min-h-[calc(100vh-56px)] bg-gray-50 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="text-4xl">📨</div>
          <h2 className="text-xl font-bold text-gray-900">이메일을 확인해주세요</h2>
          <p className="text-sm text-gray-500">
            <strong>{email}</strong>로 비밀번호 재설정 링크를 발송했습니다.
            <br />이메일의 링크를 클릭하면 새 비밀번호를 설정할 수 있습니다.
          </p>
          <p className="text-xs text-gray-400">
            이메일이 오지 않으면 스팸 폴더를 확인하거나{' '}
            <button
              onClick={() => setSent(false)}
              className="text-indigo-600 hover:underline"
            >
              다시 시도
            </button>
            해주세요.
          </p>
          <Link href="/login" className="inline-block text-sm text-indigo-600 hover:underline">
            ← 로그인으로 돌아가기
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-[calc(100vh-56px)] bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">비밀번호 찾기</h1>
          <p className="text-sm text-gray-500">
            가입한 이메일을 입력하면 재설정 링크를 보내드립니다
          </p>
        </div>

        <form onSubmit={send} className="bg-white rounded-2xl border border-gray-200 p-7 space-y-4 shadow-sm">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
              {error}
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

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? '발송 중...' : '재설정 링크 보내기'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400">
          <Link href="/login" className="text-indigo-600 hover:underline">
            ← 로그인으로 돌아가기
          </Link>
        </p>
      </div>
    </main>
  )
}
