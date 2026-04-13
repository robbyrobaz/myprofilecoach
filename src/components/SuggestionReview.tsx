'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { SuggestionCard } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useJarvis } from '@/components/JarvisContext'

interface Props {
  cards: SuggestionCard[]
  sessionId: string
}

type CardState = SuggestionCard & { _editDraft?: string }

export default function SuggestionReview({ cards: initialCards, sessionId }: Props) {
  const router = useRouter()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [cardStates, setCardStates] = useState<CardState[]>(
    initialCards.map((c) => ({ ...c, status: 'pending' as const }))
  )
  const [editing, setEditing] = useState(false)
  const [editDraft, setEditDraft] = useState('')
  const [finalizing, setFinalizing] = useState(false)
  const [error, setError] = useState('')

  const total = cardStates.length
  const current = cardStates[currentIndex]
  const reviewed = cardStates.filter((c) => c.status !== 'pending').length
  const allReviewed = reviewed === total

  function updateCard(index: number, patch: Partial<CardState>) {
    setCardStates((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...patch } : c))
    )
  }

  function handleApprove() {
    updateCard(currentIndex, { status: 'approved' })
    setEditing(false)
    advance()
  }

  function handleEdit() {
    setEditDraft(current.suggested)
    setEditing(true)
  }

  function handleSaveEdit() {
    updateCard(currentIndex, { status: 'edited', editedText: editDraft })
    setEditing(false)
    advance()
  }

  function handleSkip() {
    updateCard(currentIndex, { status: 'skipped' })
    setEditing(false)
    advance()
  }

  function advance() {
    if (currentIndex < total - 1) {
      setCurrentIndex((i) => i + 1)
    }
  }

  function jumpTo(index: number) {
    setEditing(false)
    setCurrentIndex(index)
  }

  async function handleFinalize() {
    setFinalizing(true)
    setError('')
    try {
      const res = await fetch('/api/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, cards: cardStates }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string })?.error ?? 'Failed to finalize profile')
      }
      router.push(`/session/${sessionId}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setFinalizing(false)
    }
  }

  const { activate } = useJarvis()

  useEffect(() => {
    if (finalizing) {
      activate('Finalizing Profile', { expectedDuration: 60000 })
    }
  }, [finalizing, activate])

  if (finalizing) return null // Jarvis overlay handles the UI

  const statusBadge = (status: SuggestionCard['status']) => {
    if (status === 'approved') return <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs">Approved</Badge>
    if (status === 'edited') return <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">Edited</Badge>
    if (status === 'skipped') return <Badge variant="outline" className="border-slate-600 text-slate-500 text-xs">Skipped</Badge>
    return <Badge variant="outline" className="border-slate-600 text-slate-400 text-xs">Pending</Badge>
  }

  return (
    <div className="min-h-screen text-slate-100 px-4 py-12 relative z-10">
      <div className="mx-auto max-w-2xl space-y-8">

        {/* Progress header */}
        <div>
          <div className="flex justify-between items-center text-sm text-slate-400 mb-2">
            <span>{reviewed} of {total} reviewed</span>
            <span className="text-cyan-300 font-medium">
              {current.label}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-cyan-500 transition-all duration-500"
              style={{ width: `${(reviewed / total) * 100}%` }}
            />
          </div>
        </div>

        {/* Card navigator dots */}
        <div className="flex flex-wrap gap-2">
          {cardStates.map((c, i) => {
            const dotColor =
              c.status === 'approved'
                ? 'bg-emerald-500'
                : c.status === 'edited'
                ? 'bg-blue-500'
                : c.status === 'skipped'
                ? 'bg-slate-600'
                : i === currentIndex
                ? 'bg-cyan-500'
                : 'bg-slate-700'
            return (
              <button
                key={i}
                onClick={() => jumpTo(i)}
                className={`h-2 rounded-full transition-all ${i === currentIndex ? 'w-6' : 'w-2'} ${dotColor}`}
                title={c.label}
              />
            )
          })}
        </div>

        {/* Suggestion card */}
        <Card className="bg-white/[0.04] backdrop-blur-sm border-white/[0.06]">
          <CardContent className="pt-6 pb-6 space-y-5">

            {/* Label + status */}
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-200 text-lg">{current.label}</h2>
              {statusBadge(current.status)}
            </div>

            {/* Before */}
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Before</p>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4 text-sm text-slate-400 leading-relaxed line-through decoration-slate-600">
                {current.current || <span className="no-underline italic">No existing content</span>}
              </div>
            </div>

            {/* After */}
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">After (AI suggestion)</p>
              {editing ? (
                <div className="space-y-2">
                  <Textarea
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    className="min-h-28 bg-slate-900/50 border-emerald-500/40 text-slate-100 placeholder:text-slate-500 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20 resize-none"
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="ghost"
                      onClick={() => setEditing(false)}
                      className="text-slate-400 hover:text-slate-200"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveEdit}
                      className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
                    >
                      Save Edit
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-100 leading-relaxed">
                  {current.status === 'edited' && current.editedText
                    ? current.editedText
                    : current.suggested}
                </div>
              )}
            </div>

            {/* Reason */}
            {current.reason && (
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Why this matters</p>
                <p className="text-sm text-slate-300 leading-relaxed">{current.reason}</p>
              </div>
            )}

            {/* Action buttons */}
            {!editing && (
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleApprove}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl"
                >
                  ✓ Approve
                </Button>
                <Button
                  onClick={handleEdit}
                  variant="outline"
                  className="flex-1 border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white rounded-xl"
                >
                  ✎ Edit
                </Button>
                <Button
                  onClick={handleSkip}
                  variant="ghost"
                  className="flex-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-xl"
                >
                  Skip
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {error && (
          <p className="text-sm text-red-400 text-center">{error}</p>
        )}

        {/* Finalize CTA */}
        {allReviewed && (
          <div className="text-center space-y-3">
            <p className="text-slate-400 text-sm">All cards reviewed. Ready to build your optimized profile.</p>
            <Button
              onClick={handleFinalize}
              className="w-full h-12 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-xl text-base"
            >
              Finalize Profile →
            </Button>
          </div>
        )}

        {/* Early finalize option */}
        {!allReviewed && reviewed > 0 && (
          <div className="text-center">
            <button
              onClick={handleFinalize}
              className="text-sm text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2"
            >
              Finalize with current selections ({reviewed}/{total} reviewed)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
