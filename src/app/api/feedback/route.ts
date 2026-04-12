import { NextRequest } from 'next/server'
import { getSession } from '@/lib/kv'
import { Redis } from '@upstash/redis'
import type { FeedbackRecord } from '@/lib/types'
import { logger } from '@/lib/logger'

const kv = new Redis({
  url: (process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL)!,
  token: (process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN)!,
})

async function createGithubIssue(feedback: FeedbackRecord): Promise<string | null> {
  const token = process.env.GITHUB_TOKEN
  const repo = process.env.GITHUB_REPO // e.g. "robbyrobaz/myprofilecoach"
  if (!token || !repo) return null

  const m = feedback.metrics
  const costLine = m ? `**Total cost:** $${m.totalCostUsd.toFixed(5)} | **Tokens:** ${m.totalInputTokens + m.totalOutputTokens} | **Time:** ${m.totalDurationMs}ms` : ''
  const callsTable = m?.calls.length
    ? `| Step | Model | In | Out | ms | $ |\n|---|---|---|---|---|---|\n` +
      m.calls.map(c => `| ${c.step} | ${c.model} | ${c.inputTokens} | ${c.outputTokens} | ${c.durationMs} | $${c.costUsd.toFixed(5)} |`).join('\n')
    : ''

  const body = `## User Feedback

**Message:** ${feedback.message}

**Session:** \`${feedback.sessionId}\`
**Score:** ${feedback.score ?? 'n/a'}/100
**Target role:** ${feedback.targetRole ?? 'n/a'}
**Stage:** ${feedback.stage ?? 'n/a'}
**Email:** ${feedback.email ?? 'not provided'}
**Submitted:** ${new Date(feedback.createdAt).toISOString()}

${costLine}

${callsTable ? `### AI Call Breakdown\n\n${callsTable}` : ''}

---
*Auto-generated from My Profile Coach feedback widget*`

  const title = `[Feedback] ${feedback.score ?? '?'}/100 — ${(feedback.targetRole ?? 'unknown role').slice(0, 60)}`

  const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, body, labels: ['user-feedback'] }),
  })

  if (!res.ok) {
    logger.warn('/api/feedback', 'github issue creation failed', { status: res.status })
    return null
  }

  const data = await res.json() as { html_url: string }
  return data.html_url
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { sessionId: string; message: string; email?: string }
    const { sessionId, message, email } = body

    if (!sessionId || !message?.trim()) {
      return Response.json({ error: 'sessionId and message are required' }, { status: 400 })
    }

    // Load session context to enrich the feedback
    const session = await getSession(sessionId)

    const feedback: FeedbackRecord = {
      id: crypto.randomUUID(),
      sessionId,
      createdAt: Date.now(),
      message: message.trim().slice(0, 2000),
      email: email?.trim() || undefined,
      score: session?.score?.overall,
      targetRole: session?.score?.targetRole,
      stage: session?.stage,
      metrics: session?.metrics,
    }

    // Store in KV (30 day TTL)
    await kv.set(`mpc:feedback:${feedback.id}`, feedback, { ex: 60 * 60 * 24 * 30 })
    // Also append to a list for easy retrieval
    await kv.lpush('mpc:feedback:list', feedback.id)

    // Try GitHub issue
    const githubUrl = await createGithubIssue(feedback)
    if (githubUrl) {
      feedback.githubIssueUrl = githubUrl
      await kv.set(`mpc:feedback:${feedback.id}`, feedback, { ex: 60 * 60 * 24 * 30 })
    }

    logger.info('/api/feedback', 'feedback received', { feedbackId: feedback.id, sessionId, score: feedback.score, githubUrl: githubUrl ?? 'none' })

    return Response.json({ ok: true, githubUrl })
  } catch (err) {
    logger.error('/api/feedback', 'feedback failed', err)
    return Response.json({ error: 'Failed to submit feedback' }, { status: 500 })
  }
}
