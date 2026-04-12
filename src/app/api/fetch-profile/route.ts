import { NextRequest } from 'next/server'
import { logger } from '@/lib/logger'

const SCRAPER_URL = process.env.LINKEDIN_SCRAPER_URL // e.g. https://omen-claw.tail76e7df.ts.net/linkedin-scraper
const SCRAPER_TOKEN = process.env.LINKEDIN_SCRAPER_TOKEN

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url } = body as { url: string }

    if (!url || typeof url !== 'string') {
      return Response.json({ error: 'url is required' }, { status: 400 })
    }

    // Only allow linkedin.com URLs
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return Response.json({ error: 'Invalid URL' }, { status: 400 })
    }

    if (!parsed.hostname.endsWith('linkedin.com')) {
      return Response.json({ error: 'Only LinkedIn profile URLs are supported' }, { status: 400 })
    }

    if (!SCRAPER_URL || !SCRAPER_TOKEN) {
      logger.warn('/api/fetch-profile', 'scraper not configured')
      return Response.json(
        { error: 'LinkedIn scraping is not configured. Please paste your profile text manually.' },
        { status: 503 }
      )
    }

    logger.info('/api/fetch-profile', 'calling playwright scraper', { url })

    const res = await fetch(`${SCRAPER_URL}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SCRAPER_TOKEN}`,
      },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(45000), // Playwright can take ~30s
    })

    const data = await res.json().catch(() => ({})) as { profileText?: string; error?: string }

    if (!res.ok || !data.profileText) {
      logger.warn('/api/fetch-profile', 'scraper returned error', { status: res.status, error: data.error })
      return Response.json(
        { error: data.error ?? 'Profile requires login to view.' },
        { status: 422 }
      )
    }

    logger.info('/api/fetch-profile', 'profile fetched successfully', { length: data.profileText.length })
    return Response.json({ profileText: data.profileText })

  } catch (err) {
    logger.error('/api/fetch-profile', 'fetch failed', err)
    return Response.json(
      { error: 'Could not fetch profile. Please paste your profile text manually.' },
      { status: 500 }
    )
  }
}
