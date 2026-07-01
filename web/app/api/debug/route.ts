import { createServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY
  const hasPipelineKey = !!process.env.PIPELINE_API_KEY

  try {
    const db = createServerClient()
    const { data, error } = await db.from('pipeline_runs').select('id').limit(1)
    return Response.json({
      supabase_url: url,
      has_service_key: hasServiceKey,
      has_pipeline_key: hasPipelineKey,
      db_ok: !error,
      db_error: error?.message ?? null,
    })
  } catch (e: unknown) {
    return Response.json({
      supabase_url: url,
      has_service_key: hasServiceKey,
      has_pipeline_key: hasPipelineKey,
      db_ok: false,
      db_error: e instanceof Error ? e.message : String(e),
    })
  }
}
