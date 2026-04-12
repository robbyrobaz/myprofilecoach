'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'

function ScorePreview() {
  return (
    <div className="relative mx-auto max-w-xs">
      <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-6 backdrop-blur-sm">
        <div className="mb-4 text-center text-sm font-medium text-slate-400 uppercase tracking-widest">
          Profile Score
        </div>
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="text-center">
            <div className="text-5xl font-bold text-slate-500 tabular-nums">41</div>
            <div className="text-xs text-slate-500 mt-1">Before</div>
          </div>
          <div className="text-2xl text-indigo-400 font-bold">→</div>
          <div className="text-center">
            <div className="text-5xl font-bold text-indigo-400 tabular-nums">87</div>
            <div className="text-xs text-indigo-400 mt-1">After</div>
          </div>
        </div>
        <div className="space-y-2">
          {[
            { label: 'Headline', after: 90 },
            { label: 'About', after: 85 },
            { label: 'Experience', after: 88 },
            { label: 'Keywords', after: 82 },
          ].map((row) => (
            <div key={row.label} className="flex items-center gap-2">
              <div className="w-20 text-xs text-slate-400">{row.label}</div>
              <div className="flex-1 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-500"
                  style={{ width: `${row.after}%` }}
                />
              </div>
              <div className="text-xs text-indigo-400 w-6 text-right">{row.after}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Bookmarklet code — runs on linkedin.com, copies profile text to clipboard
const BOOKMARKLET_CODE = `(function(){var m=document.querySelector('main')||document.body;var c=m.cloneNode(true);c.querySelectorAll('script,style,nav,header,button,[aria-hidden="true"]').forEach(function(e){e.remove();});var t=(c.innerText||c.textContent||'').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();if(!t){alert('Could not read profile. Try selecting all text manually (Ctrl+A) then copying.');return;}function fb(){var ta=document.createElement('textarea');ta.value=t;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.focus();ta.select();try{document.execCommand('copy');alert('Profile copied! Return to myprofilecoach.com and paste it.');}catch(e){alert('Please manually copy the text on this page.');}document.body.removeChild(ta);}if(navigator&&navigator.clipboard){navigator.clipboard.writeText(t).then(function(){alert('Profile copied! Return to myprofilecoach.com and paste it.');}).catch(fb);}else{fb();}})();`

function BookmarkletHelper() {
  const linkRef = React.useRef<HTMLAnchorElement>(null)

  React.useEffect(() => {
    if (linkRef.current) {
      linkRef.current.href = `javascript:${BOOKMARKLET_CODE}`
    }
  }, [])

  return (
    <div className="rounded-xl border border-slate-600 bg-slate-800/30 p-4 space-y-3">
      <p className="text-sm font-medium text-slate-300">Desktop shortcut (optional)</p>
      <ol className="text-xs text-slate-400 space-y-1.5 list-decimal list-inside">
        <li>Drag the button below to your bookmarks bar</li>
        <li>Open your LinkedIn profile</li>
        <li>Click the bookmark — it copies your profile</li>
        <li>Come back here and paste</li>
      </ol>
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <a
          ref={linkRef}
          href="#"
          onClick={(e) => e.preventDefault()}
          draggable
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/40 px-3 py-1.5 text-xs font-medium text-indigo-300 hover:bg-indigo-600/30 cursor-grab active:cursor-grabbing select-none"
        >
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm-7 3a4 4 0 110 8 4 4 0 010-8zm0 10c-4 0-6 2-6 3v1h12v-1c0-1-2-3-6-3z"/></svg>
          Copy LinkedIn Profile
        </a>
        <span className="text-xs text-slate-500">← drag this to your bookmarks bar</span>
      </div>
    </div>
  )
}

function HeroForm() {
  const router = useRouter()
  const [profileText, setProfileText] = useState('')
  const [targetRole, setTargetRole] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showBookmarklet, setShowBookmarklet] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profileText.trim()) {
      setError('Please paste your LinkedIn profile text.')
      return
    }
    if (!targetRole.trim()) {
      setError('Please enter a target role.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileText, targetRoles: [targetRole] }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string })?.error ?? 'Failed to score profile')
      }
      const data = (await res.json()) as { sessionId: string }
      router.push(`/session/${data.sessionId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-slate-300">
            Paste your LinkedIn profile
          </label>
          <button
            type="button"
            onClick={() => setShowBookmarklet(v => !v)}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {showBookmarklet ? 'Hide helper' : 'Desktop shortcut ↗'}
          </button>
        </div>

        {showBookmarklet && (
          <div className="mb-3">
            <BookmarkletHelper />
          </div>
        )}

        <Textarea
          value={profileText}
          onChange={(e) => setProfileText(e.target.value)}
          placeholder="Open your LinkedIn profile → select all text → copy → paste here. Don't worry about formatting — our AI handles the noise."
          className="min-h-40 max-h-56 overflow-y-auto bg-slate-800/50 border-slate-600 text-slate-100 placeholder:text-slate-500 focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20 resize-none"
          disabled={loading}
        />
        <p className="text-xs text-slate-500 mt-1.5">
          On mobile: open linkedin.com in your browser → tap your profile → select all → copy.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          What role are you targeting?
        </label>
        <Input
          value={targetRole}
          onChange={(e) => setTargetRole(e.target.value)}
          placeholder="e.g. Senior Product Manager at a Series B startup"
          className="h-11 bg-slate-800/50 border-slate-600 text-slate-100 placeholder:text-slate-500 focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20"
          disabled={loading}
        />
      </div>

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-base rounded-xl transition-all disabled:opacity-60"
      >
        {loading ? (
          <span className="flex items-center gap-3">
            <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Analyzing your profile... (10–20 sec)
          </span>
        ) : (
          'Get my free score →'
        )}
      </Button>
      <p className="text-xs text-center text-slate-500">Free score. No account required.</p>
    </form>
  )
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">

      {/* Hero */}
      <section className="relative overflow-hidden pt-20 pb-16 px-4">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/30 via-slate-900 to-violet-900/20 pointer-events-none" />
        <div className="relative mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300 mb-6">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                Free profile score in 10 seconds
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold leading-tight tracking-tight mb-6">
                Recruiters use AI to find candidates.{' '}
                <span className="text-indigo-400">Are you using AI to be found?</span>
              </h1>
              <p className="text-lg text-slate-400 mb-8 leading-relaxed">
                Paste your LinkedIn profile and get an instant AI-powered score. Then let AI interview you and rewrite your profile to land in recruiter searches — in under 15 minutes.
              </p>
              <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-6 backdrop-blur-sm">
                <HeroForm />
              </div>
            </div>
            <div className="hidden lg:block">
              <ScorePreview />
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 border-t border-slate-800">
        <div className="mx-auto max-w-4xl text-center mb-12">
          <h2 className="text-3xl font-bold mb-3">How it works</h2>
          <p className="text-slate-400">Three steps to a profile that actually gets you found.</p>
        </div>
        <div className="mx-auto max-w-4xl grid md:grid-cols-3 gap-6">
          {[
            {
              step: '01',
              title: 'Paste & Score',
              desc: 'Paste your LinkedIn text. Our AI scores every section — headline, about, experience bullets, keyword density — against recruiter search patterns.',
              accent: 'text-indigo-400',
            },
            {
              step: '02',
              title: 'AI Interviews You',
              desc: 'AI asks 3–5 targeted questions about your real achievements and impact. You answer in your own words — no fluff needed.',
              accent: 'text-violet-400',
            },
            {
              step: '03',
              title: 'Get Your Optimized Profile',
              desc: 'Review AI-generated rewrites for every section. Approve, edit, or skip each one. Copy your polished profile straight to LinkedIn.',
              accent: 'text-emerald-400',
            },
          ].map((item) => (
            <Card key={item.step} className="bg-slate-800/50 border-slate-700 text-slate-100">
              <CardContent className="pt-6 pb-6">
                <div className={`text-4xl font-bold ${item.accent} mb-4`}>{item.step}</div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Social proof strip */}
      <section className="py-12 px-4 bg-slate-800/30 border-y border-slate-800">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-slate-400 text-sm mb-6">People who optimized their profile</p>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { score: '34 → 91', role: 'Software Engineer', note: '"3 recruiter messages in 2 days after optimizing."' },
              { score: '41 → 87', role: 'Product Manager', note: '"Got the interview at my dream company."' },
              { score: '28 → 82', role: 'UX Designer', note: '"Finally showing up in LinkedIn searches."' },
            ].map((item) => (
              <div key={item.role} className="rounded-xl border border-slate-700 bg-slate-800/50 p-5 text-left">
                <div className="text-2xl font-bold text-indigo-400 mb-1">{item.score}</div>
                <div className="text-xs text-slate-500 mb-3">{item.role}</div>
                <p className="text-sm text-slate-300 italic">{item.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-4">
        <div className="mx-auto max-w-md text-center">
          <h2 className="text-3xl font-bold mb-3">Simple pricing</h2>
          <p className="text-slate-400 mb-10">One plan. Full access. Cancel any time.</p>
          <div className="rounded-2xl border border-indigo-500/40 bg-gradient-to-b from-indigo-900/30 to-slate-800/60 p-8">
            <div className="mb-2 text-sm font-medium text-indigo-300 uppercase tracking-widest">Pro</div>
            <div className="flex items-end justify-center gap-1 mb-2">
              <span className="text-5xl font-bold">$20</span>
              <span className="text-slate-400 mb-2">/mo</span>
            </div>
            <p className="text-sm text-slate-400 mb-8">Cancel any time. No fluff.</p>
            <ul className="text-sm text-slate-300 space-y-3 mb-8 text-left">
              {[
                'Full profile score with all issues unlocked',
                'AI interview to surface your real achievements',
                'AI rewrites for headline, about, every role',
                'Up to 3 optimized profiles per month',
                'PDF resume export (coming soon)',
                'Manual refresh when you update your profile',
              ].map((feat) => (
                <li key={feat} className="flex items-start gap-2">
                  <span className="text-indigo-400 mt-0.5">✓</span>
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
            <Button className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-base">
              Get started — $20/mo
            </Button>
            <p className="text-xs text-slate-500 mt-3">Powered by AI. Your data is never sold.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 px-4 text-center text-xs text-slate-600">
        LinkedIn AI Optimizer · Built with AI · &copy; {new Date().getFullYear()}
      </footer>
    </div>
  )
}
