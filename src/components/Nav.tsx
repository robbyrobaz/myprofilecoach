'use client'

import Image from 'next/image'
import Link from 'next/link'

interface NavProps {
  /** If true, show the homepage anchor links (How it works, Pricing, Get started) */
  showHomeLinks?: boolean
}

export default function Nav({ showHomeLinks = false }: NavProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 backdrop-blur-xl bg-black/40">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/logo-final.png" alt="My Profile Coach" width={40} height={40} className="rounded-xl" />
          <span className="text-white font-semibold text-2xl tracking-tight">My Profile Coach</span>
        </Link>
        <div className="flex items-center gap-4 sm:gap-6">
          {showHomeLinks && (
            <>
              <a href="#how-it-works" className="text-sm text-slate-400 hover:text-white transition-colors hidden sm:block">How it works</a>
              <a href="#pricing" className="text-sm text-slate-400 hover:text-white transition-colors hidden sm:block">Pricing</a>
            </>
          )}
          <Link
            href="/manage"
            className="text-sm text-slate-400 hover:text-white transition-colors hidden sm:block"
          >
            Manage subscription
          </Link>
          {showHomeLinks && (
            <a href="#score-form" className="h-9 px-5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-all flex items-center">
              Get started free
            </a>
          )}
        </div>
      </div>
    </nav>
  )
}
