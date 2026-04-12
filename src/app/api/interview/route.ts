import { NextRequest } from 'next/server'
import { generateInterviewQuestions } from '@/lib/claude'
import { getSession, saveSession, getUser, checkAndIncrementUsage } from '@/lib/kv'

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

    // Check active subscription
    const user = await getUser(userEmail)
    if (!user || user.subscriptionStatus !== 'active') {
      return Response.json(
        { error: 'Active subscription required to access interview questions' },
        { status: 403 }
      )
    }

    // Check and increment session usage
    const usageResult = await checkAndIncrementUsage(userEmail, 'session')
    if (!usageResult.allowed) {
      return Response.json(
        { error: 'Session limit reached for this billing period' },
        { status: 403 }
      )
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

    return Response.json({ questions })
  } catch (err) {
    console.error('[/api/interview] error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
