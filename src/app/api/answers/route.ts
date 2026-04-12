import { NextRequest } from 'next/server'
import { processAnswers, generateSuggestionCards } from '@/lib/claude'
import { getSession, saveSession } from '@/lib/kv'

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
    const extractedAchievements = await processAnswers(
      session.parsedProfile,
      session.interviewQuestions,
      answers
    )

    // Generate suggestion cards
    const cards = await generateSuggestionCards(
      session.parsedProfile,
      session.keywords,
      session.score.targetRole,
      extractedAchievements
    )

    // Update session
    session.extractedAchievements = extractedAchievements
    session.suggestionCards = cards
    session.stage = 'suggestions'
    await saveSession(session)

    return Response.json({ cards })
  } catch (err) {
    console.error('[/api/answers] error:', err)
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
