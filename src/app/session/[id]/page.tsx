'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useParams } from 'next/navigation'
import type { SessionState } from '@/lib/types'
import ScoreReveal from '@/components/ScoreReveal'
import InterviewPhase from '@/components/InterviewPhase'
import SuggestionReview from '@/components/SuggestionReview'
import OutputPage from '@/components/OutputPage'

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
    async function load() {
      try {
        const res = await fetch(`/api/session/${id}`, { cache: 'no-store' })
        if (!res.ok) { setSession(null); return }
        setSession(await res.json())
      } catch {
        setSession(null)
      }
    }
    load()
  }, [id])

  if (session === 'loading') {
    return (
      <>
        <Suspense fallback={null}><PaidDetector /></Suspense>
        <Spinner message="Loading your session..." />
      </>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-slate-400">Session not found. <a href="/" className="text-indigo-400 underline">Start over</a></p>
      </div>
    )
  }

  const { stage } = session

  let content: React.ReactNode
  if (stage === 'scored') {
    content = session.score
      ? <ScoreReveal score={session.score} sessionId={session.id} keywords={session.keywords ?? []} />
      : <Spinner message="Scoring your profile..." />
  } else if (stage === 'interviewing' || stage === 'answering') {
    content = session.interviewQuestions
      ? <InterviewPhase questions={session.interviewQuestions} sessionId={session.id} />
      : <Spinner message="Generating questions..." />
  } else if (stage === 'suggestions' || stage === 'reviewing') {
    content = session.suggestionCards
      ? <SuggestionReview cards={session.suggestionCards} sessionId={session.id} />
      : <Spinner message="Building suggestions..." />
  } else if (stage === 'complete' || stage === 'pdf_ready') {
    content = session.finalizedLinkedIn
      ? <OutputPage output={session.finalizedLinkedIn} sessionId={session.id} />
      : <Spinner message="Finalizing profile..." />
  } else {
    content = <Spinner message="Claude is working..." />
  }

  return (
    <>
      <Suspense fallback={null}><PaidDetector /></Suspense>
      {content}
    </>
  )
}

function Spinner({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="text-center">
        <svg className="animate-spin h-10 w-10 text-indigo-400 mx-auto mb-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-slate-300 font-medium text-lg mb-1">{message}</p>
        <p className="text-slate-500 text-sm">Hang tight — this takes 10–20 seconds.</p>
      </div>
    </div>
  )
}
