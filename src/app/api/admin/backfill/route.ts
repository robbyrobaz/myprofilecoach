import { NextRequest } from 'next/server'
import { Redis } from '@upstash/redis'
import { getScoreIndex, incrStat } from '@/lib/kv'
import type { SessionState } from '@/lib/types'

// Direct Redis access to read sessions during backfill
const redis = new Redis({
  url: (process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL)!,
  token: (process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN)!,
})

export async function POST(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key')
  if (!key || key !== process.env.ADMIN_KEY) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Read all indexed sessions (up to 1000)
  const entries = await getScoreIndex(1000)

  const results = {
    scanned: 0,
    scores: 0,
    interviews: 0,
    suggestions: 0,
    finalizations: 0,
    errors: [] as string[],
  }

  for (const entry of entries) {
    results.scanned++
    try {
      // Every entry in the score index = 1 score
      // We use the cost already stored in the entry
      await incrStat('scores', entry.costUsd)
      results.scores++

      // Load the full session to check how far it progressed
      const session = await redis.get<SessionState>(`mpc:session:${entry.id}`)
      if (!session) continue

      if (session.interviewQuestions) {
        await incrStat('interviews')
        results.interviews++
      }

      if (session.suggestionCards?.length) {
        const answersCost = session.metrics?.calls
          .filter(c => c.step === 'processAnswers' || c.step === 'generateSuggestionCards')
          .reduce((sum, c) => sum + c.costUsd, 0) ?? 0
        await incrStat('suggestions', answersCost)
        results.suggestions++
      }

      if (session.finalizedLinkedIn) {
        const finalizeCost = session.metrics?.calls
          .filter(c => c.step === 'finalizeOutput')
          .reduce((sum, c) => sum + c.costUsd, 0) ?? 0
        await incrStat('finalizations', finalizeCost)
        results.finalizations++
      }
    } catch (err) {
      results.errors.push(`${entry.id}: ${String(err)}`)
    }
  }

  return Response.json({ ok: true, ...results })
}
