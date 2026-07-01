import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const svcRole = process.env.SUPABASE_SERVICE_ROLE_KEY!

export function createServerClient() {
  return createClient(url, svcRole, { auth: { persistSession: false } })
}

export function createPublicClient() {
  return createClient(url, anon)
}
