import { NextRequest } from 'next/server'
import { processAnswers, generateSuggestionCards, emptyMetrics, mergeMetrics } from '@/lib/claude'
import { getSession, saveSession, incrStat } from '@/lib/kv'
import { logger } from '@/lib/logger'

export const maxDuration = 120 // seconds


export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, answers } = body as {
      sessionId: string
      answers: Record<number, string>
    }

    if (!sessionId) {
      return Response.json({ error: 'sessionId is required' }, { status: 400 })
    }

    logger.info('/api/answers', 'answers processing started', { sessionId })

    if (!answers || typeof answers !== 'object') {
      return Response.json({ error: 'answers must be an object' }, { status: 400 })
    }

    const session = await getSession(sessionId)
    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 })
    }
    if (session.stage !== 'answering' && session.stage !== 'interviewing') {
      return Response.json(
        { error: `Session must be in answering stage, current stage: ${session.stage}` },
        { status: 422 }
      )
    }
    if (!session.parsedProfile || !session.interviewQuestions || !session.keywords || !session.score) {
      return Response.json({ error: 'Session is missing required pipeline data' }, { status: 422 })
    }

    // Mark as processing
    session.stage = 'processing'
    session.userAnswers = answers
    await saveSession(session)

    // Process answers into extracted achievements
    const { result: extractedAchievements, log: answersLog } = await processAnswers(
      session.parsedProfile,
      session.interviewQuestions,
      answers
    )
    let metrics = mergeMetrics(session.metrics ?? emptyMetrics(), answersLog)
    logger.info('/api/answers', 'answers processed', { sessionId, model: answersLog.model, inputTokens: answersLog.inputTokens, outputTokens: answersLog.outputTokens, durationMs: answersLog.durationMs, costUsd: answersLog.costUsd.toFixed(5) })

    // Generate suggestion cards
    const { result: cards, log: cardsLog } = await generateSuggestionCards(
      session.parsedProfile,
      session.keywords,
      session.score.targetRole,
      extractedAchievements
    )
    metrics = mergeMetrics(metrics, cardsLog)
    logger.info('/api/answers', 'cards generated', { sessionId, model: cardsLog.model, inputTokens: cardsLog.inputTokens, outputTokens: cardsLog.outputTokens, durationMs: cardsLog.durationMs, costUsd: cardsLog.costUsd.toFixed(5), cardCount: cards.length, totalCostUsd: metrics.totalCostUsd.toFixed(5) })

    // Update session
    session.extractedAchievements = extractedAchievements
    session.suggestionCards = cards
    session.metrics = metrics
    session.stage = 'suggestions'
    await Promise.all([
      saveSession(session),
      incrStat('suggestions', answersLog.costUsd + cardsLog.costUsd),
    ])

    return Response.json({ cards })
  } catch (err) {
    logger.error('/api/answers', 'answers processing failed', err)
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
