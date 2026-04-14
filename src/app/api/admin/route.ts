import { NextRequest } from 'next/server'
import { getScoreIndex, getFeedbackList, getStats, getUserIndex, getUser, saveUser, getCurrentPeriod } from '@/lib/kv'
import type { UserRecord } from '@/lib/types'

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key')
  if (!key || key !== process.env.ADMIN_KEY) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [scores, feedback, stats, users] = await Promise.all([
    getScoreIndex(200),
    getFeedbackList(100),
    getStats(),
    getUserIndex(),
  ])

  return Response.json({ scores, feedback, stats, users })
}

// POST /api/admin?key=... — manual user operations
export async function POST(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key')
  if (!key || key !== process.env.ADMIN_KEY) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json() as { action: string; email: string; status?: UserRecord['subscriptionStatus'] }
  const { action, email } = body

  if (!email) return Response.json({ error: 'email required' }, { status: 400 })

  if (action === 'activate' || action === 'set_status') {
    const status = body.status ?? 'active'
    let user = await getUser(email)
    if (!user) {
      user = {
        id: email,
        subscriptionStatus: status,
        usage: { period: getCurrentPeriod(), sessions: 0, pdfs: 0, refreshes: 0 },
      }
    } else {
      user.subscriptionStatus = status
    }
    await saveUser(user)
    return Response.json({ ok: true, email, status })
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 })
}
