import { NextRequest } from 'next/server'
import { generateInterviewQuestions } from '@/lib/claude'
import { getSession, saveSession, getUser, checkAndIncrementUsage } from '@/lib/kv'
import { logger } from '@/lib/logger'

export const maxDuration = 60 // seconds


export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, userEmail } = body as {
      sessionId: string
      userEmail: string
    }

    if (!sessionId || !userEmail) {
      return Response.json({ error: 'sessionId and userEmail are required' }, { status: 400 })
    }

    logger.info('/api/interview', 'interview generation started', { sessionId, userEmail: userEmail.slice(0, 3) + '***' })

    // Check active subscription (skip in bypass mode)
    const bypassAuth = process.env.BYPASS_AUTH === 'true'
    if (!bypassAuth) {
      const user = await getUser(userEmail)
      if (!user || user.subscriptionStatus !== 'active') {
        return Response.json(
          { error: 'Active subscription required to access interview questions' },
          { status: 403 }
        )
      }
      const usageResult = await checkAndIncrementUsage(userEmail, 'session')
      if (!usageResult.allowed) {
        return Response.json(
          { error: 'Session limit reached for this billing period' },
          { status: 403 }
        )
      }
    }

    // Load session
    const session = await getSession(sessionId)
    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 })
    }
    if (!session.parsedProfile || !session.keywords || !session.score) {
      return Response.json(
        { error: 'Session must be in scored stage before generating questions' },
        { status: 422 }
      )
    }

    // Generate interview questions
    const questions = await generateInterviewQuestions(
      session.parsedProfile,
      session.keywords,
      session.score.targetRole
    )

    // Update session
    session.userId = userEmail
    session.interviewQuestions = questions
    session.stage = 'interviewing'
    await saveSession(session)

    logger.info('/api/interview', 'interview generated', { sessionId, questionCount: questions.length })

    return Response.json({ questions })
  } catch (err) {
    logger.error('/api/interview', 'interview generation failed', err)
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
