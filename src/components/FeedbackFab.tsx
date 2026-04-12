'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'

export default function FeedbackFab() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const pathname = usePathname()

  // Extract sessionId from URL if on a session page
  const sessionId = pathname?.match(/\/session\/([^/]+)/)?.[1] ?? undefined

  async function submit() {
    if (!message.trim()) return
    setStatus('sending')
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message, email: email || undefined, page: pathname }),
      })
      setStatus('done')
      setTimeout(() => { setOpen(false); setStatus('idle'); setMessage(''); setEmail('') }, 2000)
    } catch {
      setStatus('error')
    }
  }

  // Don't show on admin page
  if (pathname?.startsWith('/admin')) return null

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-700/90 hover:bg-slate-600 text-slate-200 text-sm font-medium shadow-lg backdrop-blur-sm border border-slate-600/50 transition-all hover:scale-105"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
          </svg>
          Feedback
        </button>
      )}

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { if (status !== 'sending') setOpen(false) }} />

          {/* Panel */}
          <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold text-slate-100">Send feedback</p>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {status === 'done' ? (
              <p className="text-sm text-emerald-400 py-4 text-center">Thanks! We&apos;ll review your feedback.</p>
            ) : (
              <>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="What went wrong, or what could be better?"
                  rows={4}
                  autoFocus
                  className="w-full rounded-lg bg-slate-900 border border-slate-600 text-slate-100 placeholder-slate-500 text-sm p-3 resize-none focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Email (optional — if you want a reply)"
                  className="w-full rounded-lg bg-slate-900 border border-slate-600 text-slate-100 placeholder-slate-500 text-sm px-3 py-2 focus:outline-none focus:border-indigo-500"
                />
                {status === 'error' && <p className="text-xs text-red-400">Something went wrong. Try again.</p>}
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setOpen(false)}
                    className="px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submit}
                    disabled={status === 'sending' || !message.trim()}
                    className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
                  >
                    {status === 'sending' ? 'Sending...' : 'Submit'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
