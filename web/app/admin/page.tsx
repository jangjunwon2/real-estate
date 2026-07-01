'use client'
import { useState } from 'react'

interface Stats {
  articles: { today: number; urgent_today: number; hidden: number }
  pipeline: { last_run_status: string | null; last_run_at: string | null }
}

interface Run {
  id: string
  status: string
  started_at: string
  finished_at: string | null
  articles_fetched: number | null
  articles_saved: number | null
  error_message: string | null
}

interface Briefing {
  id: string
  content: string
  signal: string | null
  articles_count: number
  urgent_count: number
  generated_at: string
}

const STATUS_COLOR: Record<string, string> = {
  success: 'text-green-600',
  failed:  'text-red-600',
  running: 'text-yellow-600',
}

const SIGNAL_LABEL: Record<string, string> = {
  buy: '🔴 매수', wait: '🟡 관망', avoid: '🔵 자제',
}

export default function AdminPage() {
  const [stats,    setStats]    = useState<Stats | null>(null)
  const [runs,     setRuns]     = useState<Run[]>([])
  const [briefings, setBriefings] = useState<Briefing[]>([])
  const [adminKey, setAdminKey] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [tab,      setTab]      = useState<'runs' | 'briefings'>('runs')

  const fetchAll = async () => {
    setError('')
    const h = { 'X-Admin-Key': adminKey }
    const [statsRes, runsRes, briefRes] = await Promise.all([
      fetch('/api/admin/stats',          { headers: h }),
      fetch('/api/admin/pipeline/runs',  { headers: h }),
      fetch('/api/admin/briefings',      { headers: h }),
    ])
    if (!statsRes.ok) { setError('인증 실패: Admin Key를 확인하세요'); return }
    setStats(await statsRes.json())
    setRuns((await runsRes.json()).runs ?? [])
    setBriefings((await briefRes.json()).briefings ?? [])
  }

  const triggerPipeline = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/pipeline/trigger', {
        method: 'POST', headers: { 'X-Admin-Key': adminKey },
      })
      if (res.ok) { alert('파이프라인 트리거 완료 (GitHub Actions 실행됨)'); setTimeout(fetchAll, 3000) }
      else alert('트리거 실패 — GITHUB_TOKEN/GITHUB_REPO 환경변수 확인')
    } finally { setLoading(false) }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">관리자 대시보드</h1>
        <a href="/" className="text-sm text-gray-500 hover:underline">← 홈</a>
      </div>

      {/* 인증 */}
      <div className="flex gap-2">
        <input
          type="password" placeholder="Admin Key (ADMIN_API_KEY)"
          value={adminKey} onChange={e => setAdminKey(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && fetchAll()}
          className="flex-1 border rounded px-3 py-2 text-sm font-mono"
        />
        <button onClick={fetchAll}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700">
          조회
        </button>
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {stats && (
        <>
          {/* 통계 카드 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: '오늘 기사', value: stats.articles.today },
              { label: '긴급 기사', value: stats.articles.urgent_today },
              { label: '숨긴 기사', value: stats.articles.hidden },
              {
                label: '마지막 실행',
                value: stats.pipeline.last_run_status ?? '-',
                color: STATUS_COLOR[stats.pipeline.last_run_status ?? ''] ?? 'text-gray-600',
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-lg border p-4 text-center">
                <p className={`text-2xl font-bold ${color ?? ''}`}>{value}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* 파이프라인 트리거 */}
          <div className="flex items-center gap-3">
            <button onClick={triggerPipeline} disabled={loading}
              className="px-5 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50">
              {loading ? '실행 중...' : '파이프라인 수동 실행'}
            </button>
            {stats.pipeline.last_run_at && (
              <span className="text-xs text-gray-400">
                마지막: {new Date(stats.pipeline.last_run_at).toLocaleString('ko-KR')}
              </span>
            )}
          </div>

          {/* 탭 */}
          <div className="border-b flex gap-4">
            {(['runs', 'briefings'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`pb-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  tab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}>
                {t === 'runs' ? '실행 이력' : '브리핑 이력'}
              </button>
            ))}
          </div>

          {/* 실행 이력 */}
          {tab === 'runs' && (
            <div className="space-y-2">
              {runs.length === 0 && <p className="text-sm text-gray-400">이력 없음</p>}
              {runs.map(run => (
                <div key={run.id} className="rounded border p-3 text-sm flex items-start justify-between gap-4">
                  <div>
                    <span className={`font-medium ${STATUS_COLOR[run.status] ?? 'text-gray-600'}`}>
                      {run.status}
                    </span>
                    <span className="text-gray-400 ml-2 text-xs">
                      {new Date(run.started_at).toLocaleString('ko-KR')}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 text-right">
                    수집 {run.articles_fetched ?? '-'} / 저장 {run.articles_saved ?? '-'}
                    {run.error_message && (
                      <p className="text-red-400 mt-0.5 max-w-xs truncate">{run.error_message}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 브리핑 이력 */}
          {tab === 'briefings' && (
            <div className="space-y-3">
              {briefings.length === 0 && <p className="text-sm text-gray-400">브리핑 없음</p>}
              {briefings.map(b => (
                <div key={b.id} className="rounded border p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>{new Date(b.generated_at).toLocaleString('ko-KR')}</span>
                    <div className="flex items-center gap-3">
                      {b.signal && <span className="font-medium">{SIGNAL_LABEL[b.signal]}</span>}
                      <span>기사 {b.articles_count}건 / 긴급 {b.urgent_count}건</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 line-clamp-3">{b.content}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
