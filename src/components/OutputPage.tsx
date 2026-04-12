'use client'

import { useState } from 'react'
import type { FinalizedOutput } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

interface Props {
  output: FinalizedOutput
  sessionId: string
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: select and copy
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="text-xs px-2 py-1 rounded-lg border border-slate-600 text-slate-400 hover:border-indigo-500 hover:text-indigo-300 transition-all"
    >
      {copied ? '✓ Copied' : label ?? 'Copy'}
    </button>
  )
}

function SectionBlock({ title, content }: { title: string; content: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">{title}</h3>
        <CopyButton text={content} />
      </div>
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
        {content}
      </div>
    </div>
  )
}

export default function OutputPage({ output, sessionId }: Props) {
  const shareText = `I went from ${output.beforeScore}/100 to ${output.afterScore}/100 on my LinkedIn. Used this AI tool to fix it in 15 min. linkedin-optimizer.com`
  const [pdfStatus, setPdfStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  async function handleGeneratePdf() {
    setPdfStatus('loading')
    try {
      const res = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      if (!res.ok) throw new Error('PDF generation failed')
      setPdfStatus('done')
    } catch {
      setPdfStatus('error')
    }
  }

  const scoreDelta = output.afterScore - output.beforeScore
  const deltaPositive = scoreDelta >= 0

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 px-4 py-12">
      <div className="mx-auto max-w-2xl space-y-10">

        {/* Score transformation hero */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            Profile Optimized
          </div>
          <div className="flex items-center justify-center gap-6">
            <div className="text-center">
              <div className="text-6xl font-bold text-slate-500 tabular-nums">{output.beforeScore}</div>
              <div className="text-xs text-slate-500 mt-1">Before</div>
            </div>
            <div className="text-3xl text-indigo-400 font-bold">→</div>
            <div className="text-center">
              <div className="text-6xl font-bold text-emerald-400 tabular-nums">{output.afterScore}</div>
              <div className="text-xs text-emerald-400 mt-1">After</div>
            </div>
          </div>
          {deltaPositive && (
            <p className="text-slate-400 text-sm">
              <span className="text-emerald-400 font-semibold">+{scoreDelta} points</span> improvement
            </p>
          )}
        </div>

        {/* Tabs: LinkedIn | Resume PDF */}
        <Tabs defaultValue="linkedin" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="linkedin" className="flex-1">LinkedIn Profile</TabsTrigger>
            <TabsTrigger value="resume" className="flex-1">Resume PDF</TabsTrigger>
          </TabsList>

          {/* LinkedIn tab */}
          <TabsContent value="linkedin" className="space-y-6 pt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-slate-400 text-sm">
                Copy each section and paste directly into LinkedIn.
              </p>
              <CopyButton
                text={[
                  output.headline,
                  '',
                  output.about,
                  '',
                  ...output.roles.flatMap((r) => [
                    `${r.title} at ${r.company}`,
                    ...r.bullets.map((b) => `• ${b}`),
                    '',
                  ]),
                ].join('\n')}
                label="Copy all"
              />
            </div>

            <SectionBlock title="Headline" content={output.headline} />
            <SectionBlock title="About / Summary" content={output.about} />

            {output.roles.map((role, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                    {role.title} — {role.company}
                  </h3>
                  <CopyButton
                    text={role.bullets.map((b) => `• ${b}`).join('\n')}
                    label="Copy bullets"
                  />
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 space-y-2">
                  {role.bullets.map((bullet, j) => (
                    <div key={j} className="flex items-start gap-2 text-sm text-slate-200 leading-relaxed">
                      <span className="text-indigo-400 mt-0.5 flex-shrink-0">•</span>
                      <span>{bullet}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </TabsContent>

          {/* Resume PDF tab */}
          <TabsContent value="resume" className="pt-6">
            <Card className="bg-slate-800/60 border-slate-700">
              <CardContent className="pt-8 pb-8 text-center space-y-5">
                <div className="text-4xl">📄</div>
                <div>
                  <h3 className="font-semibold text-slate-200 text-lg mb-2">PDF Resume Export</h3>
                  <p className="text-slate-400 text-sm leading-relaxed max-w-sm mx-auto">
                    Generate a clean, ATS-friendly PDF resume from your optimized LinkedIn content.
                  </p>
                </div>

                {pdfStatus === 'idle' && (
                  <Button
                    onClick={handleGeneratePdf}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl px-8 h-11"
                  >
                    Generate PDF Resume
                  </Button>
                )}

                {pdfStatus === 'loading' && (
                  <div className="flex items-center justify-center gap-2 text-slate-400">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-sm">Generating PDF...</span>
                  </div>
                )}

                {pdfStatus === 'done' && (
                  <p className="text-emerald-400 text-sm font-medium">
                    ✓ PDF generated — check your downloads.
                  </p>
                )}

                {pdfStatus === 'error' && (
                  <div className="space-y-2">
                    <p className="text-slate-400 text-sm italic">
                      PDF export is coming soon. Your LinkedIn content above is ready to copy.
                    </p>
                    <Button
                      variant="ghost"
                      onClick={() => setPdfStatus('idle')}
                      className="text-slate-500 text-sm"
                    >
                      Try again
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Share section */}
        <Card className="bg-slate-800/60 border-slate-700">
          <CardContent className="pt-6 pb-6 space-y-4">
            <div>
              <h3 className="font-semibold text-slate-200 mb-1">Share your win</h3>
              <p className="text-xs text-slate-500">Great for TikTok, LinkedIn posts, or Twitter/X</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-300 leading-relaxed">
              {shareText}
            </div>
            <CopyButton text={shareText} label="Copy for social" />
          </CardContent>
        </Card>

        {/* Next steps */}
        <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-5">
          <h3 className="font-medium text-slate-300 mb-3 text-sm uppercase tracking-wider">What to do next</h3>
          <ol className="space-y-2 text-sm text-slate-400">
            {[
              'Update your LinkedIn headline first — it appears in recruiter search results.',
              'Paste your new About section and hit save.',
              'Update each role\'s bullets from the Experience section.',
              'Add the missing keywords from your score report to your Skills section.',
              'Turn on "Open to Work" to signal active job searching.',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-indigo-400 font-semibold flex-shrink-0">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}
