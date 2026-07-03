import { NextRequest } from 'next/server'
import { logError } from '@/lib/logger'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const githubToken = process.env.GITHUB_TOKEN
  const repo = process.env.GITHUB_REPO
  if (!githubToken || !repo) {
    return Response.json({ error: 'GITHUB_TOKEN or GITHUB_REPO not configured' }, { status: 500 })
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/daily-pipeline.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ref: 'main' }),
      },
    )
    if (!res.ok) {
      const err = await res.text()
      logError('cron/pipeline', new Error(err), { status: res.status })
      return Response.json({ error: `GitHub API error: ${res.status}` }, { status: 502 })
    }
    return Response.json({ triggered: true, at: new Date().toISOString() })
  } catch (error) {
    logError('cron/pipeline', error)
    return Response.json({ error: 'internal error' }, { status: 500 })
  }
}
