'use client'
import { useState, useRef } from 'react'
import Image from 'next/image'
import { GoogleBook } from '@/types'
import { Search, X, Plus } from 'lucide-react'
import { getBestCover, extractYear } from '@/lib/google-books'

interface Props {
  onSelect: (book: GoogleBook) => void
  onManual: () => void
  onAddToWishlist?: (book: GoogleBook) => void
  mode?: 'library' | 'wishlist'
}

export default function BookSearch({ onSelect, onManual, onAddToWishlist, mode = 'library' }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GoogleBook[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [searched, setSearched] = useState(false)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [source, setSource] = useState<'google' | 'openlibrary'>('google')
  const [langFr, setLangFr] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  async function doSearch(q = query, p = 0, src = source, fr = langFr) {
    if (!q.trim()) return
    if (p === 0) { setLoading(true); setSearched(true); setResults([]) }
    else setLoadingMore(true)

    try {
      const res = await fetch(`/api/books-search?q=${encodeURIComponent(q)}&page=${p}&source=${src}&lang=${fr ? 'fr' : 'all'}`)
      const data: GoogleBook[] = await res.json()

      // Tri par pertinence — cherche dans tous les mots du titre
const ql = q.toLowerCase()
const sorted = [...data].sort((a, b) => {
  const aTitle = a.title.toLowerCase()
  const bTitle = b.title.toLowerCase()
  // Score : 0 = commence par, 1 = contient le mot entier, 2 = contient les lettres, 3 = rien
  const score = (title: string) => {
    if (title.startsWith(ql)) return 0
    if (title.includes(ql)) return 1
    if (title.split(/\s+/).some(w => w.includes(ql))) return 2
    return 3
  }
  return score(aTitle) - score(bTitle)
})

      if (p === 0) setResults(sorted)
      else setResults(r => [...r, ...sorted])
      setPage(p)
      setHasMore(data.length === 20)
    } catch { if (p === 0) setResults([]) }

    setLoading(false); setLoadingMore(false)
  }

  function changeSource(s: 'google' | 'openlibrary') {
    setSource(s); setResults([]); setPage(0); setSearched(false)
    if (query.trim()) doSearch(query, 0, s, langFr)
  }

  function changeLang(fr: boolean) {
    setLangFr(fr); setResults([]); setPage(0); setSearched(false)
    if (query.trim()) doSearch(query, 0, source, fr)
  }

  return (
    <div className="space-y-3">
      {/* Source toggle */}
      <div className="flex p-1 bg-gray-100 rounded-2xl">
        {([['google','🔍 Google Books'],['openlibrary','📖 Open Library']] as const).map(([s, label]) => (
          <button key={s} onClick={() => changeSource(s)}
            className={`flex-1 py-1.5 rounded-xl font-black text-xs transition-all ${
              source === s ? 'bg-white text-violet shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Langue toggle */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-black text-gray-500">Langue</span>
        <div className="flex p-0.5 bg-gray-100 rounded-xl">
          {([['fr','🇫🇷 Français', true],['all','🌍 Toutes', false]] as const).map(([, label, val]) => (
            <button key={label} onClick={() => changeLang(val)}
              className={`px-3 py-1 rounded-xl font-black text-xs transition-all ${
                langFr === val ? 'bg-white text-violet shadow-sm' : 'text-gray-400'
              }`}>{label}</button>
          ))}
        </div>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doSearch()}
          placeholder="Titre, auteur, ISBN…"
          style={{ paddingLeft: '2.25rem' }}
          className="input pr-10"
          autoFocus
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]); setSearched(false); inputRef.current?.focus() }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={16}/>
          </button>
        )}
      </div>

      <button onClick={() => doSearch()} disabled={!query.trim() || loading}
        className="btn btn-primary w-full py-3 disabled:opacity-50">
        {loading ? '🔍 Recherche…' : <><Search size={16}/> Rechercher</>}
      </button>

      {/* Loading shimmer */}
      {loading && (
        <div className="space-y-2">
          {[1,2,3].map(i => (
            <div key={i} className="flex gap-3 p-3 rounded-2xl bg-gray-50 animate-pulse">
              <div className="w-10 h-14 rounded-xl bg-gray-200 flex-shrink-0"/>
              <div className="flex-1 space-y-2 py-1">
                <div className="h-3 bg-gray-200 rounded-full w-3/4"/>
                <div className="h-3 bg-gray-200 rounded-full w-1/2"/>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No results */}
      {!loading && searched && results.length === 0 && (
        <div className="text-center py-6">
          <div className="text-4xl mb-2">😕</div>
          <p className="font-black text-ink">Aucun résultat</p>
          <p className="text-sm text-gray-500 mt-1">Essayez l'autre source ou un autre titre</p>
        </div>
      )}

      {/* Results */}
      {!loading && results.length > 0 && (
        <div className="space-y-2 max-h-[55vh] overflow-y-auto -mx-1 px-1">
          {results.map(book => {
            const cover = getBestCover(book.imageLinks)
            const year = extractYear(book.publishedDate)
            return (
              <div key={book.id} className="card flex items-center gap-3 p-3">
                {cover
                  ? <Image src={cover} alt={book.title} width={40} height={56}
                      className="rounded-lg object-cover flex-shrink-0 shadow-sm"/>
                  : <div className="w-10 h-14 rounded-lg bg-gradient-to-br from-violet to-pink flex items-center justify-center text-xl flex-shrink-0">📖</div>
                }
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onSelect(book)}>
                  <p className="font-bold text-sm text-ink line-clamp-2 leading-snug">{book.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{book.authors.join(', ')}</p>
                  <div className="flex gap-1.5 mt-1.5 flex-wrap items-center">
                    {year && <span className="text-[11px] bg-amber-light text-amber-dark font-bold px-2 py-0.5 rounded-full">{year}</span>}
                    {book.pageCount && <span className="text-[11px] text-gray-400">{book.pageCount}p</span>}
                    {book.seriesInfo?.shortSeriesBookTitle && (
                      <span className="text-[11px] bg-violet-light text-violet font-bold px-2 py-0.5 rounded-full">
                        📚 {book.seriesInfo.shortSeriesBookTitle}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <button onClick={() => onSelect(book)}
                    className="w-8 h-8 rounded-xl bg-violet text-white flex items-center justify-center hover:bg-violet-dark transition-colors"
                    title={mode === 'library' ? 'Ajouter à la bibliothèque' : 'Ajouter aux souhaits'}>
                    <Plus size={16}/>
                  </button>
                  {onAddToWishlist && mode === 'library' && (
                    <button onClick={() => onAddToWishlist(book)}
                      className="w-8 h-8 rounded-xl bg-pink-light text-pink flex items-center justify-center hover:bg-pink hover:text-white transition-colors"
                      title="Ajouter à la wishlist">
                      ♥
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {hasMore && (
            <button onClick={() => doSearch(query, page + 1)} disabled={loadingMore}
              className="w-full py-3 rounded-2xl bg-gray-50 hover:bg-gray-100 font-black text-sm text-gray-500 transition-colors disabled:opacity-50">
              {loadingMore ? '⏳ Chargement…' : '+ Charger plus de résultats'}
            </button>
          )}
        </div>
      )}

      <button onClick={onManual}
        className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-gray-400 hover:text-violet transition-colors">
        ✏️ Saisir manuellement
      </button>
    </div>
  )
}
