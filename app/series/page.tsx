'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Book, GoogleBook } from '@/types'
import AppLayout from '@/components/layout/AppLayout'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { Search, X, ChevronDown, ChevronUp, Plus, Check, ArrowLeft, List, Layers } from 'lucide-react'
import Image from 'next/image'
import { extractYear, getBestCover, getISBN } from '@/lib/google-books'

interface Series { name: string; books: Book[] }
interface GoogleBookWithMeta extends GoogleBook { checked: boolean; tomeNumber: string }

function SeriesContent() {
  const supabase = createClient()
  const toast = useToast()

  // Mes séries
  const [series, setSeries] = useState<Series[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  // Création de série
  const [showCreate, setShowCreate] = useState(false)
  const [mode, setMode] = useState<'one'|'bulk'>('bulk')
  const [seriesName, setSeriesName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState<GoogleBookWithMeta[]>([])
  const [searching, setSearching] = useState(false)
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

  async function doSearch() {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const res = await window.fetch(`/api/books-search?q=${encodeURIComponent(searchQuery)}`)
      const data: GoogleBook[] = await res.json()
      setResults(data.map((b, i) => ({
        ...b,
        checked: mode === 'bulk',
        tomeNumber: b.seriesInfo?.bookDisplayNumber || (mode === 'one' ? '' : String(i + 1)),
      })))
    } catch { setResults([]) }
    setSearching(false)
  }

  async function addTome(book: GoogleBookWithMeta) {
    if (!seriesName.trim()) { toast('Donnez un nom à la série !', 'error'); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('books').insert({
      user_id: user.id,
      title: book.title,
      author: book.authors.join(', '),
      genre: book.categories?.[0],
      year: extractYear(book.publishedDate),
      pages: book.pageCount,
      publisher: book.publisher,
      isbn: getISBN(book.industryIdentifiers),
      series_name: seriesName.trim(),
      series_number: book.tomeNumber ? parseFloat(book.tomeNumber) : undefined,
      cover_url: getBestCover(book.imageLinks),
      google_books_id: book.id,
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
      await supabase.from('books').insert({
        user_id: user.id,
        title: book.title,
        author: book.authors.join(', '),
        genre: book.categories?.[0],
        year: extractYear(book.publishedDate),
        pages: book.pageCount,
        publisher: book.publisher,
        isbn: getISBN(book.industryIdentifiers),
        series_name: seriesName.trim(),
        series_number: book.tomeNumber ? parseFloat(book.tomeNumber) : undefined,
        cover_url: getBestCover(book.imageLinks),
        google_books_id: book.id,
        status: 'À lire', rating: 0,
      })
    }
    toast(`${selected.length} tome${selected.length > 1 ? 's' : ''} ajouté${selected.length > 1 ? 's' : ''} ! 📚`, 'success')
    setResults([]); setSearchQuery(''); setAdding(false)
    loadSeries()
  }

  function reset() {
    setShowCreate(false); setSeriesName(''); setSearchQuery('')
    setResults([]); setMode('bulk')
  }

  const COVERS = 8
  function coverIdx(t: string) { let h=0; for(const c of t)h=(h*31+c.charCodeAt(0))&0xfffffff; return h%COVERS }
  function progressColor(pct: number) { return pct===100?'bg-mint':pct>=50?'bg-amber':'bg-violet' }
  const selectedCount = results.filter(b => b.checked).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-black text-2xl text-ink">Mes séries 📚</h1>
        <button onClick={() => setShowCreate(!showCreate)}
          className="btn btn-primary py-2 px-4 text-sm">
          <Plus size={15}/> Nouvelle série
        </button>
      </div>

      {/* Créer une série */}
      {showCreate && (
        <div className="card p-4 space-y-4 bg-gradient-to-br from-violet-light to-pink-light">

          {/* Nom de la série */}
          <div>
            <label className="block text-xs font-black text-ink mb-1.5">NOM DE LA SÉRIE *</label>
            <input value={seriesName} onChange={e => setSeriesName(e.target.value)}
              placeholder="Ex: Harry Potter, Dune, Astérix…"
              className="input font-black"/>
          </div>

          {/* Mode toggle */}
          <div>
            <label className="block text-xs font-black text-ink mb-1.5">MODE D'AJOUT</label>
            <div className="flex p-1 bg-white rounded-2xl">
              <button onClick={() => { setMode('bulk'); setResults([]) }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl font-black text-sm transition-all ${mode==='bulk'?'bg-violet text-white shadow-sm':'text-gray-500 hover:text-violet'}`}>
                <Layers size={15}/> En masse
              </button>
              <button onClick={() => { setMode('one'); setResults([]) }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl font-black text-sm transition-all ${mode==='one'?'bg-violet text-white shadow-sm':'text-gray-500 hover:text-violet'}`}>
                <List size={15}/> Tome par tome
              </button>
            </div>
            <p className="text-[11px] text-gray-500 font-semibold mt-1.5 px-1">
              {mode==='bulk'
                ? '🔍 Cherchez tous les tomes, cochez ceux que vous voulez et numérotez-les avant d\'ajouter'
                : '🔍 Cherchez chaque tome individuellement et ajoutez-les un par un'}
            </p>
          </div>

          {/* Recherche */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10"/>
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key==='Enter' && doSearch()}
                placeholder={mode==='bulk' ? 'Chercher tous les tomes…' : 'Chercher un tome…'}
                style={{ paddingLeft: '2.25rem' }}
                className="input text-sm py-2.5"/>
            </div>
            <button onClick={doSearch} disabled={!searchQuery.trim()||searching}
              className="btn btn-primary px-4 py-2.5 disabled:opacity-50 flex-shrink-0">
              {searching ? '⏳' : <Search size={16}/>}
            </button>
          </div>

          {/* Résultats */}
          {searching && (
            <div className="space-y-2">
              {[1,2,3].map(i=>(
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

          {!searching && results.length > 0 && (
            <div className="space-y-2">

              {/* Header bulk */}
              {mode==='bulk' && (
                <div className="flex items-center justify-between px-1">
                  <button onClick={() => { const all=results.every(b=>b.checked); setResults(r=>r.map(b=>({...b,checked:!all}))) }}
                    className="text-xs font-black text-violet hover:underline">
                    {results.every(b=>b.checked)?'Tout décocher':'Tout cocher'}
                  </button>
                  <span className="text-xs font-bold text-gray-500">{selectedCount} sélectionné{selectedCount>1?'s':''}</span>
                </div>
              )}

              <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                {results.map(book => {
                  const cover = getBestCover(book.imageLinks)
                  const year = extractYear(book.publishedDate)
                  return (
                    <div key={book.id}
                      className={`flex items-center gap-3 p-2.5 rounded-2xl transition-all ${
                        mode==='bulk' && book.checked ? 'bg-violet-light ring-2 ring-violet ring-offset-1'
                        : mode==='bulk' ? 'bg-white/70 hover:bg-white'
                        : 'bg-white'
                      }`}>

                      {/* Checkbox (bulk only) */}
                      {mode==='bulk' && (
                        <button onClick={() => setResults(r=>r.map(b=>b.id===book.id?{...b,checked:!b.checked}:b))}
                          className={`w-5 h-5 rounded-lg flex-shrink-0 flex items-center justify-center border-2 transition-all ${
                            book.checked?'bg-violet border-violet':'border-gray-300'
                          }`}>
                          {book.checked && <Check size={12} className="text-white" strokeWidth={3}/>}
                        </button>
                      )}

                      {cover
                        ? <Image src={cover} alt={book.title} width={36} height={50} className="rounded-lg object-cover flex-shrink-0"/>
                        : <div className={`cover-${coverIdx(book.title)} w-9 h-[50px] rounded-lg flex items-center justify-center text-base flex-shrink-0`}>📖</div>
                      }

                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-xs text-ink line-clamp-1">{book.title}</p>
                        <p className="text-[11px] text-gray-500">{book.authors.join(', ')}</p>
                        {year && <p className="text-[11px] text-gray-400">{year}{book.pageCount ? ` · ${book.pageCount}p` : ''}</p>}
                      </div>

                      {/* Numéro de tome */}
                      <input
                        type="number"
                        value={book.tomeNumber}
                        onChange={e => setResults(r=>r.map(b=>b.id===book.id?{...b,tomeNumber:e.target.value}:b))}
                        placeholder="T."
                        className="w-14 text-center border-2 border-gray-200 rounded-xl text-xs font-black py-1.5 focus:border-violet outline-none flex-shrink-0"
                      />

                      {/* Bouton ajouter (tome par tome) */}
                      {mode==='one' && (
                        <button onClick={() => addTome(book)}
                          className="w-8 h-8 rounded-xl bg-violet text-white flex items-center justify-center hover:bg-violet-dark transition-colors flex-shrink-0 flex-shrink-0">
                          <Plus size={16}/>
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Bouton ajouter tout (bulk) */}
              {mode==='bulk' && (
                <button onClick={addSelected} disabled={selectedCount===0||adding||!seriesName.trim()}
                  className="btn btn-primary w-full py-3 disabled:opacity-50">
                  {adding ? '⏳ Ajout…' : <><Plus size={15}/> Ajouter {selectedCount} tome{selectedCount>1?'s':''}</>}
                </button>
              )}
            </div>
          )}

          <button onClick={reset} className="btn btn-ghost w-full text-gray-400">
            Annuler
          </button>
        </div>
      )}

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

      <p className="text-xs font-bold text-gray-400">{filtered.length} série{filtered.length!==1?'s':''}</p>

      {/* Liste de mes séries */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i=><div key={i} className="card h-24 animate-pulse bg-gray-50"/>)}
        </div>
      ) : filtered.length===0 ? (
        <div className="card p-10 text-center">
          <div className="text-5xl mb-3 animate-float inline-block">{series.length===0?'📚':'🔍'}</div>
          <p className="font-black text-lg text-ink">{series.length===0?'Aucune série !':'Aucun résultat'}</p>
          <p className="text-sm text-gray-400 mt-1">{series.length===0?'Cliquez sur "Nouvelle série" pour commencer !':'Essayez un autre terme'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(({ name, books }) => {
            const isOpen = expanded===name
            const lu = books.filter(b=>b.status==='Lu').length
            const pct = Math.round(lu/books.length*100)
            return (
              <div key={name} className="card overflow-hidden">
                <button onClick={() => setExpanded(isOpen?null:name)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-bg-base transition-colors">
                  <div className="relative w-12 h-16 flex-shrink-0">
                    {books.slice(0,3).map((b,i)=>(
                      b.cover_url
                        ? <Image key={b.id} src={b.cover_url} alt={b.title} width={40} height={56}
                            className="absolute rounded-lg object-cover shadow-sm border-2 border-white"
                            style={{left:i*4,top:i*2,zIndex:3-i}}/>
                        : <div key={b.id} className={`cover-${coverIdx(b.title)} absolute w-10 h-14 rounded-lg shadow-sm border-2 border-white flex items-center justify-center text-lg`}
                            style={{left:i*4,top:i*2,zIndex:3-i}}>📖</div>
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm text-ink">{name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{books[0]?.author}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${progressColor(pct)}`} style={{width:`${pct}%`}}/>
                      </div>
                      <span className="text-[11px] font-black text-gray-500 flex-shrink-0">{lu}/{books.length} lu{lu>1?'s':''}</span>
                    </div>
                  </div>
                  {isOpen?<ChevronUp size={18} className="text-gray-300 flex-shrink-0"/>:<ChevronDown size={18} className="text-gray-300 flex-shrink-0"/>}
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50">
                    {books.map(book => {
                      const STATUS_CHIP: Record<string,string> = {'Lu':'chip chip-lu','En cours':'chip chip-en','À lire':'chip chip-al','Abandonné':'chip chip-ab'}
                      return (
                        <div key={book.id} className="flex items-center gap-3 px-4 py-3">
                          {book.cover_url
                            ? <Image src={book.cover_url} alt={book.title} width={36} height={50} className="rounded-lg object-cover flex-shrink-0"/>
                            : <div className={`cover-${coverIdx(book.title)} w-9 h-[50px] rounded-lg flex items-center justify-center text-base flex-shrink-0`}>📖</div>
                          }
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-ink line-clamp-1">
                              {book.series_number?`#${book.series_number} · `:''}{book.title}
                            </p>
                            {book.rating>0 && <span className="text-xs">{'⭐'.repeat(book.rating)}</span>}
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
