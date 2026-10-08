'use client'
import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { BookOpen, Heart, Users, BarChart2, Dices, BookMarked } from 'lucide-react'

const NAV = [
  { href: '/library',   label: 'Biblio',  icon: BookOpen   },
  { href: '/wishlist',  label: 'Wishlist', icon: Heart      },
  { href: '/reading',   label: 'Journal',  icon: BookMarked },
  { href: '/bookopoly', label: 'Bookopoly',icon: Dices      },
  { href: '/stats',     label: 'Stats',    icon: BarChart2  },
  { href: '/friends',   label: 'Amis',     icon: Users      },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [pendingRequests, setPendingRequests] = useState(0)

  useEffect(() => {
    let mounted = true

    async function checkPending() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !mounted) return
      const { count } = await supabase
        .from('bibliotheque_friendships')
        .select('id', { count: 'exact', head: true })
        .eq('addressee_id', user.id)
        .eq('status', 'pending')
      if (mounted) setPendingRequests(count || 0)
    }

    checkPending()
    const interval = setInterval(checkPending, 30000)
    return () => { mounted = false; clearInterval(interval) }
  }, [supabase])

  return (
    <div className="min-h-screen bg-bg-base flex flex-col">
      <main className="flex-1 overflow-y-auto px-4 pt-5 pb-24 max-w-lg mx-auto w-full">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-100 safe-bottom z-40">
        <div className="flex justify-around items-center px-2 py-2 max-w-lg mx-auto">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            const isFriends = href === '/friends'
            return (
              <button
                key={href}
                onClick={() => router.push(href)}
                className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-2xl transition-all relative ${
                  active ? 'text-violet' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <div className="relative">
                  <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                  {isFriends && pendingRequests > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 bg-coral text-white text-[9px] font-black rounded-full flex items-center justify-center px-0.5 leading-none">
                      {pendingRequests > 9 ? '9+' : pendingRequests}
                    </span>
                  )}
                </div>
                <span className={`text-[9px] font-black ${active ? 'text-violet' : 'text-gray-400'}`}>
                  {label}
                </span>
                {active && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-violet rounded-full" />
                )}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
