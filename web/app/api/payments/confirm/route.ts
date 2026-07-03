import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

const TIER_PRICES: Record<string, number> = { basic: 9900, pro: 29900 }

export async function POST(req: NextRequest) {
  const { paymentKey, orderId, amount, userId, tier } = await req.json()

  // 서버에서 금액 검증 — 클라이언트 전송값 신뢰 금지
  const expectedAmount = TIER_PRICES[tier]
  if (!expectedAmount || Number(amount) !== expectedAmount) {
    return Response.json({ error: 'invalid amount or tier' }, { status: 400 })
  }

  const tossSecretKey = process.env.TOSS_SECRET_KEY!
  const encoded = Buffer.from(`${tossSecretKey}:`).toString('base64')

  const res = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${encoded}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ paymentKey, orderId, amount: expectedAmount }),
  })

  if (!res.ok) {
    const err = await res.json()
    return Response.json({ error: err.message }, { status: 400 })
  }

  const db = createServerClient()
  const ended = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const [subResult, profileResult] = await Promise.allSettled([
    db.from('subscriptions').insert({
      user_id: userId, tier, amount: expectedAmount, payment_key: paymentKey,
      status: 'active', ended_at: ended,
    }),
    db.from('user_profiles').update({
      tier, subscription_end: ended,
    }).eq('id', userId),
  ])

  if (subResult.status === 'rejected' || profileResult.status === 'rejected') {
    return Response.json({ error: 'payment confirmed but record update failed — contact support' }, { status: 500 })
  }

  return Response.json({ ok: true })
}
