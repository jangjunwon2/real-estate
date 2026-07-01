import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { paymentKey, orderId, amount, userId, tier } = await req.json()
  const tossSecretKey = process.env.TOSS_SECRET_KEY!
  const encoded = Buffer.from(`${tossSecretKey}:`).toString('base64')

  const res = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${encoded}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  })

  if (!res.ok) {
    const err = await res.json()
    return Response.json({ error: err.message }, { status: 400 })
  }

  const db = createServerClient()
  const ended = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  await Promise.all([
    db.from('subscriptions').insert({
      user_id: userId, tier, amount, payment_key: paymentKey,
      status: 'active', ended_at: ended,
    }),
    db.from('user_profiles').update({
      tier, subscription_end: ended,
    }).eq('id', userId),
  ])

  return Response.json({ ok: true })
}
