import { NextRequest } from 'next/server'
import { getSession } from '@/lib/kv'
import type { SessionState } from '@/lib/types'
import { logger } from '@/lib/logger'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return Response.json({ error: 'Session ID is required' }, { status: 400 })
    }

    logger.info('/api/session/[id]', 'session fetch started', { id })

    const session = await getSession(id)

    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 })
    }

    // Strip rawProfile to keep response lean
    const { rawProfile: _rawProfile, ...safeSession } = session as SessionState & { rawProfile: string }

    logger.info('/api/session/[id]', 'session fetched', { id, stage: safeSession.stage })

    return Response.json(safeSession)
  } catch (err) {
    logger.error('/api/session/[id]', 'session fetch failed', err)
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
