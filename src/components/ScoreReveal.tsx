'use client'

import { useEffect, useState } from 'react'
import type { ProfileScore, ParsedRole, SessionState } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Props {
  score: ProfileScore
  sessionId: string
  keywords: string[]
  parsedRoles?: ParsedRole[]
  onStartTransition?: (stage: string, jarvisTitle: string, duration: number) => void
  onSessionUpdate?: (session: SessionState) => void
}

function AnimatedScore({ target }: { target: number }) {
  const [displayed, setDisplayed] = useState(0)

  useEffect(() => {
    let start = 0
    const duration = 1000
    const step = 16
    const increment = target / (duration / step)

    const timer = setInterval(() => {
      start += increment
      if (start >= target) {
        setDisplayed(target)
        clearInterval(timer)
      } else {
        setDisplayed(Math.floor(start))
      }
    }, step)

    return () => clearInterval(timer)
  }, [target])

  return <span>{displayed}</span>
}

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.round((value / max) * 100)
  const color =
    pct >= 70 ? 'bg-emerald-500' : pct >= 45 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-slate-300 capitalize">{label}</span>
        <span className="font-medium text-slate-200 tabular-nums">{value}/{max}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}


export default function ScoreReveal({ score, sessionId, keywords, parsedRoles = [], onStartTransition, onSessionUpdate }: Props) {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [email, setEmail] = useState('')
  const [showEmailInput, setShowEmailInput] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [interviewLoading, setInterviewLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Global bypass via env var (dev/testing)
    if (process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true') {
      localStorage.setItem('mpc_subscribed', 'true')
    }
    // Secret access code — ?access=CODE grants free access and persists in localStorage
    const params = new URLSearchParams(window.location.search)
    const code = params.get('access')
    if (code === 'robs-friends') {
      localStorage.setItem('mpc_subscribed', 'true')
    }
    const stored = localStorage.getItem('mpc_subscribed')
    if (stored === 'true') setIsSubscribed(true)
    const storedEmail = localStorage.getItem('mpc_email')
    if (storedEmail) {
      setEmail(storedEmail)
      // Verify subscription server-side — catches returning subscribers on new devices
      // or when localStorage was cleared
      fetch('/api/check-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: storedEmail }),
      })
        .then(r => r.json())
        .then((d: { active?: boolean }) => {
          if (d.active) {
            localStorage.setItem('mpc_subscribed', 'true')
            setIsSubscribed(true)
          }
        })
        .catch(() => { /* non-critical */ })
    }
  }, [])

  async function handleCheckout() {
    if (!email.trim()) {
      setShowEmailInput(true)
      return
    }
    setCheckoutLoading(true)
    setError('')
    try {
      localStorage.setItem('mpc_email', email)
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, sessionId }),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (data.url) window.location.href = data.url
      else setError(data.error ?? 'Checkout failed')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setCheckoutLoading(false)
    }
  }

  async function handleStartInterview() {
    const userEmail = email || localStorage.getItem('mpc_email')
    if (!userEmail) {
      setError('Please enter your email address to continue.')
      return
    }
    setInterviewLoading(true)
    setError('')
    try {
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, userEmail }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const msg = (data as { error?: string }).error ?? 'Failed to start interview'
        if (res.status === 403) {
          // Subscription not yet activated. Try to verify payment directly
          // (catches the race where the user clicks before verify-payment finishes).
          const cs = new URLSearchParams(window.location.search).get('cs')
          if (cs?.startsWith('cs_')) {
            const verifyRes = await fetch('/api/stripe/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ checkoutSessionId: cs }),
            })
            if (verifyRes.ok) {
              const v = await verifyRes.json() as { activated?: boolean }
              if (v.activated) {
                // Retry the interview call now that the user is activated
                const retry = await fetch('/api/interview', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ sessionId, userEmail }),
                })
                if (retry.ok) {
                  onStartTransition?.('interviewing', 'Preparing Interview', 15000)
                  const sessionRes = await fetch(`/api/session/${sessionId}`, { cache: 'no-store' })
                  if (sessionRes.ok && onSessionUpdate) {
                    const updated = await sessionRes.json()
                    onSessionUpdate(updated)
                  }
                  return
                }
              }
            }
          }
          throw new Error('Payment processing — please wait a moment and try again. If this persists, email rob@myprofilecoach.com with your receipt.')
        }
        throw new Error(msg)
      }
      // API succeeded — now activate Jarvis and fetch updated session
      onStartTransition?.('interviewing', 'Preparing Interview', 15000)
      const sessionRes = await fetch(`/api/session/${sessionId}`, { cache: 'no-store' })
      if (sessionRes.ok && onSessionUpdate) {
        const updated = await sessionRes.json()
        onSessionUpdate(updated)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start interview')
      setInterviewLoading(false)
    }
  }

  const overallColor =
    score.overall >= 70
      ? 'text-emerald-400'
      : score.overall >= 45
      ? 'text-yellow-400'
      : 'text-red-400'

  const visibleKeywords = keywords.slice(0, 3)
  const hiddenCount = Math.max(0, keywords.length - 3)

  return (
    <div className="min-h-screen text-slate-100 px-4 py-12 relative z-10">
      <div className="mx-auto max-w-2xl space-y-8">

        {/* Score hero */}
        <div className="text-center">
          <p className="text-slate-400 text-sm uppercase tracking-widest mb-2">Your LinkedIn Score</p>
          <div className={`text-8xl font-bold tabular-nums ${overallColor} mb-2`}>
            <AnimatedScore target={score.overall} />
          </div>
          <p className="text-slate-400 text-sm">out of 100</p>
          <p className="mt-3 text-slate-300 text-base">
            Target role:{' '}
            <span className="font-medium text-cyan-300">{score.targetRole}</span>
          </p>
        </div>

        {/* Breakdown */}
        <Card className="bg-slate-900/70 backdrop-blur-md border-white/[0.06]">
          <CardContent className="pt-6 pb-6 space-y-4">
            <h2 className="font-semibold text-slate-200 mb-4">Score Breakdown</h2>
            <ScoreBar label="Headline" value={score.breakdown.headline} max={20} />
            <ScoreBar label="About / Summary" value={score.breakdown.about} max={20} />
            <ScoreBar label="Experience Bullets" value={score.breakdown.experience} max={30} />
            <ScoreBar label="Keyword Coverage" value={score.breakdown.keywords} max={20} />
            <ScoreBar label="AI Visibility Signals" value={score.breakdown.aiSignals} max={10} />
          </CardContent>
        </Card>

        {/* Top problems */}
        <Card className="bg-slate-900/70 backdrop-blur-md border-white/[0.06]">
          <CardContent className="pt-6 pb-6">
            <h2 className="font-semibold text-slate-200 mb-4">
              Critical Issues Found
            </h2>
            <ul className="space-y-3">
              {score.topProblems.map((problem, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 flex-shrink-0 h-5 w-5 rounded-full bg-red-500/20 text-red-400 text-xs flex items-center justify-center font-bold">
                    !
                  </span>
                  <span className="text-slate-300 text-sm leading-relaxed">{problem}</span>
                </li>
              ))}
            </ul>

            {/* Lock wall */}
            {!isSubscribed && (
              <div className="mt-6 rounded-xl border border-slate-600 bg-slate-900/60 p-4 relative overflow-hidden">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-slate-400 text-sm">
                    <span className="font-semibold text-slate-200">2 more critical issues</span> found in your profile
                  </span>
                  <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">Locked</Badge>
                </div>
                <div className="space-y-2 opacity-30 select-none blur-[3px]">
                  <div className="h-4 rounded bg-slate-600 w-3/4" />
                  <div className="h-4 rounded bg-slate-600 w-1/2" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-slate-500 text-xs">Unlock with Pro</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Keyword preview */}
        <Card className="bg-slate-900/70 backdrop-blur-md border-white/[0.06]">
          <CardContent className="pt-6 pb-6">
            <h2 className="font-semibold text-slate-200 mb-1">Keyword Gap Analysis</h2>
            <p className="text-slate-400 text-sm mb-4">
              Keywords recruiters search for that are missing from your profile
            </p>
            <div className="flex flex-wrap gap-2">
              {visibleKeywords.map((kw) => (
                <Badge key={kw} variant="outline" className="border-red-500/40 text-red-300 bg-red-500/10 text-xs">
                  {kw}
                </Badge>
              ))}
              {hiddenCount > 0 && (
                <div className="relative">
                  <div className="flex flex-wrap gap-2 blur-sm select-none pointer-events-none">
                    {Array.from({ length: Math.min(hiddenCount, 5) }).map((_, i) => (
                      <Badge key={i} variant="outline" className="border-slate-600 text-slate-500 text-xs">
                        keyword
                      </Badge>
                    ))}
                  </div>
                  {!isSubscribed && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                        +{hiddenCount} more hidden
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm text-center">
            {error}
          </div>
        )}

        {/* Roles detected — lets users verify all jobs were captured */}
        {parsedRoles.length > 0 && (
          <div className="rounded-xl border border-white/8 bg-white/3 px-4 py-3 space-y-1.5">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Roles detected ({parsedRoles.length})
            </p>
            <ul className="space-y-0.5">
              {parsedRoles.map((r, i) => (
                <li key={i} className="text-sm text-slate-300">
                  <span className="font-medium">{r.title}</span>
                  <span className="text-slate-500"> · {r.company}</span>
                  {r.startDate && <span className="text-slate-600 text-xs ml-1">({r.startDate}{r.endDate ? `–${r.endDate}` : '–present'})</span>}
                </li>
              ))}
            </ul>
            {parsedRoles.length === 1 && (
              <p className="text-xs text-amber-400/80 mt-1">
                Only 1 role found. If you have more experience, paste your profile manually for better results.
              </p>
            )}
          </div>
        )}

        {/* CTA */}
        {isSubscribed ? (
          <div className="space-y-3 text-center">
            <p className="text-slate-400 text-sm">You have an active subscription.</p>
            {!email && (
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-600 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-sm"
              />
            )}
            <Button
              onClick={handleStartInterview}
              className="w-full h-12 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-xl text-base"
            >
              Start AI Interview →
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-cyan-500/30 bg-slate-900/70 backdrop-blur-md p-8 text-center space-y-4">
            <h3 className="text-xl font-bold text-slate-100">Fix your profile — fully</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              AI will interview you, surface your real achievements, and rewrite every section of your LinkedIn profile to rank in recruiter searches.
            </p>
            <ul className="text-sm text-slate-300 space-y-2 text-left max-w-xs mx-auto">
              {[
                'All critical issues unlocked',
                'Full keyword gap list (20+ terms)',
                'AI interview + profile rewrite',
                'Copy-paste ready output',
              ].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className="text-cyan-400">✓</span> {f}
                </li>
              ))}
            </ul>
            {showEmailInput && (
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-600 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-sm"
              />
            )}
            <Button
              onClick={handleCheckout}
              disabled={checkoutLoading}
              className="w-full h-12 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-xl text-base disabled:opacity-60"
            >
              {checkoutLoading ? 'Redirecting to checkout...' : 'Fix my profile — $20/mo, cancel anytime'}
            </Button>
            <p className="text-xs text-slate-500">Stripe secure checkout. Cancel any time.</p>
          </div>
        )}
      </div>
    </div>
  )
}
