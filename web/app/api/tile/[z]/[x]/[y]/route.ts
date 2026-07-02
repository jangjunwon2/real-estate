import { NextRequest, NextResponse } from 'next/server'

const SUBDOMAINS = ['a', 'b', 'c']

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ z: string; x: string; y: string }> },
) {
  const { z, x, y } = await params

  const sub = SUBDOMAINS[(Number(x) + Number(y)) % 3]
  const url = `https://${sub}.tile.openstreetmap.org/${z}/${x}/${y}.png`

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'RealEstateAI/1.0 (https://github.com/jangjunwon2/real-estate)' },
      next: { revalidate: 86400 },
    })

    if (!res.ok) return new NextResponse(null, { status: res.status })

    const buf = await res.arrayBuffer()
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
      },
    })
  } catch {
    return new NextResponse(null, { status: 502 })
  }
}
