import { NextRequest } from 'next/server'
import { finalizeOutput } from '@/lib/claude'
import { getSession, saveSession } from '@/lib/kv'
import type { SuggestionCard } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, cards } = body as {
      sessionId: string
      cards: SuggestionCard[]
    }

    if (!sessionId) {
      return Response.json({ error: 'sessionId is required' }, { status: 400 })
    }
    if (!Array.isArray(cards)) {
      return Response.json({ error: 'cards must be an array' }, { status: 400 })
    }

    const session = await getSession(sessionId)
    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 })
    }
    if (!session.parsedProfile || !session.score) {
      return Response.json({ error: 'Session is missing required pipeline data' }, { status: 422 })
    }

    // Mark as finalizing and persist the client-updated cards
    session.stage = 'finalizing'
    session.suggestionCards = cards
    await saveSession(session)

    // Run finalize pipeline
    const output = await finalizeOutput(session.parsedProfile, cards, session.score)

    // Update session to complete
    session.finalizedLinkedIn = output
    session.stage = 'complete'
    await saveSession(session)

    return Response.json({ output })
  } catch (err) {
    console.error('[/api/finalize] error:', err)
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
