'use client'

import React, { useState } from 'react'
import Nav from '@/components/Nav'

export default function ManagePage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? 'Something went wrong.')
      }
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen text-white"
      style={{
        background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.2) 0%, transparent 70%), #0a0a0f',
      }}
    >
      <Nav />

      <div className="flex min-h-screen items-center justify-center px-4 pt-16">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
            <h1 className="text-2xl font-bold text-white mb-2">Manage subscription</h1>
            <p className="text-slate-400 text-sm mb-8">
              Enter the email address you used when subscribing. We&apos;ll open the Stripe customer
              portal where you can update your payment method, view invoices, or cancel.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold transition-all"
              >
                {loading ? 'Opening portal…' : 'Open subscription portal →'}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-slate-500">
              You&apos;ll be redirected to Stripe&apos;s secure portal. No password needed.
            </p>
          </div>

          <p className="mt-6 text-center text-sm text-slate-500">
            Not a subscriber yet?{' '}
            <a href="/" className="text-indigo-400 hover:text-indigo-300">
              Get started free →
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
