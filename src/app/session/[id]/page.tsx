'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { SessionState } from '@/lib/types'
import ScoreReveal from '@/components/ScoreReveal'
import InterviewPhase from '@/components/InterviewPhase'
import SuggestionReview from '@/components/SuggestionReview'
import OutputPage from '@/components/OutputPage'

export default function SessionPage({
  params,
}: {
  params: { id: string }
}) {
  const { id } = params
  const searchParams = useSearchParams()
  const [session, setSession] = useState<SessionState | null | 'loading'>('loading')

  useEffect(() => {
    // If returning from Stripe with ?paid=true, mark as subscribed in localStorage
    if (searchParams.get('paid') === 'true') {
      localStorage.setItem('mpc_subscribed', 'true')
    }
  }, [searchParams])

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
    return <Spinner message="Loading your session..." />
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-slate-400">Session not found. <a href="/" className="text-indigo-400 underline">Start over</a></p>
      </div>
    )
  }

  const { stage } = session

  if (stage === 'scored') {
    if (!session.score) return <Spinner message="Scoring your profile..." />
    return (
      <ScoreReveal
        score={session.score}
        sessionId={session.id}
        keywords={session.keywords ?? []}
      />
    )
  }

  if (stage === 'interviewing' || stage === 'answering') {
    if (!session.interviewQuestions) return <Spinner message="Generating questions..." />
    return (
      <InterviewPhase
        questions={session.interviewQuestions}
        sessionId={session.id}
      />
    )
  }

  if (stage === 'suggestions' || stage === 'reviewing') {
    if (!session.suggestionCards) return <Spinner message="Building suggestions..." />
    return (
      <SuggestionReview
        cards={session.suggestionCards}
        sessionId={session.id}
      />
    )
  }

  if (stage === 'complete' || stage === 'pdf_ready') {
    if (!session.finalizedLinkedIn) return <Spinner message="Finalizing profile..." />
    return (
      <OutputPage
        output={session.finalizedLinkedIn}
        sessionId={session.id}
      />
    )
  }

  return <Spinner message="Claude is working..." />
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
