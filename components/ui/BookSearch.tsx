'use client'
import { useState, useRef } from 'react'
import Image from 'next/image'
import { searchGoogleBooks, extractYear, getBestCover } from '@/lib/google-books'
import { GoogleBook } from '@/types'
import { Search, X, ChevronRight, PenLine } from 'lucide-react'

interface Props {
  onSelect: (book: GoogleBook) => void
  onManual: () => void
}

export default function BookSearch({ onSelect, onManual }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GoogleBook[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

 async function doSearch(q = query) {
  if (!q.trim()) return
  setLoading(true); setSearched(true)
  try {
    const res = await fetch(`/api/books-search?q=${encodeURIComponent(q)}`)
    const data = await res.json()
    setResults(data)
  } catch { setResults([]) }
  setLoading(false)
}

  return (
    <div className="space-y-3">
      {/* Search input */}
      <div className="relative">
        <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doSearch()}
          placeholder="Titre, auteur, ISBN…"
          style={{ paddingLeft: '2.25rem' }}
          className="input pl-10 pr-10"
          autoFocus
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]); setSearched(false); inputRef.current?.focus() }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        )}
      </div>

      <button onClick={() => doSearch()} disabled={!query.trim() || loading}
        className="btn btn-primary w-full py-3 disabled:opacity-50">
        {loading ? '🔍 Recherche en cours…' : <><Search size={16}/> Rechercher</>}
      </button>

      {/* Loading shimmer */}
      {loading && (
        <div className="space-y-2">
          {[1,2,3].map(i => (
            <div key={i} className="flex gap-3 p-3 rounded-2xl bg-gray-50 animate-pulse">
              <div className="w-10 h-14 rounded-xl bg-gray-200 flex-shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-3 bg-gray-200 rounded-full w-3/4" />
                <div className="h-3 bg-gray-200 rounded-full w-1/2" />
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
          <p className="text-sm text-gray-500 mt-1">Essayez un autre titre ou ISBN</p>
        </div>
      )}

      {/* Results */}
      {!loading && results.length > 0 && (
        <div className="space-y-2 max-h-[52vh] overflow-y-auto -mx-1 px-1">
          {results.map(book => {
            const cover = getBestCover(book.imageLinks)
            const year = extractYear(book.publishedDate)
            return (
              <button key={book.id} onClick={() => onSelect(book)}
                className="w-full card card-hover flex items-center gap-3 p-3 text-left">
                {cover
                  ? <Image src={cover} alt={book.title} width={40} height={56} className="rounded-lg object-cover flex-shrink-0 shadow-sm" />
                  : <div className="w-10 h-14 rounded-lg bg-gradient-to-br from-violet to-pink flex items-center justify-center text-xl flex-shrink-0">📖</div>
                }
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-ink line-clamp-2 leading-snug">{book.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{book.authors.join(', ')}</p>
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    {year && <span className="text-[11px] bg-amber-light text-amber-dark font-bold px-2 py-0.5 rounded-full">{year}</span>}
                    {book.pageCount && <span className="text-[11px] text-gray-400">{book.pageCount} p.</span>}
                    {book.publisher && <span className="text-[11px] text-gray-400 truncate max-w-[120px]">{book.publisher}</span>}
                    {book.seriesInfo?.shortSeriesBookTitle && (
  <span className="text-[11px] bg-violet-light text-violet-dark font-bold px-2 py-0.5 rounded-full">
    📚 Série : {book.seriesInfo.shortSeriesBookTitle}
  </span>
)}
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
              </button>
            )
          })}
        </div>
      )}

      {/* Manual fallback */}
      <button onClick={onManual}
        className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-gray-400 hover:text-violet transition-colors">
        <PenLine size={15} /> Saisir manuellement
      </button>
    </div>
  )
}
