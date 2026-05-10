import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q')
  if (!query || query.length < 2) return NextResponse.json({ results: [] })

  const apiKey = process.env.SERPER_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'SERPER_API_KEY not set' }, { status: 500 })

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: 10 }),
    })

    if (!response.ok) {
      console.error('Serper error:', response.status, await response.text())
      return NextResponse.json({ results: [] })
    }

    const data = await response.json() as any
    const results = (data.organic ?? []).slice(0, 10).map((item: any) => ({
      title: item.title ?? '',
      url: item.link ?? '',
      description: item.snippet ?? '',
    }))

    return NextResponse.json({ results })
  } catch (err) {
    console.error('Search error:', err)
    return NextResponse.json({ results: [] })
  }
}
