'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
import { Book, BookStatus } from '@/types'

const STATUS_COLOR: Record<BookStatus, string> = {
  'Lu': '#10b981', 'En cours': '#f59e0b', 'À lire': '#06b6d4', 'Abandonné': '#f97316'
}
const STATUS_BG: Record<BookStatus, string> = {
  'Lu': 'from-mint to-lime', 'En cours': 'from-amber to-coral',
  'À lire': 'from-cyan to-violet', 'Abandonné': 'from-coral to-pink'
}

export default function StatsPage() {
  const supabase = createClient()
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('books').select('*').eq('user_id', user.id)
      setBooks(data || []); setLoading(false)
    }
    load()
  }, [])

  if (loading) return <AppLayout><div className="flex items-center justify-center py-24 text-4xl animate-float">📊</div></AppLayout>

  const byStatus = (s: BookStatus) => books.filter(b => b.status === s).length
  const lu = byStatus('Lu'), ec = byStatus('En cours'), al = byStatus('À lire'), ab = byStatus('Abandonné')
  const pages = books.filter(b => b.status === 'Lu' && b.pages).reduce((s, b) => s + (b.pages || 0), 0)
  const rated = books.filter(b => b.rating > 0)
  const avg = rated.length ? (rated.reduce((s,b) => s + b.rating, 0) / rated.length).toFixed(1) : null

  const genres: Record<string,number> = {}
  books.forEach(b => { if (b.genre) genres[b.genre] = (genres[b.genre]||0) + 1 })
  const topGenres = Object.entries(genres).sort((a,b) => b[1]-a[1]).slice(0,6)
  const maxG = topGenres[0]?.[1] || 1

  const ratings = [5,4,3,2,1].map(r => ({ r, n: books.filter(b => b.rating === r).length }))
  const maxR = Math.max(...ratings.map(x => x.n), 1)

  const GENRE_COLORS = ['bg-violet','bg-pink','bg-cyan','bg-lime','bg-amber','bg-coral']

  return (
    <AppLayout>
      <div className="space-y-4 pb-8">
        <h1 className="font-display font-black text-2xl text-ink">Mes statistiques 📊</h1>

        {/* Hero counter */}
        <div className="card p-5 bg-gradient-to-br from-violet to-pink text-white">
          <p className="font-bold text-white/70 text-sm">Total de livres</p>
          <p className="font-black text-6xl">{books.length}</p>
          <p className="font-semibold text-white/80 text-sm mt-1">dans ta bibliothèque</p>
        </div>

        {/* Status cards */}
        <div className="grid grid-cols-2 gap-3">
          {([['Lu',lu,'✅'],['En cours',ec,'📖'],['À lire',al,'📋'],['Abandonné',ab,'💀']] as [BookStatus,number,string][]).map(([s,n,e])=>(
            <div key={s} className={`card p-4 bg-gradient-to-br ${STATUS_BG[s]} text-white`}>
              <div className="text-2xl">{e}</div>
              <div className="font-black text-3xl mt-1">{n}</div>
              <div className="font-bold text-white/80 text-xs mt-0.5">{s}</div>
            </div>
          ))}
        </div>

        {/* Pages + avg */}
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4 text-center">
            <div className="text-3xl mb-1">📄</div>
            <div className="font-black text-2xl text-ink">{pages > 0 ? pages.toLocaleString('fr-FR') : '0'}</div>
            <div className="text-xs font-bold text-gray-400 mt-0.5">PAGES LUES</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-3xl mb-1">⭐</div>
            <div className="font-black text-2xl text-ink">{avg || '—'}</div>
            <div className="text-xs font-bold text-gray-400 mt-0.5">NOTE MOYENNE</div>
          </div>
        </div>

        {/* Donut-style progress */}
        {books.length > 0 && (
          <div className="card p-4">
            <h2 className="font-black text-base text-ink mb-3">Répartition par statut</h2>
            <div className="space-y-2.5">
              {([['Lu',lu],['En cours',ec],['À lire',al],['Abandonné',ab]] as [BookStatus,number][]).map(([s,n])=>(
                <div key={s} className="flex items-center gap-3">
                  <span className="text-xs font-black text-gray-500 w-20 shrink-0">{s}</span>
                  <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width:`${books.length ? Math.round(n/books.length*100) : 0}%`, background: STATUS_COLOR[s] }}/>
                  </div>
                  <span className="font-black text-sm text-ink w-6 text-right">{n}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Genres */}
        {topGenres.length > 0 && (
          <div className="card p-4">
            <h2 className="font-black text-base text-ink mb-3">Genres favoris</h2>
            <div className="space-y-2.5">
              {topGenres.map(([g,n],i) => (
                <div key={g} className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${GENRE_COLORS[i]}`}/>
                  <span className="text-sm font-bold text-ink flex-1 truncate">{g}</span>
                  <div className="w-28 h-2.5 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
                    <div className={`h-full rounded-full ${GENRE_COLORS[i]}`} style={{ width:`${Math.round(n/maxG*100)}%`}}/>
                  </div>
                  <span className="font-black text-sm text-ink w-5 text-right">{n}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ratings */}
        <div className="card p-4">
          <h2 className="font-black text-base text-ink mb-3">Distribution des notes</h2>
          <div className="space-y-2">
            {ratings.map(({r,n}) => (
              <div key={r} className="flex items-center gap-3">
                <span className="text-sm w-20 shrink-0">{'⭐'.repeat(r)}</span>
                <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber rounded-full transition-all duration-700" style={{ width:`${Math.round(n/maxR*100)}%`}}/>
                </div>
                <span className="font-black text-sm text-ink w-5 text-right">{n}</span>
              </div>
            ))}
          </div>
        </div>

        {books.length === 0 && (
          <div className="card p-10 text-center">
            <div className="text-5xl mb-3 animate-float inline-block">📚</div>
            <p className="font-black text-lg text-ink">Pas encore de données</p>
            <p className="text-sm text-gray-400 mt-1">Ajoutez des livres pour voir vos stats !</p>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
