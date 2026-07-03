import { NextRequest } from 'next/server'
import { validateAdminRequest, unauthorized } from '@/lib/auth'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!await validateAdminRequest(req)) return unauthorized()
  const githubToken = process.env.GITHUB_TOKEN
  const repo = process.env.GITHUB_REPO
  if (!githubToken || !repo)
    return Response.json({ error: 'GITHUB_TOKEN or GITHUB_REPO not configured' }, { status: 500 })

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
  if (!res.ok) return Response.json({ error: `GitHub API error: ${res.status}` }, { status: 502 })
  return Response.json({ triggered: true })
}
