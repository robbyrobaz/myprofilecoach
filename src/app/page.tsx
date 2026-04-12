'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'

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
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
      <p className="text-sm font-medium text-slate-300">Desktop shortcut (optional)</p>
      <ol className="text-xs text-slate-400 space-y-1.5 list-decimal list-inside">
        <li>Drag the button below to your bookmarks bar</li>
        <li>Open your LinkedIn profile</li>
        <li>Click the bookmark — it copies your profile</li>
        <li>Come back here and paste</li>
      </ol>
      <div className="flex items-center gap-3">
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

type InputMode = 'url' | 'paste'

function HeroForm() {
  const router = useRouter()
  const [mode, setMode] = useState<InputMode>('url')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [profileText, setProfileText] = useState('')
  const [targetRole, setTargetRole] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError] = useState('')
  const [showBookmarklet, setShowBookmarklet] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    let text = profileText

    if (mode === 'url') {
      if (!linkedinUrl.trim()) { setError('Please enter your LinkedIn profile URL.'); return }
      if (!targetRole.trim()) { setError('Please enter a target role.'); return }
      setLoading(true)
      setLoadingMsg('Fetching your LinkedIn profile...')
      try {
        const res = await fetch('/api/fetch-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: linkedinUrl.trim() }),
        })
        const data = await res.json().catch(() => ({})) as { profileText?: string; error?: string }
        if (!res.ok || !data.profileText) {
          throw new Error(data.error ?? 'Could not fetch your LinkedIn profile. Please paste it manually.')
        }
        text = data.profileText
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not fetch profile. Try pasting it manually.')
        setLoading(false)
        return
      }
    } else {
      if (!profileText.trim()) { setError('Please paste your LinkedIn profile text.'); return }
      if (!targetRole.trim()) { setError('Please enter a target role.'); return }
      setLoading(true)
    }

    setLoadingMsg('Analyzing your profile... (10–20 sec)')
    try {
      const res = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileText: text, targetRoles: [targetRole] }),
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
      {/* Mode toggle */}
      <div className="flex rounded-lg border border-white/10 overflow-hidden">
        <button
          type="button"
          onClick={() => { setMode('url'); setError('') }}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'url' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400 hover:text-slate-200'}`}
          disabled={loading}
        >
          LinkedIn URL
        </button>
        <button
          type="button"
          onClick={() => { setMode('paste'); setError('') }}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'paste' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400 hover:text-slate-200'}`}
          disabled={loading}
        >
          Paste text
        </button>
      </div>

      {mode === 'url' ? (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Your LinkedIn profile URL</label>
          <Input
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            placeholder="https://www.linkedin.com/in/your-name"
            type="url"
            className="h-11 bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500 focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20"
            disabled={loading}
          />
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-slate-300">Paste your LinkedIn profile</label>
            <button
              type="button"
              onClick={() => setShowBookmarklet(v => !v)}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              {showBookmarklet ? 'Hide helper' : 'Desktop shortcut ↗'}
            </button>
          </div>
          {showBookmarklet && <div className="mb-3"><BookmarkletHelper /></div>}
          <Textarea
            value={profileText}
            onChange={(e) => setProfileText(e.target.value)}
            placeholder="Copy everything from your LinkedIn profile — headline, about, experience bullets, skills — and paste it here..."
            className="min-h-40 max-h-56 overflow-y-auto bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500 focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20 resize-none"
            disabled={loading}
          />
          <p className="text-xs text-slate-500 mt-1.5">On mobile: open linkedin.com in browser → your profile → select all → copy.</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">What role are you targeting?</label>
        <Input
          value={targetRole}
          onChange={(e) => setTargetRole(e.target.value)}
          placeholder="e.g. Senior Product Manager at a Series B startup"
          className="h-11 bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500 focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20"
          disabled={loading}
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Button
        type="submit"
        disabled={loading}
        className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-base rounded-xl transition-all disabled:opacity-60 shadow-lg shadow-indigo-500/25"
      >
        {loading ? (
          <span className="flex items-center gap-3">
            <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {loadingMsg}
          </span>
        ) : (
          'Score my profile free →'
        )}
      </Button>
      <p className="text-xs text-center text-slate-500">No account required. Free score in 30 seconds.</p>
    </form>
  )
}

