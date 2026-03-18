'use client'
import { usePathname, useRouter } from 'next/navigation'
import { BookOpen, Heart, Library, Users, Compass, Settings, BarChart2 } from 'lucide-react'

const NAV = [
  { href: '/library',  label: 'Livres',    icon: BookOpen },
  { href: '/series',   label: 'Séries',    icon: Library  },
  { href: '/wishlist', label: 'Souhaits',  icon: Heart    },
  { href: '/friends',  label: 'Amis',      icon: Users    },
  { href: '/discover', label: 'Découvrir', icon: Compass  },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <div className="flex flex-col min-h-screen">
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
          <div className="flex items-center gap-1">
            <button onClick={() => router.push('/stats')}
              className={`p-2 rounded-2xl transition-all ${pathname === '/stats' ? 'bg-violet-light' : 'hover:bg-gray-100'}`}>
              <BarChart2 size={22} strokeWidth={pathname === '/stats' ? 2.5 : 1.8}
                className={pathname === '/stats' ? 'text-violet' : 'text-gray-400'}/>
            </button>
            <button onClick={() => router.push('/settings')}
              className={`p-2 rounded-2xl transition-all ${pathname === '/settings' ? 'bg-violet-light' : 'hover:bg-gray-100'}`}>
              <Settings size={22} strokeWidth={pathname === '/settings' ? 2.5 : 1.8}
                className={pathname === '/settings' ? 'text-violet' : 'text-gray-400'}/>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-28 max-w-2xl mx-auto w-full px-4 pt-4">
        {children}
      </main>

      <nav className="bottom-nav">
        <div className="flex max-w-2xl mx-auto">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <button key={href} onClick={() => router.push(href)}
                className="flex-1 flex flex-col items-center justify-center py-2.5 gap-1 touch-manipulation transition-all">
                <div className={`p-2 rounded-2xl transition-all duration-200 ${active ? 'bg-violet-light shadow-sm' : ''}`}>
                  <Icon size={22} strokeWidth={active ? 2.5 : 1.8}
                    className={active ? 'text-violet' : 'text-gray-400'}/>
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
