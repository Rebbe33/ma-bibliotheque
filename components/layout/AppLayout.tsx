'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
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
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    async function loadPending() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { count } = await supabase
        .from('bibliotheque_friendships')
        .select('*', { count: 'exact', head: true })
        .eq('addressee_id', user.id)
        .eq('status', 'pending')
      setPendingCount(count || 0)
    }
    loadPending()
    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(loadPending, 30000)
    return () => clearInterval(interval)
  }, [])

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
            const isFriends = href === '/friends'
            return (
              <button key={href} onClick={() => router.push(href)}
                className="flex-1 flex flex-col items-center justify-center py-2.5 gap-1 touch-manipulation transition-all">
                <div className={`relative p-2 rounded-2xl transition-all duration-200 ${active ? 'bg-violet-light shadow-sm' : ''}`}>
                  <Icon size={22} strokeWidth={active ? 2.5 : 1.8}
                    className={active ? 'text-violet' : 'text-gray-400'}/>
                  {/* Badge notification demandes d'amis */}
                  {isFriends && pendingCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-coral rounded-full flex items-center justify-center">
                      <span className="text-white font-black" style={{ fontSize: '9px' }}>
                        {pendingCount > 9 ? '9+' : pendingCount}
                      </span>
                    </span>
                  )}
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
