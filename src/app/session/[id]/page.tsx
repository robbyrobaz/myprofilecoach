import { notFound } from 'next/navigation'
import type { SessionState } from '@/lib/types'
import ScoreReveal from '@/components/ScoreReveal'
import InterviewPhase from '@/components/InterviewPhase'
import SuggestionReview from '@/components/SuggestionReview'
import OutputPage from '@/components/OutputPage'

async function getSession(id: string): Promise<SessionState | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/session/${id}`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    return res.json() as Promise<SessionState>
  } catch {
    return null
  }
}

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getSession(id)

  if (!session) {
    notFound()
  }

  const { stage } = session

  if (stage === 'scored') {
    if (!session.score) notFound()
    return (
      <ScoreReveal
        score={session.score}
        sessionId={session.id}
        keywords={session.keywords ?? []}
      />
    )
  }

  if (stage === 'interviewing' || stage === 'answering') {
    if (!session.interviewQuestions) notFound()
    return (
      <InterviewPhase
        questions={session.interviewQuestions}
        sessionId={session.id}
      />
    )
  }

  if (stage === 'suggestions' || stage === 'reviewing') {
    if (!session.suggestionCards) notFound()
    return (
      <SuggestionReview
        cards={session.suggestionCards}
        sessionId={session.id}
      />
    )
  }

  if (stage === 'complete' || stage === 'pdf_ready') {
    if (!session.finalizedLinkedIn) notFound()
    return (
      <OutputPage
        output={session.finalizedLinkedIn}
        sessionId={session.id}
      />
    )
  }

  // Processing / scoring / finalizing — show a loading state
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="text-center">
        <svg
          className="animate-spin h-10 w-10 text-indigo-400 mx-auto mb-4"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-slate-300 font-medium text-lg mb-1">Claude is working...</p>
        <p className="text-slate-500 text-sm">This page will update automatically.</p>
      </div>
    </div>
  )
}
