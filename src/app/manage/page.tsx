'use client'

import React, { useState, useEffect } from 'react'
import Nav from '@/components/Nav'

type Status = 'idle' | 'loading' | 'active' | 'not_found'

export default function ManagePage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [portalLoading, setPortalLoading] = useState(false)
  const [error, setError] = useState('')

  // Pre-fill email from localStorage if available
  useEffect(() => {
    const stored = localStorage.getItem('mpc_email')
    if (stored) setEmail(stored)
  }, [])

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setStatus('loading')

    const trimmed = email.trim().toLowerCase()
    try {
      const res = await fetch('/api/check-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      })
      const data = await res.json() as { active?: boolean }
      if (data.active) {
        // Store in localStorage so they're recognised everywhere
        localStorage.setItem('mpc_email', trimmed)
        localStorage.setItem('mpc_subscribed', 'true')
        setStatus('active')
      } else {
        setStatus('not_found')
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setStatus('idle')
    }
  }

  async function handlePortal() {
    setPortalLoading(true)
    setError('')
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Something went wrong.')
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setPortalLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen text-white"
      style={{
        background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(6,182,212,0.15) 0%, transparent 70%), #0a0a0f',
      }}
    >
      <Nav />

      <div className="flex min-h-screen items-center justify-center px-4 pt-16">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">

            {status !== 'active' ? (
              <>
                <h1 className="text-2xl font-bold text-white mb-2">Welcome back</h1>
                <p className="text-slate-400 text-sm mb-8">
                  Enter the email you used when you subscribed to restore access on this device.
                </p>

                <form onSubmit={handleCheck} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      Email address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setStatus('idle') }}
                      placeholder="you@example.com"
                      required
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                    />
                  </div>

                  {status === 'not_found' && (
                    <p className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
                      No active subscription found for that email. Try a different address, or{' '}
                      <a href="/" className="underline hover:text-amber-300">get started free</a>.
                    </p>
                  )}

                  {error && (
                    <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={status === 'loading' || !email.trim()}
                    className="w-full h-11 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold transition-all"
                  >
                    {status === 'loading' ? 'Checking…' : 'Restore access →'}
                  </button>
                </form>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-10 w-10 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-white">Active subscription</h1>
                    <p className="text-sm text-slate-400">{email}</p>
                  </div>
                </div>

                <p className="text-slate-400 text-sm mb-6">
                  You&apos;re all set. Run a new profile scan or manage your billing below.
                </p>

                <div className="space-y-3">
                  <a
                    href="/"
                    className="flex items-center justify-center w-full h-11 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-sm font-semibold transition-all"
                  >
                    Run a new profile scan →
                  </a>

                  <button
                    onClick={handlePortal}
                    disabled={portalLoading}
                    className="flex items-center justify-center w-full h-11 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-sm text-slate-300 font-medium transition-all"
                  >
                    {portalLoading ? 'Opening…' : 'Manage billing & cancel'}
                  </button>
                </div>

                {error && (
                  <p className="mt-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                    {error}
                  </p>
                )}
              </>
            )}
          </div>

          <p className="mt-6 text-center text-sm text-slate-500">
            Not a subscriber?{' '}
            <a href="/" className="text-cyan-400 hover:text-cyan-300">
              Get your free score →
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
