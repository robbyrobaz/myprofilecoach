import { NextRequest } from 'next/server'
import { parseProfile, scoreProfile } from '@/lib/claude'
import { createSession, saveSession } from '@/lib/kv'
import { logger } from '@/lib/logger'

export const maxDuration = 60 // seconds


export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { profileText, targetRoles } = body as {
      profileText: string
      targetRoles: string[]
    }

    if (!profileText || typeof profileText !== 'string' || profileText.trim().length === 0) {
      return Response.json({ error: 'profileText is required' }, { status: 400 })
    }
    if (!Array.isArray(targetRoles) || targetRoles.length === 0) {
      return Response.json({ error: 'targetRoles must be a non-empty array' }, { status: 400 })
    }

    const sessionId = crypto.randomUUID()
    logger.info('/api/score', 'scoring started', { sessionId, targetRoles })

    // Create session in KV with stage 'scoring'
    const session = await createSession(sessionId, profileText, targetRoles)

    // Run the Claude pipeline
    const parsedProfile = await parseProfile(profileText)
    const { jobResearch, keywords, score } = await scoreProfile(parsedProfile, targetRoles)

    // Update session with results
    session.parsedProfile = parsedProfile
    session.jobResearch = jobResearch
    session.keywords = keywords
    session.score = score
    session.stage = 'scored'
    await saveSession(session)

    logger.info('/api/score', 'session scored', { sessionId, overallScore: score.overall })

    return Response.json({
      sessionId,
      score,
      parsedProfile,
      keywords,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error('/api/score', 'scoring failed', err)
    if (msg.includes('credit') || msg.includes('billing') || msg.includes('quota')) {
      return Response.json({ error: 'API billing issue. Please try again later.' }, { status: 503 })
    }
    if (msg.includes('invalid JSON') || msg.includes('JSON')) {
      return Response.json({ error: 'Failed to parse profile. Please try again.' }, { status: 500 })
    }
    if (msg.includes('401') || msg.includes('403') || msg.includes('authentication') || msg.includes('Unauthorized')) {
      return Response.json({ error: 'API authentication error. Please contact support.' }, { status: 503 })
    }
    if (msg.includes('404') || msg.includes('<html') || msg.includes('<!')) {
      return Response.json({ error: 'AI service temporarily unavailable. Please try again.' }, { status: 503 })
    }
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
