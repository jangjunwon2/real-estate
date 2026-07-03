import { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export function validatePipelineKey(req: NextRequest): boolean {
  const key = req.headers.get('x-pipeline-key') ?? ''
  return key !== '' && key === process.env.PIPELINE_API_KEY
}

export function validateAdminKey(req: NextRequest | Request): boolean {
  const key = (req.headers as Headers).get('x-admin-key') ?? ''
  return key !== '' && key === process.env.ADMIN_API_KEY
}

// API 키 OR 관리자 세션 쿠키 — 둘 중 하나면 통과
export async function validateAdminRequest(req: NextRequest | Request): Promise<boolean> {
  if (validateAdminKey(req)) return true
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    return !!user && user.email === process.env.ADMIN_EMAIL
  } catch {
    return false
  }
}

export function unauthorized(): Response {
  return Response.json({ error: 'unauthorized' }, { status: 401 })
}
