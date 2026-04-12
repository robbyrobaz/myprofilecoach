import { NextRequest } from 'next/server'
import { getSession } from '@/lib/kv'
import type { SessionState } from '@/lib/types'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return Response.json({ error: 'Session ID is required' }, { status: 400 })
    }

    const session = await getSession(id)

    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 })
    }

    // Strip rawProfile to keep response lean
    const { rawProfile: _rawProfile, ...safeSession } = session as SessionState & { rawProfile: string }

    return Response.json(safeSession)
  } catch (err) {
    console.error('[/api/session/:id] error:', err)
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
