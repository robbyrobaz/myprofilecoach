import { NextRequest } from 'next/server'
import { parseProfile, scoreProfile } from '@/lib/claude'
import { createSession, saveSession } from '@/lib/kv'

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

    return Response.json({
      sessionId,
      score,
      parsedProfile,
      keywords,
    })
  } catch (err) {
    console.error('[/api/score] error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('credit') || msg.includes('billing') || msg.includes('quota')) {
      return Response.json({ error: 'Service temporarily unavailable. Please try again shortly.' }, { status: 503 })
    }
    if (msg.includes('invalid JSON') || msg.includes('JSON')) {
      return Response.json({ error: 'Failed to parse profile. Please try again.' }, { status: 500 })
    }
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
