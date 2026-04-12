import { NextRequest } from 'next/server'
import { logger } from '@/lib/logger'

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

    logger.info('/api/fetch-profile', 'fetching profile', { url })

    // Use Jina AI Reader — converts any URL to clean markdown, no API key needed
    const jinaUrl = `https://r.jina.ai/${url}`
    const res = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/plain',
        'X-Return-Format': 'text',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      logger.warn('/api/fetch-profile', 'jina fetch failed', { status: res.status })
      return Response.json(
        { error: 'Could not fetch your LinkedIn profile. Please paste your profile text manually.' },
        { status: 422 }
      )
    }

    const text = await res.text()

    if (!text || text.trim().length < 100) {
      logger.warn('/api/fetch-profile', 'jina returned too little content', { length: text?.length })
      return Response.json(
        { error: 'LinkedIn returned too little content. Make sure your profile is public, or paste your profile text manually.' },
        { status: 422 }
      )
    }

    // Strip Jina preamble (first line is usually "Title: ..." or "URL: ...")
    const cleaned = text
      .replace(/^(Title|URL|Description):.*\n/gm, '')
      .replace(/^\s*\n/gm, '\n')
      .trim()

    logger.info('/api/fetch-profile', 'profile fetched successfully', { length: cleaned.length })

    return Response.json({ profileText: cleaned })
  } catch (err) {
    logger.error('/api/fetch-profile', 'fetch failed', err)
    return Response.json(
      { error: 'Could not fetch profile. Please paste your profile text manually.' },
      { status: 500 }
    )
  }
}
