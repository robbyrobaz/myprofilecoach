import { NextRequest } from 'next/server'
import { getUser } from '@/lib/kv'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json() as { email?: string }
    if (!email || !email.includes('@')) {
      return Response.json({ active: false })
    }
    const user = await getUser(email)
    const active = user?.subscriptionStatus === 'active' || user?.subscriptionStatus === 'trialing'
    return Response.json({ active })
  } catch {
    return Response.json({ active: false })
  }
}
