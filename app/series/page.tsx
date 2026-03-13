'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Book, GoogleBook } from '@/types'
import AppLayout from '@/components/layout/AppLayout'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { Search, X, ChevronDown, ChevronUp, Plus, Check, ArrowLeft } from 'lucide-react'
import Image from 'next/image'
import { extractYear, getBestCover, getISBN } from '@/lib/google-books'

interface Series { name: string; books: Book[] }
interface GoogleBookWithCheck extends GoogleBook { checked: boolean }
interface SeriesGroup { name: string; author: string; cover?: string; books: GoogleBook[] }

function SeriesContent() {
  const supabase = createClient()
  const toast = useToast()
  const [series, setSeries] = useState<Series[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  // Google Books search — étape 1 : liste de séries
  const [searchQuery, setSearchQuery] = useState('')
  const [seriesGroups, setSeriesGroups] = useState<SeriesGroup[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)

  // Étape 2 : sélection des tomes d'une série
  const [selectedSeries, setSelectedSeries] = useState<SeriesGroup | null>(null)
  const [tomes, setTomes] = useState<GoogleBookWithCheck[]>([])
  const [adding, setAdding] = useState(false)

  const loadSeries = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('books').select('*').eq('user_id', user.id)
      .not('series_name', 'is', null)
      .order('series_name').order('series_number')
    const grouped: Record<string, Book[]> = {}
    for (const book of (data || [])) {
      if (!book.series_name) continue
      if (!grouped[book.series_name]) grouped[book.series_name] = []
      grouped[book.series_name].push(book)
    }
    setSeries(Object.entries(grouped).map(([name, books]) => ({ name, books })))
    setLoading(false)
  }, [])

  useEffect(() => { loadSeries() }, [loadSeries])

  const filtered = series.filter(s =>
    !query || s.name.toLowerCase().includes(query.toLowerCase()) ||
    s.books.some(b => b.author.toLowerCase().includes(query.toLowerCase()))
  )

  // Étape 1 — chercher des séries sur Google Books et les grouper
  async function searchSeries() {
    if (!searchQuery.trim()) return
    setSearching(true); setSearched(true); setSeriesGroups([]); setSelectedSeries(null)
    try {
      const res = await window.fetch(`/api/books-search?q=${encodeURIComponent(searchQuery + ' series')}`)
      const data: GoogleBook[] = await res.json()

      // Grouper par nom de série
      const groups: Record<string, SeriesGroup> = {}
      for (const book of data) {
        const seriesName = book.seriesInfo?.shortSeriesBookTitle || null
        if (seriesName) {
          if (!groups[seriesName]) {
            groups[seriesName] = {
              name: seriesName,
              author: book.authors[0] || '',
              cover: getBestCover(book.imageLinks),
              books: []
            }
          }
          groups[seriesName].books.push(book)
        }
      }

      // Si pas de seriesInfo, grouper par auteur/titre similaire
      const ungrouped = data.filter(b => !b.seriesInfo?.shortSeriesBookTitle)
      if (Object.keys(groups).length === 0 && ungrouped.length > 0) {
        groups[searchQuery] = {
          name: searchQuery,
          author: ungrouped[0]?.authors[0] || '',
          cover: getBestCover(ungrouped[0]?.imageLinks),
          books: ungrouped
        }
      }

      setSeriesGroups(Object.values(groups))
    } catch { setSeriesGroups([]) }
    setSearching(false)
  }

  // Étape 2 — charger les tomes d'une série sélectionnée
  async function selectSeries(group: SeriesGroup) {
    setSelectedSeries(group)
    // Chercher plus de tomes spécifiquement pour cette série
    setSearching(true)
    try {
      const res = await window.fetch(`/api/books-search?q=${encodeURIComponent(group.name)}`)
      const data: GoogleBook[] = await res.json()
      // Garder les livres liés à cette série
      const related = data.filter(b =>
        b.seriesInfo?.shortSeriesBookTitle === group.name ||
        b.title.toLowerCase().includes(group.name.toLowerCase()) ||
        group.books.some(gb => gb.id === b.id)
      )
      const final = related.length > 0 ? related : group.books
      setTomes(final.map(b => ({ ...b, checked: true })))
    } catch {
      setTomes(group.books.map(b => ({ ...b, checked: true })))
    }
    setSearching(false)
  }

  function toggleCheck(id: string) {
    setTomes(t => t.map(b => b.id === id ? { ...b, checked: !b.checked } : b))
  }

  function toggleAll() {
    const allChecked = tomes.every(b => b.checked)
    setTomes(t => t.map(b => ({ ...b, checked: !allChecked })))
  }

  async function addSelected() {
    const selected = tomes.filter(b => b.checked)
    if (!selected.length) return
    setAdding(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    for (const book of selected) {
      await supabase.from('books').insert({
        user_id: user.id,
        title: book.title,
        author: book.authors.join(', '),
        genre: book.categories?.[0],
        year: extractYear(book.publishedDate),
        pages: book.pageCount,
        publisher: book.publisher,
        isbn: getISBN(book.industryIdentifiers),
        series_name: selectedSeries?.name || searchQuery,
        series_number: book.seriesInfo?.bookDisplayNumber ? parseFloat(book.seriesInfo.bookDisplayNumber) : undefined,
        cover_url: getBestCover(book.imageLinks),
        google_books_id: book.id,
        status: 'À lire',
        rating: 0,
      })
    }
    toast(`${selected.length} tome${selected.length > 1 ? 's' : ''} ajouté${selected.length > 1 ? 's' : ''} ! 📚`, 'success')
    setTomes([]); setSelectedSeries(null); setSeriesGroups([]); setSearchQuery(''); setSearched(false)
    setAdding(false); loadSeries()
  }

  const COVERS = 8
  function coverIdx(t: string) { let h=0; for(const c of t)h=(h*31+c.charCodeAt(0))&0xfffffff; return h%COVERS }
  function progressColor(pct: number) { return pct === 100 ? 'bg-mint' : pct >= 50 ? 'bg-amber' : 'bg-violet' }
  const selectedCount = tomes.filter(b => b.checked).length

  return (
    <div className="space-y-4">
      <h1 className="font-display font-black text-2xl text-ink">Mes séries 📚</h1>

      {/* Google Books search card */}
      <div className="card p-4 bg-gradient-to-br from-violet-light to-pink-light space-y-3">

        {/* Étape 1 — recherche */}
        {!selectedSeries && (
          <>
            <p className="font-black text-sm text-ink">🔍 Ajouter une série depuis Google Books</p>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10"/>
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchSeries()}
                placeholder="Ex: Harry Potter, Dune, Astérix…"
                style={{ paddingLeft: '2.25rem' }} className="input text-sm"/>
            </div>
            <button onClick={searchSeries} disabled={!searchQuery.trim() || searching}
              className="btn btn-primary w-full py-2.5 disabled:opacity-50">
              {searching ? '🔍 Recherche…' : <><Search size={15}/> Rechercher</>}
            </button>

            {/* Résultats — liste de séries */}
            {searching && (
              <div className="space-y-2">
                {[1,2,3].map(i => (
                  <div key={i} className="flex gap-3 p-2 rounded-2xl bg-white/60 animate-pulse">
                    <div className="w-10 h-14 rounded-xl bg-gray-200 flex-shrink-0"/>
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-3 bg-gray-200 rounded-full w-3/4"/>
                      <div className="h-3 bg-gray-200 rounded-full w-1/2"/>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!searching && searched && seriesGroups.length === 0 && (
              <div className="text-center py-4">
                <p className="font-black text-sm text-ink">😕 Aucune série trouvée</p>
                <p className="text-xs text-gray-500 mt-1">Essayez un autre titre</p>
              </div>
            )}

            {!searching && seriesGroups.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-black text-gray-500">{seriesGroups.length} série{seriesGroups.length > 1 ? 's' : ''} trouvée{seriesGroups.length > 1 ? 's' : ''} — choisissez-en une :</p>
                {seriesGroups.map(group => (
                  <button key={group.name} onClick={() => selectSeries(group)}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white hover:bg-violet-light transition-all text-left shadow-sm">
                    {group.cover
                      ? <Image src={group.cover} alt={group.name} width={40} height={56} className="rounded-xl object-cover flex-shrink-0"/>
                      : <div className={`cover-${coverIdx(group.name)} w-10 h-14 rounded-xl flex items-center justify-center text-xl flex-shrink-0`}>📚</div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm text-ink">{group.name}</p>
                      <p className="text-xs text-gray-500">{group.author}</p>
                      <p className="text-[11px] text-violet font-bold mt-1">{group.books.length} tome{group.books.length > 1 ? 's' : ''} trouvé{group.books.length > 1 ? 's' : ''}</p>
                    </div>
                    <ChevronDown size={16} className="text-gray-300 flex-shrink-0"/>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* Étape 2 — sélection des tomes */}
        {selectedSeries && (
          <>
            <div className="flex items-center gap-2">
              <button onClick={() => { setSelectedSeries(null); setTomes([]) }}
                className="w-7 h-7 rounded-xl bg-white flex items-center justify-center hover:bg-gray-100 transition-colors flex-shrink-0">
                <ArrowLeft size={14} className="text-gray-500"/>
              </button>
              <p className="font-black text-sm text-ink truncate">{selectedSeries.name}</p>
            </div>

            {searching ? (
              <div className="space-y-2">
                {[1,2,3].map(i => (
                  <div key={i} className="flex gap-3 p-2 rounded-2xl bg-white/60 animate-pulse">
                    <div className="w-10 h-14 rounded-xl bg-gray-200 flex-shrink-0"/>
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-3 bg-gray-200 rounded-full w-3/4"/>
                      <div className="h-3 bg-gray-200 rounded-full w-1/2"/>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <button onClick={toggleAll} className="text-xs font-black text-violet hover:underline">
                    {tomes.every(b => b.checked) ? 'Tout décocher' : 'Tout cocher'}
                  </button>
                  <span className="text-xs font-bold text-gray-500">{selectedCount} sélectionné{selectedCount > 1 ? 's' : ''}</span>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-1.5">
                  {tomes.map(book => {
                    const cover = getBestCover(book.imageLinks)
                    const year = extractYear(book.publishedDate)
                    return (
                      <button key={book.id} onClick={() => toggleCheck(book.id)}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-2xl text-left transition-all ${
                          book.checked ? 'bg-violet-light ring-2 ring-violet ring-offset-1' : 'bg-white/60 hover:bg-white'
                        }`}>
                        <div className={`w-5 h-5 rounded-lg flex-shrink-0 flex items-center justify-center border-2 transition-all ${
                          book.checked ? 'bg-violet border-violet' : 'border-gray-300'
                        }`}>
                          {book.checked && <Check size={12} className="text-white" strokeWidth={3}/>}
                        </div>
                        {cover
                          ? <Image src={cover} alt={book.title} width={36} height={50} className="rounded-lg object-cover flex-shrink-0"/>
                          : <div className={`cover-${coverIdx(book.title)} w-9 h-[50px] rounded-lg flex items-center justify-center text-base flex-shrink-0`}>📖</div>
                        }
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-xs text-ink line-clamp-2 leading-snug">{book.title}</p>
                          <p className="text-[11px] text-gray-500">{book.authors.join(', ')}</p>
                          <div className="flex gap-1.5 mt-1 flex-wrap">
                            {book.seriesInfo?.bookDisplayNumber && (
                              <span className="text-[10px] bg-violet text-white font-bold px-1.5 py-0.5 rounded-full">
                                Tome {book.seriesInfo.bookDisplayNumber}
                              </span>
                            )}
                            {year && <span className="text-[10px] text-gray-400">{year}</span>}
                            {book.pageCount && <span className="text-[10px] text-gray-400">{book.pageCount}p</span>}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>

                <button onClick={addSelected} disabled={selectedCount === 0 || adding}
                  className="btn btn-primary w-full py-3 disabled:opacity-50">
                  {adding ? '⏳ Ajout en cours…' : <><Plus size={15}/> Ajouter {selectedCount} tome{selectedCount > 1 ? 's' : ''} à ma bibliothèque</>}
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* Filtrer mes séries */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10"/>
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Filtrer mes séries…"
          style={{ paddingLeft: '2.25rem' }}
          className="input pr-9 py-2.5 text-sm"/>
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X size={15} className="text-gray-400"/>
          </button>
        )}
      </div>

      <p className="text-xs font-bold text-gray-400">{filtered.length} série{filtered.length !== 1 ? 's' : ''}</p>

      {/* Mes séries */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="card h-24 animate-pulse bg-gray-50"/>)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-5xl mb-3 animate-float inline-block">{series.length === 0 ? '📚' : '🔍'}</div>
          <p className="font-black text-lg text-ink">{series.length === 0 ? 'Aucune série !' : 'Aucun résultat'}</p>
          <p className="text-sm text-gray-400 mt-1">{series.length === 0 ? 'Cherchez une série ci-dessus !' : 'Essayez un autre terme'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(({ name, books }) => {
            const isOpen = expanded === name
            const lu = books.filter(b => b.status === 'Lu').length
            const pct = Math.round(lu / books.length * 100)
            return (
              <div key={name} className="card overflow-hidden">
                <button onClick={() => setExpanded(isOpen ? null : name)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-bg-base transition-colors">
                  <div className="relative w-12 h-16 flex-shrink-0">
                    {books.slice(0, 3).map((b, i) => (
                      b.cover_url
                        ? <Image key={b.id} src={b.cover_url} alt={b.title} width={40} height={56}
                            className="absolute rounded-lg object-cover shadow-sm border-2 border-white"
                            style={{ left: i * 4, top: i * 2, zIndex: 3 - i }}/>
                        : <div key={b.id} className={`cover-${coverIdx(b.title)} absolute w-10 h-14 rounded-lg shadow-sm border-2 border-white flex items-center justify-center text-lg`}
                            style={{ left: i * 4, top: i * 2, zIndex: 3 - i }}>📖</div>
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm text-ink">{name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{books[0]?.author}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${progressColor(pct)}`} style={{ width: `${pct}%` }}/>
                      </div>
                      <span className="text-[11px] font-black text-gray-500 flex-shrink-0">{lu}/{books.length} lu{lu > 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  {isOpen ? <ChevronUp size={18} className="text-gray-300 flex-shrink-0"/> : <ChevronDown size={18} className="text-gray-300 flex-shrink-0"/>}
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50">
                    {books.map(book => {
                      const STATUS_CHIP: Record<string, string> = { 'Lu':'chip chip-lu','En cours':'chip chip-en','À lire':'chip chip-al','Abandonné':'chip chip-ab' }
                      return (
                        <div key={book.id} className="flex items-center gap-3 px-4 py-3">
                          {book.cover_url
                            ? <Image src={book.cover_url} alt={book.title} width={36} height={50} className="rounded-lg object-cover flex-shrink-0"/>
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
