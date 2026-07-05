'use client'
import { useEffect, useState } from 'react'

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

interface Article {
  id: string
  title: string
  url: string
  source: string
  category: string | null
  importance: number | null
  urgent: boolean | null
  summary: string | null
  status: string
  created_at: string
}

interface Property {
  id: string
  title: string | null
  price: number | null
  property_type: string
  status: string
  created_at: string
  complexes: { name: string; sigungu: string } | null
  property_scores: { total_score: number } | null
}

type Tab = 'runs' | 'briefings' | 'articles' | 'properties'

const STATUS_COLOR: Record<string, string> = {
  success: 'text-green-600',
  failed: 'text-red-600',
  running: 'text-yellow-600',
}

const SIGNAL_LABEL: Record<string, string> = {
  buy: '🔴 매수', wait: '🟡 관망', avoid: '🔵 자제',
}

const CATEGORY_COLOR: Record<string, string> = {
  정책: 'bg-purple-100 text-purple-700',
  금리: 'bg-red-100 text-red-700',
  시세: 'bg-blue-100 text-blue-700',
  청약: 'bg-green-100 text-green-700',
  세금: 'bg-orange-100 text-orange-700',
  경매: 'bg-yellow-100 text-yellow-700',
  재개발: 'bg-teal-100 text-teal-700',
  기타: 'bg-gray-100 text-gray-600',
}

const PROPERTY_TYPE_LABEL: Record<string, string> = { sale: '매매', auction: '경매', subscription: '청약' }

