'use client'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { BookOpen, Heart, BarChart2, Settings } from 'lucide-react'

const NAV = [
  { href: '/library',  label: 'Livres',   icon: BookOpen,  active: 'text-violet-DEFAULT', bg: 'bg-violet-light', dot: 'bg-violet' },
  { href: '/wishlist', label: 'Souhaits', icon: Heart,     active: 'text-pink-DEFAULT',   bg: 'bg-pink-light',   dot: 'bg-pink' },
  { href: '/stats',    label: 'Stats',    icon: BarChart2, active: 'text-cyan-DEFAULT',   bg: 'bg-cyan-light',   dot: 'bg-cyan' },
  { href: '/settings', label: 'Réglages', icon: Settings,  active: 'text-lime-DEFAULT',   bg: 'bg-lime-light',   dot: 'bg-lime' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-violet-light">
        <div className="flex items-center justify-between px-4 py-3 max-w-2xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-violet to-pink flex items-center justify-center text-white text-sm font-black shadow-glow">
              📚
            </div>
            <span className="font-display font-black text-xl text-ink">
              Ma <span className="text-violet">Biblio</span>
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-28 max-w-2xl mx-auto w-full px-4 pt-4">
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="bottom-nav">
        <div className="flex max-w-2xl mx-auto">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <button
                key={href}
                onClick={() => router.push(href)}
                className="flex-1 flex flex-col items-center justify-center py-2.5 gap-1 touch-manipulation transition-all"
              >
                <div className={`p-2 rounded-2xl transition-all duration-200 ${active ? 'bg-violet-light shadow-sm' : ''}`}>
                  <Icon
                    size={22}
                    strokeWidth={active ? 2.5 : 1.8}
                    className={active ? 'text-violet' : 'text-gray-400'}
                  />
                </div>
                <span className={`text-[10px] font-black tracking-wide ${active ? 'text-violet' : 'text-gray-400'}`}>
                  {label.toUpperCase()}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
