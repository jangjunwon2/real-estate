import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { validateAdminRequest, unauthorized } from '@/lib/auth'
import { ArticlePatchSchema } from '@/lib/validators'
import { revalidatePath } from 'next/cache'
export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await validateAdminRequest(req)) return unauthorized()
  const { id } = await params
  const body = await req.json()
  const parsed = ArticlePatchSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: 'invalid body' }, { status: 400 })
  const db = createServerClient()
  const { data, error } = await db.from('articles')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  revalidatePath('/')
  return Response.json({ article: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await validateAdminRequest(req)) return unauthorized()
  const { id } = await params
  const db = createServerClient()
  await db.from('articles').update({ status: 'deleted' }).eq('id', id)
  revalidatePath('/')
  return Response.json({ ok: true })
}
