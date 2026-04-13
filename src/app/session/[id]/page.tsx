'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useParams } from 'next/navigation'
import type { SessionState } from '@/lib/types'
import ScoreReveal from '@/components/ScoreReveal'
import InterviewPhase from '@/components/InterviewPhase'
import SuggestionReview from '@/components/SuggestionReview'
import OutputPage from '@/components/OutputPage'
import Nav from '@/components/Nav'
import { useJarvis } from '@/components/JarvisContext'

function PaidDetector() {
  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams.get('paid') === 'true') {
      localStorage.setItem('mpc_subscribed', 'true')
    }
  }, [searchParams])
  return null
}

// Map stages to loading messages
const LOADING_CONFIG: Record<string, { title: string; duration: number }> = {
  scoring: { title: 'Analyzing Profile', duration: 120000 },
  scored_no_data: { title: 'Scoring Profile', duration: 30000 },
  interviewing_no_data: { title: 'Generating Questions', duration: 15000 },
  answering_no_data: { title: 'Generating Questions', duration: 15000 },
  processing: { title: 'Building Suggestions', duration: 30000 },
  suggestions_no_data: { title: 'Building Suggestions', duration: 30000 },
  reviewing_no_data: { title: 'Building Suggestions', duration: 30000 },
  finalizing: { title: 'Finalizing Profile', duration: 60000 },
  complete_no_data: { title: 'Finalizing Profile', duration: 60000 },
  pdf_ready_no_data: { title: 'Finalizing Profile', duration: 60000 },
  loading: { title: 'Loading Session', duration: 10000 },
  fallback: { title: 'Analyzing Profile', duration: 120000 },
}

export default function SessionPage() {
  const { id } = useParams<{ id: string }>()
  const [session, setSession] = useState<SessionState | null | 'loading'>('loading')
  const { activate, deactivate, state: jarvisState } = useJarvis()

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch(`/api/session/${id}`, { cache: 'no-store' })
        if (!res.ok) { if (!cancelled) setSession(null); return }
        const data = await res.json()
        if (!cancelled) setSession(data)
        return data
      } catch {
        if (!cancelled) setSession(null)
      }
    }

    const POLLING_STAGES = new Set(['scoring', 'scored', 'interviewing', 'answering', 'processing', 'suggestions', 'reviewing', 'finalizing'])

    async function poll() {
      const data = await load()
      if (!data || cancelled) return
      if (POLLING_STAGES.has(data.stage)) {
        setTimeout(poll, 3000)
      }
    }

    poll()
    return () => { cancelled = true }
  }, [id])

  // Determine if we're in a loading state and manage Jarvis mode
  useEffect(() => {
    if (session === 'loading') {
      activate('Loading Session', { expectedDuration: 10000 })
      return
    }
    if (!session) {
      deactivate()
      return
    }

    const { stage } = session
    let loadingKey: string | null = null

    if (stage === 'scoring' || stage === 'finalizing') {
      loadingKey = stage
    } else if (stage === 'processing') {
      loadingKey = 'processing'
    } else if (stage === 'scored' && !session.score) {
      loadingKey = 'scored_no_data'
    } else if ((stage === 'interviewing' || stage === 'answering') && !session.interviewQuestions) {
      loadingKey = `${stage}_no_data`
    } else if ((stage === 'suggestions' || stage === 'reviewing') && !session.suggestionCards) {
      loadingKey = `${stage}_no_data`
    } else if ((stage === 'complete' || stage === 'pdf_ready') && !session.finalizedLinkedIn) {
      loadingKey = `${stage}_no_data`
    }

    if (loadingKey) {
      const config = LOADING_CONFIG[loadingKey] ?? LOADING_CONFIG.fallback
      activate(config.title, { expectedDuration: config.duration })
    } else {
      deactivate()
    }
  }, [session, activate, deactivate])

  // Loading / not found states — Jarvis handles the animation
  if (session === 'loading') {
    return <Suspense fallback={null}><PaidDetector /></Suspense>
  }

  if (!session) {
    return (
      <>
        <Nav />
        <div className="min-h-screen flex items-center justify-center pt-16">
          <p className="text-slate-400">Session not found. <a href="/" className="text-cyan-400 underline">Start over</a></p>
        </div>
      </>
    )
  }

  // If Jarvis is active (loading), render nothing — the HUD overlay shows
  if (jarvisState.mode === 'active') {
    return <Suspense fallback={null}><PaidDetector /></Suspense>
  }

  // Content states
  const { stage } = session
  let content: React.ReactNode

  if (stage === 'scored' && session.score) {
    content = <ScoreReveal score={session.score} sessionId={session.id} keywords={session.keywords ?? []} parsedRoles={session.parsedProfile?.roles ?? []} />
  } else if ((stage === 'interviewing' || stage === 'answering') && session.interviewQuestions) {
    content = <InterviewPhase questions={session.interviewQuestions} sessionId={session.id} />
  } else if ((stage === 'suggestions' || stage === 'reviewing') && session.suggestionCards) {
    content = <SuggestionReview cards={session.suggestionCards} sessionId={session.id} />
  } else if ((stage === 'complete' || stage === 'pdf_ready') && session.finalizedLinkedIn) {
    content = <OutputPage output={session.finalizedLinkedIn} sessionId={session.id} />
  } else {
    return <Suspense fallback={null}><PaidDetector /></Suspense>
  }

  return (
    <>
      <Suspense fallback={null}><PaidDetector /></Suspense>
      <Nav />
      <div className="pt-16">{content}</div>
    </>
  )
}
