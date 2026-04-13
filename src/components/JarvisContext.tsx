'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

type JarvisMode = 'ambient' | 'active'

interface JarvisState {
  mode: JarvisMode
  title: string
  subtitle?: string
  expectedDuration: number
}

interface JarvisContextValue {
  state: JarvisState
  activate: (title: string, opts?: { subtitle?: string; expectedDuration?: number }) => void
  deactivate: () => void
}

const JarvisContext = createContext<JarvisContextValue | null>(null)

export function JarvisProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<JarvisState>({
    mode: 'ambient',
    title: '',
    expectedDuration: 30000,
  })

  const activate = useCallback((title: string, opts?: { subtitle?: string; expectedDuration?: number }) => {
    setState({
      mode: 'active',
      title,
      subtitle: opts?.subtitle,
      expectedDuration: opts?.expectedDuration ?? 30000,
    })
  }, [])

  const deactivate = useCallback(() => {
    setState(s => ({ ...s, mode: 'ambient' }))
  }, [])

  return (
    <JarvisContext value={{ state, activate, deactivate }}>
      {children}
    </JarvisContext>
  )
}

export function useJarvis() {
  const ctx = useContext(JarvisContext)
  if (!ctx) throw new Error('useJarvis must be inside JarvisProvider')
  return ctx
}
