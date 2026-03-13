'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Book } from '@/types'
import AppLayout from '@/components/layout/AppLayout'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { Search, X, ChevronDown, ChevronUp } from 'lucide-react'
import Image from 'next/image'

interface Series {
  name: string
  books: Book[]
}

function SeriesContent() {
  const supabase = createClient()
  const [series, setSeries] = useState<Series[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('books')
      .select('*')
      .eq('user_id', user.id)
      .not('series_name', 'is', null)
      .order('series_name')
      .order('series_number')

    // Grouper par série
    const grouped: Record<string, Book[]> = {}
    for (const book of (data || [])) {
      if (!book.series_name) continue
      if (!grouped[book.series_name]) grouped[book.series_name] = []
      grouped[book.series_name].push(book)
    }
    setSeries(Object.entries(grouped).map(([name, books]) => ({ name, books })))
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const filtered = series.filter(s =>
    !query || s.name.toLowerCase().includes(query.toLowerCase()) ||
    s.books.some(b => b.author.toLowerCase().includes(query.toLowerCase()))
  )

  const COVERS = 8
  function coverIdx(t: string) { let h=0; for(const c of t)h=(h*31+c.charCodeAt(0))&0xfffffff; return h%COVERS }

  function progressColor(pct: number) {
    if (pct === 100) return 'bg-mint'
    if (pct >= 50) return 'bg-amber'
    return 'bg-violet'
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display font-black text-2xl text-ink">Mes séries 📚</h1>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher une série…"
          style={{ paddingLeft: '2.25rem' }}
          className="input pl-10 pr-9 py-2.5 text-sm" />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X size={15} className="text-gray-400" />
          </button>
        )}
      </div>

      <p className="text-xs font-bold text-gray-400">{filtered.length} série{filtered.length !== 1 ? 's' : ''}</p>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="card h-24 animate-pulse bg-gray-50"/>)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-5xl mb-3 animate-float inline-block">{series.length === 0 ? '📚' : '🔍'}</div>
          <p className="font-black text-lg text-ink">{series.length === 0 ? 'Aucune série !' : 'Aucun résultat'}</p>
          <p className="text-sm text-gray-400 mt-1">
            {series.length === 0 ? 'Ajoutez des livres avec un nom de série pour les voir ici' : 'Essayez un autre terme'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(({ name, books }) => {
            const isOpen = expanded === name
            const lu = books.filter(b => b.status === 'Lu').length
            const pct = Math.round(lu / books.length * 100)
            const author = books[0]?.author

            return (
              <div key={name} className="card overflow-hidden">
                {/* Series header */}
                <button
                  onClick={() => setExpanded(isOpen ? null : name)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-bg-base transition-colors"
                >
                  {/* Cover stack */}
                  <div className="relative w-12 h-16 flex-shrink-0">
                    {books.slice(0, 3).map((b, i) => (
                      b.cover_url
                        ? <Image key={b.id} src={b.cover_url} alt={b.title} width={40} height={56}
                            className="absolute rounded-lg object-cover shadow-sm border-2 border-white"
                            style={{ left: i * 4, top: i * 2, zIndex: 3 - i }} />
                        : <div key={b.id} className={`cover-${coverIdx(b.title)} absolute w-10 h-14 rounded-lg shadow-sm border-2 border-white flex items-center justify-center text-lg`}
                            style={{ left: i * 4, top: i * 2, zIndex: 3 - i }}>📖</div>
                    ))}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm text-ink">{name}</p>
                    <p className="text-xs text-gray-500 font-semibold mt-0.5">{author}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${progressColor(pct)}`}
                          style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] font-black text-gray-500 flex-shrink-0">
                        {lu}/{books.length} lu{lu > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex-shrink-0 text-gray-300">
                    {isOpen ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
                  </div>
                </button>

                {/* Books list */}
                {isOpen && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50">
                    {books.map(book => {
                      const STATUS_CHIP: Record<string, string> = {
                        'Lu': 'chip chip-lu', 'En cours': 'chip chip-en',
                        'À lire': 'chip chip-al', 'Abandonné': 'chip chip-ab'
                      }
                      return (
                        <div key={book.id} className="flex items-center gap-3 px-4 py-3">
                          {book.cover_url
                            ? <Image src={book.cover_url} alt={book.title} width={36} height={50}
                                className="rounded-lg object-cover flex-shrink-0"/>
                            : <div className={`cover-${coverIdx(book.title)} w-9 h-[50px] rounded-lg flex items-center justify-center text-base flex-shrink-0`}>📖</div>
                          }
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-ink line-clamp-1">
                              {book.series_number ? `#${book.series_number} · ` : ''}{book.title}
                            </p>
                            {book.rating > 0 && <span className="text-xs">{'⭐'.repeat(book.rating)}</span>}
                          </div>
                          <span className={STATUS_CHIP[book.status]}>{book.status}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function SeriesPage() {
  return <ToastProvider><AppLayout><SeriesContent/></AppLayout></ToastProvider>
}
