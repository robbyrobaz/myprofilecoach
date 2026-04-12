import { Redis } from '@upstash/redis'
import type { SessionState, UserRecord, RunMetrics, FeedbackRecord } from './types'

export interface ScoreIndexEntry {
  id: string
  createdAt: number
  targetRole: string
  score: number
  breakdown: { headline: number; about: number; experience: number; keywords: number; aiSignals: number }
  email?: string
  costUsd: number
  totalTokens: number
  stage: string
}

// Upstash injects UPSTASH_REDIS_REST_* via Vercel marketplace;
// manual setup uses KV_REST_API_*. Support both.
const kv = new Redis({
  url: (process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL)!,
  token: (process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN)!,
})

const SESSION_TTL = 60 * 60 * 24 // 24 hours
const P = 'mpc:' // app prefix — avoids collision on shared Upstash instances

// Session keys: mpc:session:{id}
export async function getSession(id: string): Promise<SessionState | null> {
  return await kv.get<SessionState>(`${P}session:${id}`)
}

export async function saveSession(session: SessionState): Promise<void> {
  await kv.set(`${P}session:${session.id}`, session, { ex: SESSION_TTL })
}

export async function createSession(id: string, rawProfile: string, targetRoles: string[]): Promise<SessionState> {
  const now = Date.now()
  const session: SessionState = {
    id,
    createdAt: now,
    expiresAt: now + SESSION_TTL * 1000,
    rawProfile,
    targetRoles,
    stage: 'scoring',
  }
  await saveSession(session)
  return session
}

// User keys: mpc:user:{email}
export async function getUser(email: string): Promise<UserRecord | null> {
  return await kv.get<UserRecord>(`${P}user:${email}`)
}

export async function saveUser(user: UserRecord): Promise<void> {
  await kv.set(`${P}user:${user.id}`, user)
  // Add to user index (lpush is idempotent-ish — dupes are fine, we dedupe on read)
  await kv.lpush(`${P}users:index`, user.id)
}

export async function getUserIndex(): Promise<UserRecord[]> {
  const emails = await kv.lrange<string>(`${P}users:index`, 0, 499)
  const unique = [...new Set(emails)]
  const records = await Promise.all(unique.map(e => kv.get<UserRecord>(`${P}user:${e}`)))
  return records.filter(Boolean) as UserRecord[]
}

export async function getUserByStripeId(customerId: string): Promise<UserRecord | null> {
  const email = await kv.get<string>(`${P}stripe:${customerId}`)
  if (!email) return null
  return await getUser(email)
}

export async function linkStripeCustomer(email: string, customerId: string): Promise<void> {
  await kv.set(`${P}stripe:${customerId}`, email)
}

// Free score rate limiting — 2 scores per browser ID per 24 hours
const FREE_SCORE_LIMIT = 2
const FREE_SCORE_TTL = 60 * 60 * 24 // 24 hours

export async function checkFreeScoreLimit(browserId: string): Promise<{ allowed: boolean; used: number; limit: number }> {
  // Sanitize to prevent key injection
  const safeId = browserId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
  if (!safeId) return { allowed: false, used: FREE_SCORE_LIMIT, limit: FREE_SCORE_LIMIT }
  const key = `${P}free_scores:${safeId}`
  const used = (await kv.get<number>(key)) ?? 0
  if (used >= FREE_SCORE_LIMIT) {
    return { allowed: false, used, limit: FREE_SCORE_LIMIT }
  }
  await kv.set(key, used + 1, { ex: FREE_SCORE_TTL })
  return { allowed: true, used: used + 1, limit: FREE_SCORE_LIMIT }
}

// Stats counters — track run counts and costs per pipeline step
export type StatKey = 'scores' | 'interviews' | 'suggestions' | 'finalizations' | 'pdfs'

export async function incrStat(stat: StatKey, costUsd = 0): Promise<void> {
  await kv.incr(`${P}stats:count:${stat}`)
  if (costUsd > 0) {
    // Store as integer micros (×100000) for precision
    await kv.incrby(`${P}stats:cost_micros:${stat}`, Math.round(costUsd * 100000))
  }
}

export interface StatsData {
  counts: Record<StatKey, number>
  costs: Record<StatKey, number>
}

export async function getStats(): Promise<StatsData> {
  const keys: StatKey[] = ['scores', 'interviews', 'suggestions', 'finalizations', 'pdfs']
  const countKeys = keys.map(k => `${P}stats:count:${k}`)
  const costKeys  = keys.map(k => `${P}stats:cost_micros:${k}`)
  const all = await Promise.all([...countKeys, ...costKeys].map(k => kv.get<number>(k)))
  const counts = Object.fromEntries(keys.map((k, i) => [k, all[i] ?? 0])) as Record<StatKey, number>
  const costs  = Object.fromEntries(keys.map((k, i) => [k, ((all[keys.length + i] ?? 0) as number) / 100000])) as Record<StatKey, number>
  return { counts, costs }
}

// Score index — compact entries for admin review
export async function indexScoredSession(session: SessionState, metrics: RunMetrics): Promise<void> {
  if (!session.score) return
  const entry: ScoreIndexEntry = {
    id: session.id,
    createdAt: session.createdAt,
    targetRole: session.score.targetRole,
    score: session.score.overall,
    breakdown: session.score.breakdown,
    email: session.userId,
    costUsd: metrics.totalCostUsd,
    totalTokens: metrics.totalInputTokens + metrics.totalOutputTokens,
    stage: session.stage,
  }
  await kv.lpush(`${P}score:index`, JSON.stringify(entry))
  await kv.ltrim(`${P}score:index`, 0, 999) // keep latest 1000
}

export async function getScoreIndex(limit = 100, offset = 0): Promise<ScoreIndexEntry[]> {
  const raw = await kv.lrange<string>(`${P}score:index`, offset, offset + limit - 1)
  return raw.map(r => (typeof r === 'string' ? JSON.parse(r) : r) as ScoreIndexEntry)
}

export async function getFeedbackList(limit = 50): Promise<FeedbackRecord[]> {
  const ids = await kv.lrange<string>(`${P}feedback:list`, 0, limit - 1)
  const records = await Promise.all(
    ids.map(id => kv.get<FeedbackRecord>(`${P}feedback:${id}`))
  )
  return records.filter(Boolean) as FeedbackRecord[]
}

export function getCurrentPeriod(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export async function checkAndIncrementUsage(
  email: string,
  type: 'session' | 'pdf' | 'refresh'
): Promise<{ allowed: boolean; remaining: number }> {
  const user = await getUser(email)
  if (!user || user.subscriptionStatus !== 'active') {
    return { allowed: false, remaining: 0 }
  }

  const period = getCurrentPeriod()
  if (user.usage.period !== period) {
    user.usage = { period, sessions: 0, pdfs: 0, refreshes: 0 }
  }

  const limits = { session: 3, pdf: 5, refresh: 2 }
  const fields = { session: 'sessions', pdf: 'pdfs', refresh: 'refreshes' } as const
  const field = fields[type]
  const limit = limits[type]
  const current = user.usage[field] as number

  if (current >= limit) {
    return { allowed: false, remaining: 0 }
  }

  ;(user.usage[field] as number)++
  await saveUser(user)
  return { allowed: true, remaining: limit - current - 1 }
}
