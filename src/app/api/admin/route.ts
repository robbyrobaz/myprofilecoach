import { NextRequest } from 'next/server'
import { getScoreIndex, getFeedbackList } from '@/lib/kv'

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key')
  if (!key || key !== process.env.ADMIN_KEY) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [scores, feedback] = await Promise.all([
    getScoreIndex(200),
    getFeedbackList(100),
  ])

  return Response.json({ scores, feedback })
}