function formatPrice(p: number | null): string {
  if (!p) return '—'
  const eok = Math.floor(p / 10000)
  const man = p % 10000
  return eok > 0 ? `${eok}억${man > 0 ? ` ${man.toLocaleString()}만` : ''}` : `${p.toLocaleString()}만`
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [runs, setRuns] = useState<Run[]>([])
  const [briefings, setBriefings] = useState<Briefing[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [articlesTotal, setArticlesTotal] = useState(0)
  const [articleStatus, setArticleStatus] = useState<'active' | 'hidden'>('active')
  const [articleDate, setArticleDate] = useState('')
  const [properties, setProperties] = useState<Property[]>([])
  const [propertiesTotal, setPropertiesTotal] = useState(0)
  const [propertyStatus, setPropertyStatus] = useState<'active' | 'sold' | 'cancelled'>('active')
  const [loading, setLoading] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('runs')

  const fetchArticles = async (status = articleStatus, date = articleDate) => {
    const params = new URLSearchParams({ status, limit: '50' })
    if (date) params.set('date', date)
    const res = await fetch(`/api/admin/articles?${params}`)
    if (!res.ok) return
    const json = await res.json()
    setArticles(json.articles ?? [])
    setArticlesTotal(json.total ?? 0)
  }

  const fetchProperties = async (status = propertyStatus) => {
    const params = new URLSearchParams({ status, limit: '50' })
    const res = await fetch(`/api/admin/properties?${params}`)
    if (!res.ok) return
    const json = await res.json()
    setProperties(json.properties ?? [])
    setPropertiesTotal(json.total ?? 0)
  }

  const fetchAll = async () => {
    setError('')
    const [statsRes, runsRes, briefRes] = await Promise.all([
      fetch('/api/admin/stats'),
      fetch('/api/admin/pipeline/runs'),
      fetch('/api/admin/briefings'),
    ])
    if (!statsRes.ok) { setError('인증 실패: 관리자 계정으로 로그인 후 접근해주세요'); return }
    setStats(await statsRes.json())
    setRuns((await runsRes.json()).runs ?? [])
    setBriefings((await briefRes.json()).briefings ?? [])
    await Promise.all([fetchArticles(), fetchProperties()])
  }

  useEffect(() => { fetchAll() }, [])

  const triggerPipeline = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/pipeline/trigger', { method: 'POST' })
      if (res.ok) { alert('파이프라인 트리거 완료 (GitHub Actions 실행됨)'); setTimeout(fetchAll, 3000) }
      else alert('트리거 실패 — GITHUB_TOKEN/GITHUB_REPO 환경변수 확인')
    } finally { setLoading(false) }
  }

  const toggleHide = async (article: Article) => {
    setActionId(article.id)
    const newStatus = article.status === 'active' ? 'hidden' : 'active'
    await fetch(`/api/admin/articles/${article.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setActionId(null)
    await fetchArticles()
  }

  const reclassify = async (id: string) => {
    setActionId(id)
    await fetch(`/api/admin/articles/${id}/reclassify`, { method: 'POST' })
    setActionId(null)
    await fetchArticles()
  }

  const rescoreProperty = async (id: string) => {
    setActionId(id)
    await fetch(`/api/admin/properties/${id}/rescore`, { method: 'POST' })
    setActionId(null)
    await fetchProperties()
  }

  const togglePropertyStatus = async (p: Property) => {
    setActionId(p.id)
    const newStatus = p.status === 'active' ? 'sold' : 'active'
    await fetch(`/api/admin/properties/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setActionId(null)
    await fetchProperties()
  }

  const handleStatusChange = async (s: 'active' | 'hidden') => {
    setArticleStatus(s)
    await fetchArticles(s)
  }

  const handleDateChange = async (d: string) => {
    setArticleDate(d)
    await fetchArticles(articleStatus, d)
  }

  const handlePropertyStatusChange = async (s: 'active' | 'sold' | 'cancelled') => {
    setPropertyStatus(s)
    await fetchProperties(s)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">관리자 대시보드</h1>
        <a href="/" className="text-sm text-gray-500 hover:underline">← 홈</a>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {!stats && !error && (
        <p className="text-sm text-gray-400">데이터 로드 중...</p>
      )}

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
            <button
              onClick={triggerPipeline}
              disabled={loading}
              className="px-5 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50"
            >
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
            {(['runs', 'briefings', 'articles', 'properties'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`pb-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  tab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {t === 'runs' ? '실행 이력' : t === 'briefings' ? '브리핑 이력' : t === 'articles' ? '기사 관리' : '매물 관리'}
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

          {/* 기사 관리 */}
          {tab === 'articles' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-lg border overflow-hidden text-sm">
                  {(['active', 'hidden'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      className={`px-3 py-1.5 ${articleStatus === s ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                      {s === 'active' ? '활성' : '숨김'}
                    </button>
                  ))}
                </div>
                <input
                  type="date"
                  value={articleDate}
                  onChange={e => handleDateChange(e.target.value)}
                  className="border rounded px-2 py-1.5 text-sm"
                />
                {articleDate && (
                  <button onClick={() => handleDateChange('')} className="text-xs text-gray-400 hover:text-gray-600">
                    날짜 초기화
                  </button>
                )}
                <span className="text-xs text-gray-400 ml-auto">총 {articlesTotal}건</span>
              </div>

              {articles.length === 0 && <p className="text-sm text-gray-400">기사 없음</p>}

              {articles.map(a => (
                <div key={a.id} className="rounded border p-3 space-y-1.5">
                  <div className="flex items-start gap-2">
                    {a.urgent && <span className="shrink-0 text-xs font-bold text-red-500 pt-0.5">긴급</span>}
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-gray-800 hover:underline line-clamp-2 flex-1"
                    >
                      {a.title}
                    </a>
                  </div>

                  {a.summary && <p className="text-xs text-gray-500 line-clamp-2">{a.summary}</p>}

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {a.category && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${CATEGORY_COLOR[a.category] ?? CATEGORY_COLOR.기타}`}>
                          {a.category}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">{a.source}</span>
                      {a.importance != null && <span className="text-xs text-gray-400">중요도 {a.importance}/10</span>}
                      <span className="text-xs text-gray-300">{new Date(a.created_at).toLocaleString('ko-KR')}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => reclassify(a.id)}
                        disabled={actionId === a.id}
                        className="text-xs px-2 py-1 border rounded hover:bg-gray-50 disabled:opacity-40"
                      >
                        {actionId === a.id ? '...' : 'AI 재분류'}
                      </button>
                      <button
                        onClick={() => toggleHide(a)}
                        disabled={actionId === a.id}
                        className={`text-xs px-2 py-1 border rounded disabled:opacity-40 ${
                          a.status === 'active'
                            ? 'hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                            : 'hover:bg-green-50 hover:text-green-600 hover:border-green-200'
                        }`}
                      >
                        {a.status === 'active' ? '숨기기' : '복원'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 매물 관리 */}
          {tab === 'properties' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-lg border overflow-hidden text-sm">
                  {(['active', 'sold', 'cancelled'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => handlePropertyStatusChange(s)}
                      className={`px-3 py-1.5 ${propertyStatus === s ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                      {s === 'active' ? '활성' : s === 'sold' ? '거래완료' : '취소'}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-gray-400 ml-auto">총 {propertiesTotal}건</span>
              </div>

              {properties.length === 0 && <p className="text-sm text-gray-400">매물 없음</p>}

              {properties.map(p => (
                <div key={p.id} className="rounded border p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {p.complexes?.name ?? p.title ?? '매물'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {p.complexes?.sigungu && <span className="text-xs text-gray-400">{p.complexes.sigungu}</span>}
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                          {PROPERTY_TYPE_LABEL[p.property_type] ?? p.property_type}
                        </span>
                        {p.price && <span className="text-xs font-semibold text-gray-700">{formatPrice(p.price)}</span>}
                        {p.property_scores && (
                          <span className="text-xs text-indigo-600 font-medium">AI {p.property_scores.total_score}점</span>
                        )}
                        <span className="text-xs text-gray-300">{new Date(p.created_at).toLocaleDateString('ko-KR')}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => rescoreProperty(p.id)}
                        disabled={actionId === p.id}
                        className="text-xs px-2 py-1 border rounded hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 disabled:opacity-40"
                      >
                        {actionId === p.id ? '...' : 'AI 재스코어'}
                      </button>
                      <button
                        onClick={() => togglePropertyStatus(p)}
                        disabled={actionId === p.id}
                        className={`text-xs px-2 py-1 border rounded disabled:opacity-40 ${
                          p.status === 'active'
                            ? 'hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                            : 'hover:bg-green-50 hover:text-green-600 hover:border-green-200'
                        }`}
                      >
                        {p.status === 'active' ? '거래완료' : '활성화'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
