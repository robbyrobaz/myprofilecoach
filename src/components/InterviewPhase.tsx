'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { InterviewQuestion } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { useJarvis } from '@/components/JarvisContext'

interface Props {
  questions: InterviewQuestion[]
  sessionId: string
}

export default function InterviewPhase({ questions, sessionId }: Props) {
  const router = useRouter()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const total = questions.length
  const current = questions[currentIndex]
  const isLast = currentIndex === total - 1

  function handleNext() {
    if (currentAnswer.trim()) {
      setAnswers((prev) => ({ ...prev, [currentIndex]: currentAnswer.trim() }))
    }
    if (isLast) {
      submitAnswers({ ...answers, [currentIndex]: currentAnswer.trim() })
    } else {
      setCurrentIndex((i) => i + 1)
      setCurrentAnswer('')
    }
  }

  function handleSkip() {
    if (isLast) {
      submitAnswers(answers)
    } else {
      setCurrentIndex((i) => i + 1)
      setCurrentAnswer('')
    }
  }

  function handleSkipAll() {
    submitAnswers(answers)
  }

  async function submitAnswers(finalAnswers: Record<number, string>) {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, answers: finalAnswers }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string })?.error ?? 'Failed to submit answers')
      }
      router.push(`/session/${sessionId}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  const { activate } = useJarvis()

  useEffect(() => {
    if (submitting) {
      activate('Analyzing Your Experience', { expectedDuration: 20000 })
    }
  }, [submitting, activate])

  if (submitting) return null // Jarvis overlay handles the UI

  return (
    <div className="min-h-screen text-slate-100 px-4 py-12 relative z-10">
      <div className="mx-auto max-w-2xl space-y-8">

        {/* Progress */}
        <div>
          <div className="flex justify-between text-sm text-slate-400 mb-2">
            <span>Question {currentIndex + 1} of {total}</span>
            <button
              onClick={handleSkipAll}
              className="text-slate-500 hover:text-slate-300 transition-colors text-xs underline underline-offset-2"
            >
              Skip remaining
            </button>
          </div>
          <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-cyan-500 transition-all duration-500"
              style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
            />
          </div>
        </div>

        {/* Question card */}
        <Card className="bg-white/[0.04] backdrop-blur-sm border-white/[0.06]">
          <CardContent className="pt-8 pb-8 space-y-6">
            {/* Context */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                About your role at
              </span>
              <span className="text-sm font-semibold text-cyan-300">{current.company}</span>
            </div>

            {/* Question */}
            <h2 className="text-xl font-semibold text-slate-100 leading-snug">
              {current.question}
            </h2>

            {/* Hint */}
            {current.hint && (
              <p className="text-sm text-slate-500 italic border-l-2 border-slate-600 pl-3">
                Hint: {current.hint}
              </p>
            )}

            {/* Answer input */}
            <div>
              <Textarea
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                placeholder="Write a few sentences about your experience, achievements, or impact. Raw notes are fine — AI will polish them."
                className="min-h-36 bg-slate-900/50 border-slate-600 text-slate-100 placeholder:text-slate-500 focus-visible:border-cyan-500 focus-visible:ring-cyan-500/20 resize-none"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handleSkip}
                className="text-sm text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2"
              >
                Skip this one
              </button>
              <Button
                onClick={handleNext}
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-xl px-6"
              >
                {isLast ? 'Submit answers →' : 'Next →'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Answered summary */}
        {Object.keys(answers).length > 0 && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.04] backdrop-blur-sm p-4">
            <p className="text-xs text-slate-400 mb-2 uppercase tracking-wider">Answered so far</p>
            <div className="space-y-1">
              {Object.entries(answers).map(([idx, ans]) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <span className="text-cyan-400 flex-shrink-0">✓</span>
                  <span className="text-slate-400 truncate">{ans.slice(0, 80)}{ans.length > 80 ? '…' : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
