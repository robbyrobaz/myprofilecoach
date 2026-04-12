'use client'

import { useState, useEffect } from 'react'
import type { ScoreIndexEntry } from '@/lib/kv'
import type { FeedbackRecord } from '@/lib/types'

interface AdminData {
  scores: ScoreIndexEntry[]
  feedback: FeedbackRecord[]
}

function fmt(ts: number) {
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function ScoreBar({ value, max }: { value: number; max: number }) {
  const pct = Math.round((value / max) * 100)
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 45 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1.5 rounded-full bg-slate-700 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-400 tabular-nums">{value}/{max}</span>
    </div>
  )
}

export default function AdminPage() {
  const [key, setKey] = useState('')
  const [authed, setAuthed] = useState(false)
  const [data, setData] = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'scores' | 'feedback'>('scores')

  async function load(adminKey: string) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin?key=${encodeURIComponent(adminKey)}`)
      if (!res.ok) { setError('Wrong key'); setLoading(false); return }
      const json = await res.json() as AdminData
      setData(json)
      setAuthed(true)
      sessionStorage.setItem('admin_key', adminKey)
    } catch {
      setError('Failed to load')
    }
    setLoading(false)
  }

  useEffect(() => {
    const saved = sessionStorage.getItem('admin_key')
    if (saved) load(saved)
  }, [])

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-full max-w-sm space-y-4 px-6">
          <h1 className="text-white font-bold text-xl text-center">Admin</h1>
          <input
            type="password"
            value={key}
            onChange={e => setKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load(key)}
            placeholder="Admin key"
            className="w-full rounded-xl bg-white/5 border border-white/10 text-white px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 placeholder:text-slate-500"
            autoFocus
          />
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button
            onClick={() => load(key)}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Enter'}
          </button>
        </div>
      </div>
    )
  }

  const scores = data?.scores ?? []
  const feedback = data?.feedback ?? []
  const totalCost = scores.reduce((s, e) => s + e.costUsd, 0)
  const avgScore = scores.length ? Math.round(scores.reduce((s, e) => s + e.score, 0) / scores.length) : 0

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <nav className="border-b border-white/5 bg-black/40 backdrop-blur-xl px-6 py-4 flex items-center justify-between">
        <span className="font-bold text-lg">My Profile Coach — Admin</span>
        <button onClick={() => { setAuthed(false); sessionStorage.removeItem('admin_key') }} className="text-xs text-slate-500 hover:text-slate-300">
          Sign out
        </button>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total scores', value: scores.length },
            { label: 'Avg score', value: `${avgScore}/100` },
            { label: 'Total AI cost', value: `$${totalCost.toFixed(3)}` },
            { label: 'Feedback items', value: feedback.length },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
              <div className="text-2xl font-bold text-indigo-400">{s.value}</div>
              <div className="text-xs text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg border border-white/10 p-1 w-fit">
          {(['scores', 'feedback'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${tab === t ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {t} {t === 'scores' ? `(${scores.length})` : `(${feedback.length})`}
            </button>
          ))}
        </div>

        {tab === 'scores' && (
          <div className="rounded-xl border border-white/5 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] border-b border-white/5">
                <tr>
                  {['Date', 'Target role', 'Score', 'Headline', 'About', 'Exp', 'KW', 'AI', 'Cost', 'Stage'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {scores.map(s => (
                  <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-xs">{fmt(s.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-200 max-w-[200px] truncate">{s.targetRole}</td>
                    <td className="px-4 py-3">
                      <span className={`font-bold tabular-nums ${s.score >= 70 ? 'text-emerald-400' : s.score >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {s.score}
                      </span>
                    </td>
                    <td className="px-4 py-3"><ScoreBar value={s.breakdown.headline} max={20} /></td>
                    <td className="px-4 py-3"><ScoreBar value={s.breakdown.about} max={20} /></td>
                    <td className="px-4 py-3"><ScoreBar value={s.breakdown.experience} max={30} /></td>
                    <td className="px-4 py-3"><ScoreBar value={s.breakdown.keywords} max={20} /></td>
                    <td className="px-4 py-3"><ScoreBar value={s.breakdown.aiSignals} max={10} /></td>
                    <td className="px-4 py-3 text-slate-500 tabular-nums text-xs whitespace-nowrap">${s.costUsd.toFixed(4)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${s.stage === 'complete' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                        {s.stage}
                      </span>
                    </td>
                  </tr>
                ))}
                {scores.length === 0 && (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-600">No scores yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'feedback' && (
          <div className="space-y-4">
            {feedback.map(f => (
              <div key={f.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-5 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-slate-200 leading-relaxed">{f.message}</p>
                  <span className="text-xs text-slate-600 whitespace-nowrap">{fmt(f.createdAt)}</span>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                  {f.score !== undefined && <span>Score: <span className="text-slate-300">{f.score}/100</span></span>}
                  {f.targetRole && <span>Role: <span className="text-slate-300">{f.targetRole}</span></span>}
                  {f.email && <span>Email: <span className="text-slate-300">{f.email}</span></span>}
                  {f.stage && <span>Stage: <span className="text-slate-300">{f.stage}</span></span>}
                  {f.metrics && <span>Cost: <span className="text-slate-300">${f.metrics.totalCostUsd.toFixed(4)}</span></span>}
                  {f.githubIssueUrl && (
                    <a href={f.githubIssueUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">
                      GitHub issue ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
            {feedback.length === 0 && (
              <p className="text-center text-slate-600 py-8">No feedback yet</p>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
