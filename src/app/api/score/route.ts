import { NextRequest } from 'next/server'
import { parseProfile, scoreProfile, emptyMetrics, mergeMetrics } from '@/lib/claude'
import { createSession, saveSession, checkFreeScoreLimit, getUser, indexScoredSession, incrStat } from '@/lib/kv'
import { logger } from '@/lib/logger'

export const maxDuration = 60 // seconds


export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { profileText, targetRoles, email, browserId } = body as {
      profileText: string
      targetRoles: string[]
      email?: string
      browserId?: string
    }

    if (!profileText || typeof profileText !== 'string' || profileText.trim().length === 0) {
      return Response.json({ error: 'profileText is required' }, { status: 400 })
    }
    if (!Array.isArray(targetRoles) || targetRoles.length === 0) {
      return Response.json({ error: 'targetRoles must be a non-empty array' }, { status: 400 })
    }

    // Rate limit free users — skip if BYPASS_AUTH or active subscriber
    const bypassAuth = process.env.BYPASS_AUTH === 'true'
    if (!bypassAuth) {
      let isSubscriber = false
      if (email) {
        const user = await getUser(email)
        isSubscriber = user?.subscriptionStatus === 'active'
      }
      if (!isSubscriber) {
        const { allowed, used, limit } = await checkFreeScoreLimit(browserId ?? 'unknown')
        if (!allowed) {
          return Response.json(
            { error: `You've used your ${limit} free scores for today. Subscribe to get unlimited scoring and full profile optimization.`, rateLimited: true },
            { status: 429 }
          )
        }
        logger.info('/api/score', 'free score used', { browserId, used, limit })
      }
    }

    const sessionId = crypto.randomUUID()
    logger.info('/api/score', 'scoring started', { sessionId, targetRoles })

    // Create session in KV with stage 'scoring'
    const session = await createSession(sessionId, profileText, targetRoles)

    // Run the Claude pipeline
    let metrics = emptyMetrics()

    logger.info('/api/score', 'calling parseProfile', { sessionId, textLength: profileText.length })
    let parsedProfile
    try {
      const { result, log } = await parseProfile(profileText)
      parsedProfile = result
      metrics = mergeMetrics(metrics, log)
      logger.info('/api/score', 'parseProfile done', { sessionId, model: log.model, inputTokens: log.inputTokens, outputTokens: log.outputTokens, durationMs: log.durationMs, costUsd: log.costUsd.toFixed(5), headline: parsedProfile.headline, roleCount: parsedProfile.roles.length, roles: parsedProfile.roles.map(r => `${r.title} @ ${r.company}`) })
    } catch (parseErr) {
      const parseMsg = parseErr instanceof Error ? parseErr.message : String(parseErr)
      logger.error('/api/score', 'parseProfile failed', { sessionId, error: parseMsg })
      return Response.json({ error: `parse step failed: ${parseMsg.slice(0, 200)}` }, { status: 500 })
    }

    logger.info('/api/score', 'calling scoreProfile', { sessionId, targetRoles })
    const { jobResearch, keywords, score, log: scoreLog } = await scoreProfile(parsedProfile, targetRoles)
    metrics = mergeMetrics(metrics, scoreLog)
    logger.info('/api/score', 'scoreProfile done', { sessionId, model: scoreLog.model, inputTokens: scoreLog.inputTokens, outputTokens: scoreLog.outputTokens, durationMs: scoreLog.durationMs, costUsd: scoreLog.costUsd.toFixed(5), overallScore: score.overall })

    // Update session with results
    session.parsedProfile = parsedProfile
    session.jobResearch = jobResearch
    session.keywords = keywords
    session.score = score
    session.metrics = metrics
    session.stage = 'scored'
    await saveSession(session)

    await Promise.all([
      indexScoredSession(session, metrics),
      incrStat('scores', metrics.totalCostUsd),
    ])
    logger.info('/api/score', 'session complete', { sessionId, overallScore: score.overall, totalTokens: metrics.totalInputTokens + metrics.totalOutputTokens, totalCostUsd: metrics.totalCostUsd.toFixed(5), totalDurationMs: metrics.totalDurationMs })

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
    return Response.json({ error: 'Something went wrong scoring your profile. Please try again.' }, { status: 500 })
  }
}
