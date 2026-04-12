import { NextRequest } from 'next/server'
import { getScoreIndex, getFeedbackList, getStats, getUserIndex } from '@/lib/kv'

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
