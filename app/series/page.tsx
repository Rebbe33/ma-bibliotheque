'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Book, BookStatus, GoogleBook } from '@/types'
import AppLayout from '@/components/layout/AppLayout'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import BottomSheet from '@/components/ui/BottomSheet'
import { Search, X, ChevronDown, ChevronUp, Plus, Check, List, Layers, Edit2, Trash2 } from 'lucide-react'
import Image from 'next/image'
import { extractYear, getBestCover, getISBN } from '@/lib/google-books'

interface Series { name: string; books: Book[] }
interface GoogleBookWithMeta extends GoogleBook { checked: boolean; tomeNumber: string }

const STATUS_CHIP: Record<string, string> = {
  'Lu': 'chip chip-lu', 'En cours': 'chip chip-en',
  'À lire': 'chip chip-al', 'Abandonné': 'chip chip-ab',
  'À acquérir': 'chip chip-aq'
}

// ── Sous-composant édition série ──
function EditSeriesSheet({ series, onRename, onUpdateBook, onRemoveBook }: {
  series: Series
  onRename: (name: string) => void
  onUpdateBook: (id: string, data: Partial<Book>) => void
  onRemoveBook: (id: string) => void
}) {
  const [name, setName] = useState(series.name)
  const STATUSES: BookStatus[] = ['À lire', 'En cours', 'Lu', 'Abandonné', 'À acquérir']
const STATUS_EMOJI: Record<BookStatus, string> = {
  'À lire':'📋', 'En cours':'📖', 'Lu':'✅', 'Abandonné':'💀', 'À acquérir':'🛒'
}
  function coverIdx(t: string) { let h = 0; for (const c of t) h = (h * 31 + c.charCodeAt(0)) & 0xfffffff; return h % 8 }

  return (
    <div className="space-y-4 pb-4">
      <div>
        <label className="block text-xs font-black text-gray-500 mb-1.5">NOM DE LA SÉRIE</label>
        <div className="flex gap-2">
          <input value={name} onChange={e => setName(e.target.value)} className="input flex-1" />
          <button onClick={() => onRename(name)} disabled={!name.trim() || name === series.name}
            className="btn btn-primary px-4 disabled:opacity-50">✓</button>
        </div>
      </div>
      <div>
        <label className="block text-xs font-black text-gray-500 mb-2">TOMES ({series.books.length})</label>
        <div className="space-y-2">
          {series.books.map(book => (
            <div key={book.id} className="card p-3 space-y-2">
              <div className="flex items-center gap-3">
                {book.cover_url
                  ? <Image src={book.cover_url} alt={book.title} width={36} height={50} className="rounded-lg object-cover flex-shrink-0" />
                  : <div className={`cover-${coverIdx(book.title)} w-9 h-[50px] rounded-lg flex items-center justify-center text-sm flex-shrink-0`}>📖</div>
                }
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-ink line-clamp-1">{book.title}</p>
                  <p className="text-xs text-gray-400">{book.author}</p>
                </div>
                <button onClick={() => onRemoveBook(book.id)}
                  className="w-7 h-7 rounded-xl bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-100 transition-colors flex-shrink-0">
                  <Trash2 size={13} />
                </button>
              </div>
              {/* Statut (large) + N° tome (petit) */}
              <div className="grid grid-cols-[1fr_72px] gap-2">
                <select
                  value={book.status}
                  onChange={e => onUpdateBook(book.id, { status: e.target.value as BookStatus })}
                  className="input text-xs py-1.5">
                  {STATUSES.map(s => <option key={s} value={s}>{STATUS_EMOJI[s]} {s}</option>)}
                </select>
                <input
                  type="number"
                  value={book.series_number ?? ''}
                  onChange={e => onUpdateBook(book.id, { series_number: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                  placeholder="N°"
                  min="0"
                  max="99"
                  className="input text-xs py-1.5 text-center"
                />
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => onUpdateBook(book.id, { rating: book.rating === n ? 0 : n })}
                    className={`text-lg transition-all hover:scale-125 ${n <= (book.rating || 0) ? '' : 'opacity-25'}`}>⭐</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Sheet pour ajouter des tomes à une série existante ──
function AddToSeriesSheet({ seriesName, onClose, onAdded }: {
  seriesName: string
  onClose: () => void
  onAdded: () => void
}) {
  const supabase = createClient()
  const toast = useToast()
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState<GoogleBookWithMeta[]>([])
  const [searching, setSearching] = useState(false)
  const [mode, setMode] = useState<'one' | 'bulk'>('one')
  const [adding, setAdding] = useState(false)
  const [source, setSource] = useState<'google' | 'openlibrary'>('google')

  function coverIdx(t: string) { let h = 0; for (const c of t) h = (h * 31 + c.charCodeAt(0)) & 0xfffffff; return h % 8 }

  async function doSearch() {
    if (!searchQuery.trim()) return
    setSearching(true); setResults([])
    try {
      const res = await window.fetch(`/api/books-search?q=${encodeURIComponent(searchQuery)}&source=${source}&lang=fr`)
      const data: GoogleBook[] = await res.json()
      setResults(data.map((b, i) => ({
        ...b,
        checked: mode === 'bulk',
        tomeNumber: b.seriesInfo?.bookDisplayNumber || String(i + 1),
      })))
    } catch { setResults([]) }
    setSearching(false)
  }

  async function addTome(book: GoogleBookWithMeta) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('bibliotheque_books').insert({
      user_id: user.id, title: book.title, author: book.authors.join(', '),
      genre: book.categories?.[0], year: extractYear(book.publishedDate),
      pages: book.pageCount, publisher: book.publisher,
      isbn: getISBN(book.industryIdentifiers),
      series_name: seriesName,
      series_number: book.tomeNumber ? parseFloat(book.tomeNumber) : undefined,
      cover_url: getBestCover(book.imageLinks), google_books_id: book.id,
      status: 'À lire', rating: 0,
    })
    toast(`"${book.title}" ajouté ! 📖`, 'success')
    setResults(r => r.filter(b => b.id !== book.id))
    onAdded()
  }

  async function addSelected() {
    const selected = results.filter(b => b.checked)
    if (!selected.length) return
    setAdding(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    for (const book of selected) {
      await supabase.from('bibliotheque_books').insert({
        user_id: user.id, title: book.title, author: book.authors.join(', '),
        genre: book.categories?.[0], year: extractYear(book.publishedDate),
        pages: book.pageCount, publisher: book.publisher,
        isbn: getISBN(book.industryIdentifiers),
        series_name: seriesName,
        series_number: book.tomeNumber ? parseFloat(book.tomeNumber) : undefined,
        cover_url: getBestCover(book.imageLinks), google_books_id: book.id,
        status: 'À lire', rating: 0,
      })
    }
    toast(`${selected.length} tome${selected.length > 1 ? 's' : ''} ajouté${selected.length > 1 ? 's' : ''} ! 📚`, 'success')
    setResults([]); setSearchQuery(''); setAdding(false); onAdded()
  }

  const selectedCount = results.filter(b => b.checked).length

  return (
    <div className="space-y-3 pb-4">
      <p className="text-xs font-black text-gray-400">Ajouter des tomes à <span className="text-violet">{seriesName}</span></p>

      <div className="flex p-1 bg-gray-100 rounded-2xl">
        {([['one', 'Tome par tome'], ['bulk', 'En masse']] as const).map(([m, label]) => (
          <button key={m} onClick={() => { setMode(m); setResults([]) }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl font-black text-xs transition-all ${mode === m ? 'bg-white text-violet shadow-sm' : 'text-gray-400'}`}>
            {m === 'one' ? <List size={13} /> : <Layers size={13} />} {label}
          </button>
        ))}
      </div>

      <div className="flex p-1 bg-gray-100 rounded-2xl">
        {([['google', '🔍 Google Books'], ['openlibrary', '📖 Open Library']] as const).map(([s, label]) => (
          <button key={s} onClick={() => { setSource(s); setResults([]) }}
            className={`flex-1 py-1.5 rounded-xl font-black text-xs transition-all ${source === s ? 'bg-white text-violet shadow-sm' : 'text-gray-400'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            placeholder="Chercher un tome…"
            style={{ paddingLeft: '2.25rem' }} className="input text-sm py-2.5" />
        </div>
        <button onClick={doSearch} disabled={!searchQuery.trim() || searching}
          className="btn btn-primary px-4 py-2.5 disabled:opacity-50 flex-shrink-0">
          {searching ? '⏳' : <Search size={16} />}
        </button>
      </div>

      {searching && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3 p-2 rounded-2xl bg-gray-50 animate-pulse">
              <div className="w-10 h-14 rounded-xl bg-gray-200 flex-shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-3 bg-gray-200 rounded-full w-3/4" />
                <div className="h-3 bg-gray-200 rounded-full w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!searching && results.length > 0 && (
        <div className="space-y-2">
          {mode === 'bulk' && (
            <div className="flex items-center justify-between px-1">
              <button onClick={() => { const all = results.every(b => b.checked); setResults(r => r.map(b => ({ ...b, checked: !all }))) }}
                className="text-xs font-black text-violet hover:underline">
                {results.every(b => b.checked) ? 'Tout décocher' : 'Tout cocher'}
              </button>
              <span className="text-xs font-bold text-gray-500">{selectedCount} sélectionné{selectedCount > 1 ? 's' : ''}</span>
            </div>
          )}
          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {results.map(book => {
              const cover = getBestCover(book.imageLinks)
              const year = extractYear(book.publishedDate)
              return (
                <div key={book.id} className={`flex items-center gap-3 p-2.5 rounded-2xl transition-all ${mode === 'bulk' && book.checked ? 'bg-violet-light ring-2 ring-violet ring-offset-1' : mode === 'bulk' ? 'bg-gray-50 hover:bg-white' : 'bg-gray-50'}`}>
                  {mode === 'bulk' && (
                    <button onClick={() => setResults(r => r.map(b => b.id === book.id ? { ...b, checked: !b.checked } : b))}
                      className={`w-5 h-5 rounded-lg flex-shrink-0 flex items-center justify-center border-2 transition-all ${book.checked ? 'bg-violet border-violet' : 'border-gray-300'}`}>
                      {book.checked && <Check size={12} className="text-white" strokeWidth={3} />}
                    </button>
                  )}
                  {cover
                    ? <Image src={cover} alt={book.title} width={36} height={50} className="rounded-lg object-cover flex-shrink-0" />
                    : <div className={`cover-${coverIdx(book.title)} w-9 h-[50px] rounded-lg flex items-center justify-center text-base flex-shrink-0`}>📖</div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs text-ink line-clamp-1">{book.title}</p>
                    <p className="text-[11px] text-gray-500">{book.authors.join(', ')}</p>
                    {year && <p className="text-[11px] text-gray-400">{year}{book.pageCount ? ` · ${book.pageCount}p` : ''}</p>}
                  </div>
                  <input type="number" value={book.tomeNumber}
                    onChange={e => setResults(r => r.map(b => b.id === book.id ? { ...b, tomeNumber: e.target.value } : b))}
                    placeholder="T." className="w-14 text-center border-2 border-gray-200 rounded-xl text-xs font-black py-1.5 focus:border-violet outline-none flex-shrink-0" />
                  {mode === 'one' && (
                    <button onClick={() => addTome(book)}
                      className="w-8 h-8 rounded-xl bg-violet text-white flex items-center justify-center hover:bg-violet-dark transition-colors flex-shrink-0">
                      <Plus size={16} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          {mode === 'bulk' && (
            <button onClick={addSelected} disabled={selectedCount === 0 || adding}
              className="btn btn-primary w-full py-3 disabled:opacity-50">
              {adding ? '⏳ Ajout…' : <><Plus size={15} /> Ajouter {selectedCount} tome{selectedCount > 1 ? 's' : ''}</>}
            </button>
          )}
        </div>
      )}

      <button onClick={onClose} className="btn btn-ghost w-full text-gray-400">Fermer</button>
    </div>
  )
}

// ── Page principale ──
function SeriesContent() {
  const supabase = createClient()
  const toast = useToast()

  const [series, setSeries] = useState<Series[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [missingFilter, setMissingFilter] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editingSeries, setEditingSeries] = useState<Series | null>(null)
  const [addingToSeries, setAddingToSeries] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [mode, setMode] = useState<'one' | 'bulk'>('bulk')
  const [seriesName, setSeriesName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState<GoogleBookWithMeta[]>([])
  const [searching, setSearching] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [source, setSource] = useState<'google' | 'openlibrary'>('google')
  const [adding, setAdding] = useState(false)

  const loadSeries = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('bibliotheque_books').select('*').eq('user_id', user.id)
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

  function hasMissing(books: Book[]) {
    return books.some(b => b.status === 'À lire')
  }

  const filtered = series.filter(s => {
    const matchQuery = !query || s.name.toLowerCase().includes(query.toLowerCase()) ||
      s.books.some(b => b.author.toLowerCase().includes(query.toLowerCase()))
    const matchMissing = !missingFilter || hasMissing(s.books)
    return matchQuery && matchMissing
  })

  const seriesWithMissingCount = series.filter(s => hasMissing(s.books)).length

  async function addMissingToWishlist(book: Book) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('bibliotheque_wishlist').insert({
      user_id: user.id,
      title: book.title,
      author: book.author,
      cover_url: book.cover_url,
      year: book.year,
      priority: 'Haute',
      notes: `Tome manquant de la série "${book.series_name}"`,
    })
    toast(`"${book.title}" ajouté aux souhaits ! ✨`, 'success')
  }

  async function doSearch(q = searchQuery, p = 0, src = source) {
    if (!q.trim()) return
    if (p === 0) { setSearching(true); setResults([]) }
    else setLoadingMore(true)
    try {
      const res = await window.fetch(`/api/books-search?q=${encodeURIComponent(q)}&page=${p}&source=${src}`)
      const data: GoogleBook[] = await res.json()
      const mapped = data.map((b, i) => ({
        ...b,
        checked: mode === 'bulk',
        tomeNumber: b.seriesInfo?.bookDisplayNumber || (mode === 'bulk' ? String(i + 1) : ''),
      }))
      if (p === 0) setResults(mapped)
      else setResults(r => [...r, ...mapped])
      setPage(p)
      setHasMore(data.length === 20)
    } catch { if (p === 0) setResults([]) }
    setSearching(false); setLoadingMore(false)
  }

  async function addTome(book: GoogleBookWithMeta) {
    if (!seriesName.trim()) { toast('Donnez un nom à la série !', 'error'); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('bibliotheque_books').insert({
      user_id: user.id, title: book.title, author: book.authors.join(', '),
      genre: book.categories?.[0], year: extractYear(book.publishedDate),
      pages: book.pageCount, publisher: book.publisher,
      isbn: getISBN(book.industryIdentifiers),
      series_name: seriesName.trim(),
      series_number: book.tomeNumber ? parseFloat(book.tomeNumber) : undefined,
      cover_url: getBestCover(book.imageLinks), google_books_id: book.id,
      status: 'À lire', rating: 0,
    })
    toast(`"${book.title}" ajouté ! 📖`, 'success')
    setResults(r => r.filter(b => b.id !== book.id))
    loadSeries()
  }

  async function addSelected() {
    const selected = results.filter(b => b.checked)
    if (!selected.length) return
    if (!seriesName.trim()) { toast('Donnez un nom à la série !', 'error'); return }
    setAdding(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    for (const book of selected) {
      await supabase.from('bibliotheque_books').insert({
        user_id: user.id, title: book.title, author: book.authors.join(', '),
        genre: book.categories?.[0], year: extractYear(book.publishedDate),
        pages: book.pageCount, publisher: book.publisher,
        isbn: getISBN(book.industryIdentifiers),
        series_name: seriesName.trim(),
        series_number: book.tomeNumber ? parseFloat(book.tomeNumber) : undefined,
        cover_url: getBestCover(book.imageLinks), google_books_id: book.id,
        status: 'À lire', rating: 0,
      })
    }
    toast(`${selected.length} tome${selected.length > 1 ? 's' : ''} ajouté${selected.length > 1 ? 's' : ''} ! 📚`, 'success')
    setResults([]); setSearchQuery(''); setAdding(false); loadSeries()
  }

  async function addToWishlist(book: GoogleBookWithMeta) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('bibliotheque_wishlist').insert({
      user_id: user.id, title: book.title, author: book.authors.join(', '),
      cover_url: getBestCover(book.imageLinks), google_books_id: book.id,
      year: extractYear(book.publishedDate), priority: 'Moyenne',
    })
    toast(`"${book.title}" ajouté aux souhaits ✨`, 'success')
  }

  async function addSelectedToWishlist() {
    const selected = results.filter(b => b.checked)
    if (!selected.length) return
    for (const book of selected) await addToWishlist(book)
    toast(`${selected.length} livre${selected.length > 1 ? 's' : ''} ajouté${selected.length > 1 ? 's' : ''} aux souhaits ✨`, 'success')
  }

  async function updateSeriesName(oldName: string, newName: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !newName.trim()) return
    await supabase.from('bibliotheque_books').update({ series_name: newName.trim() })
      .eq('user_id', user.id).eq('series_name', oldName)
    toast('Série renommée !', 'success')
    setEditingSeries(null); loadSeries()
  }

  async function updateBookInSeries(bookId: string, data: Partial<Book>) {
    await supabase.from('bibliotheque_books').update(data).eq('id', bookId)
    setSeries(s => s.map(serie => ({
      ...serie,
      books: serie.books.map(b => b.id === bookId ? { ...b, ...data } : b)
    })))
  }

  async function removeFromSeries(bookId: string) {
    if (!confirm('Retirer ce tome de la série ?')) return
    await supabase.from('bibliotheque_books').update({ series_name: null, series_number: null }).eq('id', bookId)
    toast('Tome retiré', 'info'); loadSeries()
  }

  function reset() {
    setShowCreate(false); setSeriesName(''); setSearchQuery('')
    setResults([]); setMode('bulk'); setPage(0)
  }

  function coverIdx(t: string) { let h = 0; for (const c of t) h = (h * 31 + c.charCodeAt(0)) & 0xfffffff; return h % 8 }
  function progressColor(pct: number) { return pct === 100 ? 'bg-mint' : pct >= 50 ? 'bg-amber' : 'bg-violet' }
  const selectedCount = results.filter(b => b.checked).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-black text-2xl text-ink">Mes séries 📚</h1>
        <button onClick={() => setShowCreate(!showCreate)} className="btn btn-primary py-2 px-4 text-sm">
          <Plus size={15} /> Nouvelle série
        </button>
      </div>

      {/* ── Pills filtre ── */}
      <div className="flex gap-2 py-0.5 -mx-4 px-4 overflow-x-auto">
        <button onClick={() => setMissingFilter(false)}
          className={`flex-shrink-0 px-4 py-2 rounded-pill font-black text-sm transition-all ${!missingFilter ? 'bg-violet text-white shadow-glow' : 'bg-white text-gray-500 shadow-sm'}`}>
          Toutes · {series.length}
        </button>
        {seriesWithMissingCount > 0 && (
          <button onClick={() => setMissingFilter(!missingFilter)}
            className={`flex-shrink-0 px-4 py-2 rounded-pill font-black text-sm transition-all whitespace-nowrap ${missingFilter ? 'bg-coral-light text-coral-dark shadow-card ring-2 ring-offset-1 ring-current' : 'bg-white text-gray-500 shadow-sm'}`}>
            📋 Manquants · {seriesWithMissingCount}
          </button>
        )}
      </div>

      {/* ── Créer une série ── */}
      {showCreate && (
        <div className="card p-4 space-y-4 bg-gradient-to-br from-violet-light to-pink-light">
          <div>
            <label className="block text-xs font-black text-ink mb-1.5">NOM DE LA SÉRIE *</label>
            <input value={seriesName} onChange={e => setSeriesName(e.target.value)}
              placeholder="Ex: Harry Potter, Dune, Astérix…" className="input font-black" />
          </div>
          <div>
            <label className="block text-xs font-black text-ink mb-1.5">MODE D'AJOUT</label>
            <div className="flex p-1 bg-white rounded-2xl">
              {([['bulk', 'En masse'], ['one', 'Tome par tome']] as const).map(([m, label]) => (
                <button key={m} onClick={() => { setMode(m as 'bulk' | 'one'); setResults([]) }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl font-black text-sm transition-all ${mode === m ? 'bg-violet text-white shadow-sm' : 'text-gray-500 hover:text-violet'}`}>
                  {m === 'bulk' ? <Layers size={15} /> : <List size={15} />} {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex p-1 bg-white rounded-2xl">
            {([['google', '🔍 Google Books'], ['openlibrary', '📖 Open Library']] as const).map(([s, label]) => (
              <button key={s} onClick={() => { setSource(s); setResults([]); setPage(0) }}
                className={`flex-1 py-1.5 rounded-xl font-black text-xs transition-all ${source === s ? 'bg-violet-light text-violet shadow-sm' : 'text-gray-400'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSearch()}
                placeholder={mode === 'bulk' ? 'Chercher tous les tomes…' : 'Chercher un tome…'}
                style={{ paddingLeft: '2.25rem' }} className="input text-sm py-2.5" />
            </div>
            <button onClick={() => doSearch()} disabled={!searchQuery.trim() || searching}
              className="btn btn-primary px-4 py-2.5 disabled:opacity-50 flex-shrink-0">
              {searching ? '⏳' : <Search size={16} />}
            </button>
          </div>

          {searching && (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-3 p-2 rounded-2xl bg-white/60 animate-pulse">
                  <div className="w-10 h-14 rounded-xl bg-gray-200 flex-shrink-0" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-3 bg-gray-200 rounded-full w-3/4" />
                    <div className="h-3 bg-gray-200 rounded-full w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!searching && results.length > 0 && (
            <div className="space-y-2">
              {mode === 'bulk' && (
                <div className="flex items-center justify-between px-1">
                  <button onClick={() => { const all = results.every(b => b.checked); setResults(r => r.map(b => ({ ...b, checked: !all }))) }}
                    className="text-xs font-black text-violet hover:underline">
                    {results.every(b => b.checked) ? 'Tout décocher' : 'Tout cocher'}
                  </button>
                  <span className="text-xs font-bold text-gray-500">{selectedCount} sélectionné{selectedCount > 1 ? 's' : ''}</span>
                </div>
              )}
              <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                {results.map(book => {
                  const cover = getBestCover(book.imageLinks)
                  const year = extractYear(book.publishedDate)
                  return (
                    <div key={book.id} className={`flex items-center gap-3 p-2.5 rounded-2xl transition-all ${mode === 'bulk' && book.checked ? 'bg-violet-light ring-2 ring-violet ring-offset-1' : mode === 'bulk' ? 'bg-white/70 hover:bg-white' : 'bg-white'}`}>
                      {mode === 'bulk' && (
                        <button onClick={() => setResults(r => r.map(b => b.id === book.id ? { ...b, checked: !b.checked } : b))}
                          className={`w-5 h-5 rounded-lg flex-shrink-0 flex items-center justify-center border-2 transition-all ${book.checked ? 'bg-violet border-violet' : 'border-gray-300'}`}>
                          {book.checked && <Check size={12} className="text-white" strokeWidth={3} />}
                        </button>
                      )}
                      {cover
                        ? <Image src={cover} alt={book.title} width={36} height={50} className="rounded-lg object-cover flex-shrink-0" />
                        : <div className={`cover-${coverIdx(book.title)} w-9 h-[50px] rounded-lg flex items-center justify-center text-base flex-shrink-0`}>📖</div>
                      }
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-xs text-ink line-clamp-1">{book.title}</p>
                        <p className="text-[11px] text-gray-500">{book.authors.join(', ')}</p>
                        {year && <p className="text-[11px] text-gray-400">{year}{book.pageCount ? ` · ${book.pageCount}p` : ''}</p>}
                      </div>
                      <input type="number" value={book.tomeNumber}
                        onChange={e => setResults(r => r.map(b => b.id === book.id ? { ...b, tomeNumber: e.target.value } : b))}
                        placeholder="T." className="w-14 text-center border-2 border-gray-200 rounded-xl text-xs font-black py-1.5 focus:border-violet outline-none flex-shrink-0" />
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        {mode === 'one' && (
                          <button onClick={() => addTome(book)}
                            className="w-8 h-8 rounded-xl bg-violet text-white flex items-center justify-center hover:bg-violet-dark transition-colors"
                            title="Ajouter à la série">
                            <Plus size={16} />
                          </button>
                        )}
                        <button onClick={() => addToWishlist(book)}
                          className="w-8 h-8 rounded-xl bg-pink-light text-pink flex items-center justify-center hover:bg-pink hover:text-white transition-colors"
                          title="Ajouter à mes souhaits">
                          ♥
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
              {hasMore && (
                <button onClick={() => doSearch(searchQuery, page + 1)} disabled={loadingMore}
                  className="w-full py-2.5 rounded-2xl bg-white/60 hover:bg-white font-black text-xs text-gray-500 transition-colors disabled:opacity-50">
                  {loadingMore ? '⏳ Chargement…' : '+ Charger plus'}
                </button>
              )}
              {mode === 'bulk' && (
                <div className="space-y-2">
                  <button onClick={addSelected} disabled={selectedCount === 0 || adding || !seriesName.trim()}
                    className="btn btn-primary w-full py-3 disabled:opacity-50">
                    {adding ? '⏳ Ajout…' : <><Plus size={15} /> Ajouter {selectedCount} tome{selectedCount > 1 ? 's' : ''} à la série</>}
                  </button>
                  {selectedCount > 0 && (
                    <button onClick={addSelectedToWishlist}
                      className="w-full py-2.5 rounded-2xl bg-pink-light text-pink hover:bg-pink hover:text-white transition-colors font-black text-sm">
                      ♥ Ajouter {selectedCount} à mes souhaits
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          <button onClick={reset} className="btn btn-ghost w-full text-gray-400">Annuler</button>
        </div>
      )}

      {/* ── Filtrer mes séries ── */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Filtrer mes séries…"
          style={{ paddingLeft: '2.25rem' }}
          className="input pr-9 py-2.5 text-sm" />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X size={15} className="text-gray-400" />
          </button>
        )}
      </div>

      <p className="text-xs font-bold text-gray-400">{filtered.length} série{filtered.length !== 1 ? 's' : ''}</p>

      {/* ── Liste de mes séries ── */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="card h-24 animate-pulse bg-gray-50" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-5xl mb-3 animate-float inline-block">{series.length === 0 ? '📚' : '🔍'}</div>
          <p className="font-black text-lg text-ink">{series.length === 0 ? 'Aucune série !' : 'Aucun résultat'}</p>
          <p className="text-sm text-gray-400 mt-1">{series.length === 0 ? 'Cliquez sur "Nouvelle série" pour commencer !' : 'Essayez un autre terme'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(({ name, books }) => {
            const isOpen = expanded === name
            const lu = books.filter(b => b.status === 'Lu').length
            const pct = Math.round(lu / books.length * 100)
            const missingBooks = books.filter(b => b.status === 'À lire')

            return (
              <div key={name} className="card overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  {/* Cover stack */}
                  <div className="relative w-12 h-16 flex-shrink-0 cursor-pointer" onClick={() => setExpanded(isOpen ? null : name)}>
                    {books.slice(0, 3).map((b, i) => (
                      b.cover_url
                        ? <Image key={b.id} src={b.cover_url} alt={b.title} width={40} height={56}
                          className="absolute rounded-lg object-cover shadow-sm border-2 border-white"
                          style={{ left: i * 4, top: i * 2, zIndex: 3 - i }} />
                        : <div key={b.id} className={`cover-${coverIdx(b.title)} absolute w-10 h-14 rounded-lg shadow-sm border-2 border-white flex items-center justify-center text-lg`}
                          style={{ left: i * 4, top: i * 2, zIndex: 3 - i }}>📖</div>
                    ))}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded(isOpen ? null : name)}>
                    <p className="font-black text-sm text-ink">{name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{books[0]?.author}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${progressColor(pct)}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] font-black text-gray-500 flex-shrink-0">{lu}/{books.length} lu{lu > 1 ? 's' : ''}</span>
                    </div>
                    {missingBooks.length > 0 && (
                      <span className="inline-block mt-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-coral-light text-coral-dark">
                        📋 {missingBooks.length} à lire
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setAddingToSeries(name)}
                      className="w-8 h-8 rounded-xl bg-violet-light text-violet flex items-center justify-center hover:bg-violet hover:text-white transition-colors"
                      title="Ajouter des tomes">
                      <Plus size={14} />
                    </button>
                    <button onClick={() => setEditingSeries({ name, books })}
                      className="w-8 h-8 rounded-xl bg-amber-light text-amber-dark flex items-center justify-center hover:bg-amber/20 transition-colors">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => setExpanded(isOpen ? null : name)} className="text-gray-300 p-1">
                      {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>

                {/* Liste des tomes */}
                {isOpen && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50">
                    {books.map(book => (
                      <div key={book.id} className="flex items-center gap-3 px-4 py-3">
                        {book.cover_url
                          ? <Image src={book.cover_url} alt={book.title} width={36} height={50} className="rounded-lg object-cover flex-shrink-0" />
                          : <div className={`cover-${coverIdx(book.title)} w-9 h-[50px] rounded-lg flex items-center justify-center text-base flex-shrink-0`}>📖</div>
                        }
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-ink line-clamp-1">
                            {book.series_number ? `#${book.series_number} · ` : ''}{book.title}
                          </p>
                          {book.rating > 0 && <span className="text-xs">{'⭐'.repeat(book.rating)}</span>}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className={STATUS_CHIP[book.status]}>{book.status}</span>
                          {/* Bouton "manquant" — ajoute à la wishlist */}
                          <button
                            onClick={() => addMissingToWishlist(book)}
                            className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400 hover:bg-coral-light hover:text-coral-dark transition-colors"
                            title="Marquer comme manquant et ajouter aux souhaits">
                            📋
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Sheets */}
      <BottomSheet open={!!editingSeries} onClose={() => setEditingSeries(null)} title="Modifier la série">
        {editingSeries && (
          <EditSeriesSheet
            series={editingSeries}
            onRename={newName => updateSeriesName(editingSeries.name, newName)}
            onUpdateBook={updateBookInSeries}
            onRemoveBook={removeFromSeries}
          />
        )}
      </BottomSheet>

      <BottomSheet open={!!addingToSeries} onClose={() => setAddingToSeries(null)} title={`Ajouter à "${addingToSeries}"`}>
        {addingToSeries && (
          <AddToSeriesSheet
            seriesName={addingToSeries}
            onClose={() => setAddingToSeries(null)}
            onAdded={loadSeries}
          />
        )}
      </BottomSheet>
    </div>
  )
}

export default function SeriesPage() {
  return <ToastProvider><AppLayout><SeriesContent /></AppLayout></ToastProvider>
}
