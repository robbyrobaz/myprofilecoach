'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useParams } from 'next/navigation'
import type { SessionState } from '@/lib/types'
import ScoreReveal from '@/components/ScoreReveal'
import InterviewPhase from '@/components/InterviewPhase'
import SuggestionReview from '@/components/SuggestionReview'
import OutputPage from '@/components/OutputPage'
import Nav from '@/components/Nav'
import { LoadingHUD } from '@/components/AnalysisHUD'

// Isolated component so useSearchParams doesn't block the whole page
function PaidDetector() {
  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams.get('paid') === 'true') {
      localStorage.setItem('mpc_subscribed', 'true')
    }
  }, [searchParams])
  return null
}

export default function SessionPage() {
  const { id } = useParams<{ id: string }>()
  const [session, setSession] = useState<SessionState | null | 'loading'>('loading')

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

    // Stages that mean Claude is still working — keep polling
    const POLLING_STAGES = new Set(['scoring', 'scored', 'interviewing', 'answering', 'processing', 'suggestions', 'reviewing', 'finalizing'])

    async function poll() {
      const data = await load()
      if (!data || cancelled) return
      if (POLLING_STAGES.has(data.stage)) {
        // Poll every 3s until stage settles into a renderable state
        setTimeout(poll, 3000)
      }
    }

    poll()
    return () => { cancelled = true }
  }, [id])

  if (session === 'loading') {
    return (
      <>
        <Suspense fallback={null}><PaidDetector /></Suspense>
        <LoadingHUD message="Loading Session" expectedDuration={10000} />
      </>
    )
  }

  if (!session) {
    return (
      <>
        <Nav />
        <div className="min-h-screen flex items-center justify-center pt-16">
          <p className="text-slate-400">Session not found. <a href="/" className="text-indigo-400 underline">Start over</a></p>
        </div>
      </>
    )
  }

  const { stage } = session

  // Loading states — full-screen HUD takeover (no Nav)
  if (stage === 'scored' && !session.score) {
    return <><Suspense fallback={null}><PaidDetector /></Suspense><LoadingHUD message="Scoring Profile" expectedDuration={30000} /></>
  }
  if ((stage === 'interviewing' || stage === 'answering') && !session.interviewQuestions) {
    return <><Suspense fallback={null}><PaidDetector /></Suspense><LoadingHUD message="Generating Questions" expectedDuration={15000} /></>
  }
  if ((stage === 'suggestions' || stage === 'reviewing') && !session.suggestionCards) {
    return <><Suspense fallback={null}><PaidDetector /></Suspense><LoadingHUD message="Building Suggestions" expectedDuration={30000} /></>
  }
  if ((stage === 'complete' || stage === 'pdf_ready') && !session.finalizedLinkedIn) {
    return <><Suspense fallback={null}><PaidDetector /></Suspense><LoadingHUD message="Finalizing Profile" expectedDuration={60000} /></>
  }
  if (stage === 'processing') {
    return <><Suspense fallback={null}><PaidDetector /></Suspense><LoadingHUD message="Building Suggestions" expectedDuration={30000} /></>
  }
  if (stage === 'scoring' || stage === 'finalizing') {
    return <><Suspense fallback={null}><PaidDetector /></Suspense><LoadingHUD message="Analyzing Profile" expectedDuration={120000} /></>
  }

  // Content states — show with Nav
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
    return <><Suspense fallback={null}><PaidDetector /></Suspense><LoadingHUD message="Analyzing Profile" expectedDuration={120000} /></>
  }

  return (
    <>
      <Suspense fallback={null}><PaidDetector /></Suspense>
      <Nav />
      <div className="pt-16">{content}</div>
    </>
  )
}

