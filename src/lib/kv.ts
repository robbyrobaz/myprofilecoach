import { Redis } from '@upstash/redis'
import type { SessionState, UserRecord } from './types'

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
}

export async function getUserByStripeId(customerId: string): Promise<UserRecord | null> {
  const email = await kv.get<string>(`${P}stripe:${customerId}`)
  if (!email) return null
  return await getUser(email)
}

export async function linkStripeCustomer(email: string, customerId: string): Promise<void> {
  await kv.set(`${P}stripe:${customerId}`, email)
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
