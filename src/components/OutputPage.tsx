'use client'

import { useState } from 'react'
import type { FinalizedOutput } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

interface Props {
  output: FinalizedOutput
  sessionId: string
}

function stripMd(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .trim()
}



function CopyButton({ text, label, size = 'sm' }: { text: string; label?: string; size?: 'sm' | 'md' }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (size === 'md') {
    return (
      <button
        onClick={handleCopy}
        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
          copied
            ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
            : 'bg-slate-700 border border-slate-600 text-slate-300 hover:bg-slate-600 hover:text-white'
        }`}
      >
        {copied ? (
          <><CheckIcon /> Copied!</>
        ) : (
          <><CopyIcon /> {label ?? 'Copy'}</>
        )}
      </button>
    )
  }

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
        copied
          ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
          : 'border border-slate-600 text-slate-400 hover:border-cyan-500/60 hover:text-cyan-300 hover:bg-cyan-500/5'
      }`}
    >
      {copied ? '✓ Copied' : label ?? 'Copy'}
    </button>
  )
}

function CopyIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export default function OutputPage({ output, sessionId }: Props) {
  const [pdfStatus, setPdfStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const scoreDelta = output.afterScore - output.beforeScore
  const shareText = `Just went from ${output.beforeScore} → ${output.afterScore}/100 on my LinkedIn score using AI. Took 15 minutes. myprofilecoach.com`

  const allText = [
    `HEADLINE\n${output.headline}`,
    `\nABOUT\n${stripMd(output.about)}`,
    ...output.roles.map(r =>
      `\n${r.title.toUpperCase()} — ${r.company.toUpperCase()}\n${r.bullets.map(b => `• ${b}`).join('\n')}`
    ),
  ].join('\n')

  async function handleGeneratePdf() {
    setPdfStatus('loading')
    try {
      const res = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      if (!res.ok) throw new Error('failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `resume-optimized.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setPdfStatus('done')
    } catch {
      setPdfStatus('error')
    }
  }

  return (
    <div className="min-h-screen text-slate-100 relative z-10">

      {/* Hero */}
      <div className="relative overflow-hidden bg-white/[0.03] border-b border-white/[0.06] px-4 py-14 text-center">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/10 via-transparent to-cyan-900/10 pointer-events-none" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-300 mb-8">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Profile Optimized
          </div>

          {/* Score transformation */}
          <div className="flex items-center justify-center gap-8 mb-6">
            <div className="text-center">
              <div className="text-7xl font-bold text-slate-500 tabular-nums leading-none">{output.beforeScore}</div>
              <div className="text-sm text-slate-500 mt-2 font-medium">Before</div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="text-3xl text-cyan-400">→</div>
            </div>
            <div className="text-center">
              <div className="text-7xl font-bold text-emerald-400 tabular-nums leading-none">{output.afterScore}</div>
              <div className="text-sm text-emerald-400 mt-2 font-medium">After</div>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 border border-emerald-500/25 px-5 py-2 text-emerald-300 font-semibold text-base">
            +{scoreDelta} points improvement
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-10 space-y-8">

        {/* Tabs */}
        <Tabs defaultValue="linkedin" className="w-full">
          <TabsList className="w-full bg-white/[0.04] border border-white/[0.06]">
            <TabsTrigger value="linkedin" className="flex-1 data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-300 data-[state=inactive]:text-slate-300">
              LinkedIn Profile
            </TabsTrigger>
            <TabsTrigger value="resume" className="flex-1 data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-300 data-[state=inactive]:text-slate-300">
              Resume PDF
            </TabsTrigger>
          </TabsList>

          {/* LinkedIn tab */}
          <TabsContent value="linkedin" className="space-y-5 pt-5">
            {/* Copy all bar */}
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
              <p className="text-sm text-slate-400">Copy each section and paste directly into LinkedIn.</p>
              <CopyButton text={allText} label="Copy all" size="md" />
            </div>

            {/* Headline */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] bg-white/[0.03]">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Headline</span>
                </div>
                <CopyButton text={output.headline} />
              </div>
              <div className="px-5 py-4 text-slate-100 font-medium leading-relaxed">
                {output.headline}
              </div>
            </div>

            {/* About */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] bg-white/[0.03]">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">About / Summary</span>
                </div>
                <CopyButton text={stripMd(output.about)} />
              </div>
              <div className="px-5 py-4 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                {stripMd(output.about)}
              </div>
            </div>

            {/* Experience roles */}
            {output.roles.map((role, i) => (
              <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] bg-white/[0.03]">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest truncate">
                        {role.title}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 pl-3.5">{role.company}</p>
                  </div>
                  <CopyButton text={role.bullets.map(b => `• ${b}`).join('\n')} label="Copy bullets" />
                </div>
                <div className="px-5 py-4 space-y-3">
                  {role.bullets.map((bullet, j) => (
                    <div key={j} className="flex items-start gap-3 text-sm text-slate-200 leading-relaxed">
                      <span className="text-cyan-400 mt-0.5 flex-shrink-0 font-bold">•</span>
                      <span>{bullet}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </TabsContent>

          {/* Resume PDF tab */}
          <TabsContent value="resume" className="pt-5">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm p-10 text-center space-y-5">
              <div className="text-5xl">📄</div>
              <div>
                <h3 className="font-semibold text-slate-200 text-lg mb-2">ATS-Friendly PDF Resume</h3>
                <p className="text-slate-400 text-sm max-w-xs mx-auto leading-relaxed">
                  Download your optimized profile as a clean, recruiter-ready PDF resume.
                </p>
              </div>
              {pdfStatus === 'idle' && (
                <Button onClick={handleGeneratePdf} className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-xl px-8 h-11">
                  Download PDF Resume
                </Button>
              )}
              {pdfStatus === 'loading' && (
                <div className="flex items-center justify-center gap-2 text-slate-400 text-sm">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Building your PDF...
                </div>
              )}
              {pdfStatus === 'done' && (
                <div className="space-y-3">
                  <p className="text-emerald-400 text-sm font-medium">✓ PDF downloaded successfully</p>
                  <button onClick={() => setPdfStatus('idle')} className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2">
                    Download again
                  </button>
                </div>
              )}
              {pdfStatus === 'error' && (
                <div className="space-y-2">
                  <p className="text-red-400 text-sm">PDF generation failed.</p>
                  <button onClick={() => setPdfStatus('idle')} className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2">
                    Try again
                  </button>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Share */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] backdrop-blur-sm p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-slate-200 mb-0.5">Share your win</h3>
            <p className="text-xs text-slate-500">Great for LinkedIn posts, Twitter/X, or TikTok</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 text-sm text-slate-300 leading-relaxed italic">
            &ldquo;{shareText}&rdquo;
          </div>
          <CopyButton text={shareText} label="Copy for social" size="md" />
        </div>

        {/* Next steps */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] backdrop-blur-sm p-6">
          <h3 className="font-semibold text-slate-200 mb-4">What to do next</h3>
          <ol className="space-y-3">
            {[
              'Update your LinkedIn headline first — it appears in recruiter search results.',
              'Paste your new About section and save.',
              'Update each role\'s bullets from the Experience section.',
              'Add missing keywords to your Skills section.',
              'Turn on "Open to Work" to signal active job searching.',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="flex-shrink-0 h-5 w-5 rounded-full bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 text-xs flex items-center justify-center font-bold mt-0.5">
                  {i + 1}
                </span>
                <span className="text-slate-400 leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Start over CTA */}
        <div className="text-center pb-4 space-y-3">
          <a href="/" className="block text-sm text-slate-500 hover:text-cyan-400 transition-colors underline underline-offset-2">
            Optimize another profile →
          </a>
        </div>

      </div>
    </div>
  )
}
