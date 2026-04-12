import { kv } from '@vercel/kv'
import type { SessionState, UserRecord } from './types'

const SESSION_TTL = 60 * 60 * 24 // 24 hours

// Session keys: session:{id}
export async function getSession(id: string): Promise<SessionState | null> {
  return await kv.get<SessionState>(`session:${id}`)
}

export async function saveSession(session: SessionState): Promise<void> {
  await kv.set(`session:${session.id}`, session, { ex: SESSION_TTL })
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

// User keys: user:{email}
export async function getUser(email: string): Promise<UserRecord | null> {
  return await kv.get<UserRecord>(`user:${email}`)
}

export async function saveUser(user: UserRecord): Promise<void> {
  await kv.set(`user:${user.id}`, user)
}

export async function getUserByStripeId(customerId: string): Promise<UserRecord | null> {
  const email = await kv.get<string>(`stripe:${customerId}`)
  if (!email) return null
  return await getUser(email)
}

export async function linkStripeCustomer(email: string, customerId: string): Promise<void> {
  await kv.set(`stripe:${customerId}`, email)
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
