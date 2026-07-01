import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { validatePipelineKey, unauthorized } from '@/lib/auth'

export async function POST(req: NextRequest) {
  if (!validatePipelineKey(req)) return unauthorized()
  const { run_id, properties } = await req.json()
  if (!Array.isArray(properties) || properties.length === 0)
    return Response.json({ error: 'properties array required' }, { status: 400 })

  const db = createServerClient()
  const rows = properties.map((p: Record<string, unknown>) => ({
    source: p.source ?? 'unknown',
    source_url: p.source_url ?? p.url ?? '',
    property_type: p.property_type ?? 'sale',
    title: p.title ?? null,
    price: p.price ?? null,
    area_sqm: p.area_sqm ?? null,
    auction_date: p.auction_date ?? null,
    status: 'active',
    pipeline_run_id: run_id,
  }))

  const { data, error } = await db.from('properties')
    .upsert(rows, { onConflict: 'source_url', ignoreDuplicates: true })
    .select('id')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ saved: data?.length ?? 0, run_id })
}
