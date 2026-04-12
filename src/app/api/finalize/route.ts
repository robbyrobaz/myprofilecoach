import { NextRequest } from 'next/server'
import { finalizeOutput, emptyMetrics, mergeMetrics } from '@/lib/claude'
import { getSession, saveSession, incrStat } from '@/lib/kv'
import type { SuggestionCard } from '@/lib/types'
import { logger } from '@/lib/logger'

export const maxDuration = 60 // seconds


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

    logger.info('/api/finalize', 'finalize started', { sessionId })

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
    const { result: output, log } = await finalizeOutput(session.parsedProfile, cards, session.score)
    const metrics = mergeMetrics(session.metrics ?? emptyMetrics(), log)
    logger.info('/api/finalize', 'finalize complete', { sessionId, model: log.model, inputTokens: log.inputTokens, outputTokens: log.outputTokens, durationMs: log.durationMs, costUsd: log.costUsd.toFixed(5), afterScore: output.afterScore, totalCostUsd: metrics.totalCostUsd.toFixed(5), totalTokens: metrics.totalInputTokens + metrics.totalOutputTokens })

    // Update session to complete
    session.finalizedLinkedIn = output
    session.metrics = metrics
    session.stage = 'complete'
    await Promise.all([
      saveSession(session),
      incrStat('finalizations', log.costUsd),
    ])

    return Response.json({ output, metrics })
  } catch (err) {
    logger.error('/api/finalize', 'finalize failed', err)
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
