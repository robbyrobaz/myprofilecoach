'use client'

import { useState, useEffect } from 'react'
import type { ScoreIndexEntry, StatsData } from '@/lib/kv'
import type { FeedbackRecord, UserRecord } from '@/lib/types'

interface AdminData {
  scores: ScoreIndexEntry[]
  feedback: FeedbackRecord[]
  stats: StatsData
  users: UserRecord[]
}

function fmt(ts: number) {
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function MiniBar({ value, max, color = 'bg-indigo-500' }: { value: number; max: number; color?: string }) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100))
  const barColor = value / max >= 0.7 ? 'bg-emerald-500' : value / max >= 0.45 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1.5 rounded-full bg-slate-700 overflow-hidden">
        <div className={`h-full rounded-full ${color === 'bg-indigo-500' ? barColor : color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-400 tabular-nums">{value}/{max}</span>
    </div>
  )
}

function StatCard({ label, value, sub, color = 'text-indigo-400' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4 space-y-1">
      <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
      {sub && <div className="text-xs text-slate-600">{sub}</div>}
    </div>
  )
}

export default function AdminPage() {
  const [key, setKey] = useState('')
  const [authed, setAuthed] = useState(false)
  const [data, setData] = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'overview' | 'scores' | 'subscribers' | 'feedback'>('overview')

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

  const { scores = [], feedback = [], stats, users = [] } = data ?? {}
  const s = stats ?? { counts: { scores: 0, interviews: 0, suggestions: 0, finalizations: 0, pdfs: 0 }, costs: { scores: 0, interviews: 0, suggestions: 0, finalizations: 0, pdfs: 0 } }
  const totalCost = Object.values(s.costs).reduce((a, b) => a + b, 0)
  const totalRuns = Object.values(s.counts).reduce((a, b) => a + b, 0)
  const activeUsers = users.filter(u => u.subscriptionStatus === 'active')
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b.score, 0) / scores.length) : 0
  const mrr = activeUsers.length * 20

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'scores', label: `Scores (${s.counts.scores})` },
    { id: 'subscribers', label: `Subscribers (${users.length})` },
    { id: 'feedback', label: `Feedback (${feedback.length})` },
  ] as const

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <nav className="border-b border-white/5 bg-black/40 backdrop-blur-xl px-6 py-4 flex items-center justify-between">
        <span className="font-bold text-lg">My Profile Coach — Admin</span>
        <button onClick={() => { setAuthed(false); sessionStorage.removeItem('admin_key') }} className="text-xs text-slate-500 hover:text-slate-300">
          Sign out
        </button>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg border border-white/10 bg-white/[0.02] p-1 w-fit">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div className="space-y-8">
            {/* Business metrics */}
            <div>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">Business</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard label="Active subscribers" value={activeUsers.length} color="text-emerald-400" />
                <StatCard label="MRR (est.)" value={`$${mrr}`} sub="@ $20/mo" color="text-emerald-400" />
                <StatCard label="Total users" value={users.length} sub={`${users.filter(u => u.subscriptionStatus === 'canceled').length} canceled`} />
                <StatCard label="Avg score" value={`${avgScore}/100`} sub={`${scores.length} scored`} />
              </div>
            </div>

            {/* Pipeline run counts */}
            <div>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">Pipeline runs</h2>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {([
                  { key: 'scores',        label: 'Scores',        color: 'text-indigo-400' },
                  { key: 'interviews',    label: 'Interviews',    color: 'text-violet-400' },
                  { key: 'suggestions',   label: 'Suggestions',   color: 'text-blue-400'   },
                  { key: 'finalizations', label: 'Full outputs',  color: 'text-emerald-400'},
                  { key: 'pdfs',          label: 'PDFs',          color: 'text-amber-400'  },
                ] as const).map(({ key, label, color }) => (
                  <StatCard
                    key={key}
                    label={label}
                    value={s.counts[key]}
                    sub={`$${s.costs[key].toFixed(3)} AI cost`}
                    color={color}
                  />
                ))}
              </div>
            </div>

            {/* Cost breakdown */}
            <div>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">AI cost breakdown</h2>
              <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-white/[0.03] border-b border-white/5">
                    <tr>
                      {['Step', 'Runs', 'Total cost', 'Cost / run', '% of total'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {([
                      { key: 'scores',        label: 'Score'       },
                      { key: 'interviews',    label: 'Interview'   },
                      { key: 'suggestions',   label: 'Suggestions' },
                      { key: 'finalizations', label: 'Finalize'    },
                      { key: 'pdfs',          label: 'PDF'         },
                    ] as const).map(({ key, label }) => {
                      const count = s.counts[key]
                      const cost = s.costs[key]
                      const perRun = count > 0 ? cost / count : 0
                      const pct = totalCost > 0 ? (cost / totalCost) * 100 : 0
                      return (
                        <tr key={key} className="hover:bg-white/[0.02]">
                          <td className="px-5 py-3 text-slate-200 font-medium">{label}</td>
                          <td className="px-5 py-3 text-slate-400 tabular-nums">{count}</td>
                          <td className="px-5 py-3 text-slate-300 tabular-nums">${cost.toFixed(4)}</td>
                          <td className="px-5 py-3 text-slate-400 tabular-nums">${perRun.toFixed(4)}</td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-slate-500 tabular-nums">{pct.toFixed(0)}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    <tr className="bg-white/[0.02] border-t border-white/10">
                      <td className="px-5 py-3 text-slate-200 font-semibold">Total</td>
                      <td className="px-5 py-3 text-slate-300 tabular-nums font-medium">{totalRuns}</td>
                      <td className="px-5 py-3 text-indigo-400 tabular-nums font-bold">${totalCost.toFixed(4)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SCORES */}
        {tab === 'scores' && (
          <div className="rounded-xl border border-white/5 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] border-b border-white/5">
                <tr>
                  {['Date', 'Target role', 'Score', 'H', 'A', 'Exp', 'KW', 'AI', 'Cost', 'Stage'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {scores.map(s => (
                  <tr key={s.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-xs">{fmt(s.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-200 max-w-[180px] truncate">{s.targetRole}</td>
                    <td className="px-4 py-3">
                      <span className={`font-bold tabular-nums ${s.score >= 70 ? 'text-emerald-400' : s.score >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {s.score}
                      </span>
                    </td>
                    <td className="px-4 py-3"><MiniBar value={s.breakdown.headline} max={20} /></td>
                    <td className="px-4 py-3"><MiniBar value={s.breakdown.about} max={20} /></td>
                    <td className="px-4 py-3"><MiniBar value={s.breakdown.experience} max={30} /></td>
                    <td className="px-4 py-3"><MiniBar value={s.breakdown.keywords} max={20} /></td>
                    <td className="px-4 py-3"><MiniBar value={s.breakdown.aiSignals} max={10} /></td>
                    <td className="px-4 py-3 text-slate-500 tabular-nums text-xs">${s.costUsd.toFixed(4)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${s.stage === 'complete' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                        {s.stage}
                      </span>
                    </td>
                  </tr>
                ))}
                {scores.length === 0 && (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-600">No scores yet — run a score to see data here</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* SUBSCRIBERS */}
        {tab === 'subscribers' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <StatCard label="Active" value={activeUsers.length} color="text-emerald-400" />
              <StatCard label="Canceled" value={users.filter(u => u.subscriptionStatus === 'canceled').length} color="text-red-400" />
              <StatCard label="Est. MRR" value={`$${mrr}`} color="text-emerald-400" sub="@ $20/mo active" />
            </div>
            <div className="rounded-xl border border-white/5 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.03] border-b border-white/5">
                  <tr>
                    {['Email', 'Status', 'Sessions used', 'PDFs', 'Period', 'Renews'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-slate-200 text-xs">{u.id}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          u.subscriptionStatus === 'active'   ? 'bg-emerald-500/15 text-emerald-400' :
                          u.subscriptionStatus === 'canceled' ? 'bg-red-500/15 text-red-400' :
                          u.subscriptionStatus === 'trialing' ? 'bg-blue-500/15 text-blue-400' :
                          'bg-slate-700 text-slate-400'
                        }`}>
                          {u.subscriptionStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 tabular-nums">{u.usage?.sessions ?? 0}/3</td>
                      <td className="px-4 py-3 text-slate-400 tabular-nums">{u.usage?.pdfs ?? 0}/5</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{u.usage?.period ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {u.currentPeriodEnd ? new Date(u.currentPeriodEnd * 1000).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-600">No subscribers yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* FEEDBACK */}
        {tab === 'feedback' && (
          <div className="space-y-4">
            {feedback.map(f => (
              <div key={f.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-5 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-slate-200 leading-relaxed">{f.message}</p>
                  <span className="text-xs text-slate-600 whitespace-nowrap flex-shrink-0">{fmt(f.createdAt)}</span>
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
            {feedback.length === 0 && <p className="text-center text-slate-600 py-8">No feedback yet</p>}
          </div>
        )}

      </div>
    </div>
  )
}