function ScoreCard() {
  const bars = [
    { label: 'Headline', before: 32, after: 92 },
    { label: 'About', before: 28, after: 88 },
    { label: 'Experience', before: 41, after: 91 },
    { label: 'Keywords', before: 35, after: 85 },
    { label: 'AI Signals', before: 30, after: 90 },
  ]
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-white/[0.02] backdrop-blur-sm p-6 shadow-2xl shadow-indigo-500/20">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-5">Your Profile Analysis</div>
      <div className="flex items-center justify-center gap-8 mb-6">
        <div className="text-center">
          <div className="text-6xl font-black text-slate-600 tabular-nums">38</div>
          <div className="text-xs text-slate-600 mt-1 font-medium">Before</div>
        </div>
        <div className="text-indigo-400 text-2xl font-bold">→</div>
        <div className="text-center">
          <div className="text-6xl font-black text-indigo-400 tabular-nums">91</div>
          <div className="text-xs text-indigo-400 mt-1 font-medium">After</div>
        </div>
      </div>
      <div className="text-center mb-5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/25 px-4 py-1.5 text-indigo-300 font-semibold text-sm">
          +53 points improvement
        </span>
      </div>
      <div className="space-y-2.5">
        {bars.map((b) => (
          <div key={b.label} className="flex items-center gap-3">
            <div className="w-20 text-xs text-slate-500">{b.label}</div>
            <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                style={{ width: `${b.after}%` }}
              />
            </div>
            <div className="text-xs text-indigo-400 w-6 text-right font-medium">{b.after}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 backdrop-blur-xl bg-black/40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo-final.png" alt="My Profile Coach" width={40} height={40} className="rounded-xl" />
            <span className="text-white font-semibold text-2xl tracking-tight">My Profile Coach</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#how-it-works" className="text-sm text-slate-400 hover:text-white transition-colors hidden sm:block">How it works</a>
            <a href="#pricing" className="text-sm text-slate-400 hover:text-white transition-colors hidden sm:block">Pricing</a>
            <a href="#score-form" className="h-9 px-5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-all flex items-center">
              Get started free
            </a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section
        className="min-h-screen flex items-center pt-16"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.25) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(139,92,246,0.1) 0%, transparent 60%), #0a0a0f',
        }}
      >
        <div className="max-w-6xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-16 items-center w-full">
          {/* Left */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-medium text-indigo-300 mb-8">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
              Free profile score in 30 seconds
            </div>
            <h1 className="text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight mb-6">
              Recruiters use AI<br />to find candidates.<br />
              <span style={{ background: 'linear-gradient(135deg, #818cf8 0%, #6366f1 40%, #a78bfa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Use AI to be found.
              </span>
            </h1>
            <p className="text-lg text-slate-400 mb-10 leading-relaxed max-w-lg">
              Paste your LinkedIn profile and get an instant AI score. Then let AI interview you and rewrite every section — headline, about, every role bullet — in under 15 minutes.
            </p>

            {/* Form */}
            <div id="score-form" className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6">
              <HeroForm />
            </div>

            <div className="flex items-center gap-6 mt-10">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">2,400+</div>
                <div className="text-xs text-slate-500 mt-1">Profiles optimized</div>
              </div>
              <div className="w-px h-10 bg-slate-800" />
              <div className="text-center">
                <div className="text-2xl font-bold text-white">+43pts</div>
                <div className="text-xs text-slate-500 mt-1">Avg score increase</div>
              </div>
              <div className="w-px h-10 bg-slate-800" />
              <div className="text-center">
                <div className="text-2xl font-bold text-white">$0.00</div>
                <div className="text-xs text-slate-500 mt-1">To get your score</div>
              </div>
            </div>
          </div>

          {/* Right — floating score card */}
          <div className="hidden lg:flex justify-center">
            <div style={{ animation: 'float 4s ease-in-out infinite' }} className="w-full max-w-sm">
              <ScoreCard />
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-3">From invisible to in-demand — in 15 minutes</h2>
            <p className="text-slate-400">Three AI-powered steps that actually move the needle.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                num: '01',
                title: 'Paste & Score',
                desc: 'Paste your LinkedIn text. AI scores every section against how recruiter tools actually rank candidates in 2026.',
                highlight: false,
              },
              {
                num: '02',
                title: 'AI Interviews You',
                desc: 'AI asks 3–5 targeted questions to surface hidden achievements and quantified wins you forgot to mention.',
                highlight: true,
              },
              {
                num: '03',
                title: 'Get Optimized Profile',
                desc: 'Review AI rewrites for every section. Approve, edit, or skip. Copy straight to LinkedIn. Done.',
                highlight: false,
              },
            ].map((item) => (
              <div
                key={item.num}
                className={`rounded-2xl p-7 ${item.highlight ? 'border border-indigo-500/20 bg-indigo-500/5' : 'border border-white/5 bg-white/[0.02]'}`}
              >
                <div
                  className="text-4xl font-black mb-4"
                  style={{ background: 'linear-gradient(135deg, #818cf8 0%, #6366f1 40%, #a78bfa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                >
                  {item.num}
                </div>
                <h3 className="font-semibold text-white text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="py-16 px-6 border-t border-white/5 bg-white/[0.01]">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-slate-500 text-sm mb-10">People who optimized their profile</p>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { score: '34 → 91', role: 'Software Engineer', note: '"3 recruiter messages in 2 days after optimizing."' },
              { score: '41 → 87', role: 'Product Manager', note: '"Got the interview at my dream company."' },
              { score: '28 → 82', role: 'UX Designer', note: '"Finally showing up in LinkedIn searches."' },
            ].map((item) => (
              <div key={item.role} className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
                <div className="text-3xl font-black text-indigo-400 mb-1">{item.score}</div>
                <div className="text-xs text-slate-500 mb-3">{item.role}</div>
                <p className="text-sm text-slate-300 italic">{item.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-md mx-auto text-center">
          <h2 className="text-3xl font-bold mb-3">One plan. Full access.</h2>
          <p className="text-slate-400 mb-12">Cancel any time. No hidden fees.</p>
          <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-indigo-900/20 to-transparent p-10">
            <div className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3">Pro</div>
            <div className="flex items-end justify-center gap-1 mb-1">
              <span className="text-6xl font-black">$20</span>
              <span className="text-slate-400 mb-2 text-lg">/mo</span>
            </div>
            <p className="text-slate-500 text-sm mb-8">Cancel any time.</p>
            <ul className="text-sm text-slate-300 space-y-3 mb-8 text-left">
              {[
                'Full profile score — all issues unlocked',
                'AI interview to surface real achievements',
                'AI rewrites for headline, about, every role',
                'Up to 3 optimized profiles/month',
                'PDF resume export',
              ].map((feat) => (
                <li key={feat} className="flex gap-3">
                  <span className="text-indigo-400 font-bold">✓</span>
                  {feat}
                </li>
              ))}
            </ul>
            <a
              href="#score-form"
              className="block w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-base transition-all text-center shadow-lg shadow-indigo-500/25"
            >
              Get started — $20/mo
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 py-8 px-6 text-center text-xs text-slate-600">
        My Profile Coach · © 2026 · myprofilecoach.com
      </footer>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  )
}
