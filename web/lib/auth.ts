import { NextRequest } from 'next/server'

export function validatePipelineKey(req: NextRequest): boolean {
  const key = req.headers.get('x-pipeline-key') ?? ''
  return key !== '' && key === process.env.PIPELINE_API_KEY
}

export function validateAdminKey(req: NextRequest | Request): boolean {
  const key = (req.headers as Headers).get('x-admin-key') ?? ''
  return key !== '' && key === process.env.ADMIN_API_KEY
}

export function unauthorized(): Response {
  return Response.json({ error: 'unauthorized' }, { status: 401 })
}
