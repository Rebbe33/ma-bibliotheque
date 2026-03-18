'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { Sparkles, SlidersHorizontal, Search, RefreshCw, Plus } from 'lucide-react'
import Image from 'next/image'
import { getBestCover, extractYear } from '@/lib/google-books'
import { GoogleBook } from '@/types'

interface SuggestedBook extends GoogleBook {
  reason?: string
}

function DiscoverContent() {
  const supabase = createClient()
  const toast = useToast()

  const [mode, setMode] = useState<'auto' | 'manual'>('auto')
  const [suggestions, setSuggestions] = useState<SuggestedBook[]>([])
  const [loading, setLoading] = useState(false)
  const [myBookTitles, setMyBookTitles] = useState<Set<string>>(new Set())
  const [myWishlistTitles, setMyWishlistTitles] = useState<Set<string>>(new Set())

  // Stats pour le mode auto
  const [topGenres, setTopGenres] = useState<string[]>([])
  const [topAuthors, setTopAuthors] = useState<string[]>([])

  // Filtres manuels
  const [manualGenre, setManualGenre] = useState('')
  const [manualAuthor, setManualAuthor] = useState('')
  const [manualYearMin, setManualYearMin] = useState('')
  const [manualYearMax, setManualYearMax] = useState('')
  const [manualLang, setManualLang] = useState('fr')
  const [manualSource, setManualSource] = useState<'auto' | 'genre' | 'author'>('auto')

  // Chargement des données utilisateur
  const loadUserData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: books } = await supabase
      .from('bibliotheque_books')
      .select('title, author, genre, rating, status')
      .eq('user_id', user.id)

    const { data: wishlist } = await supabase
      .from('bibliotheque_wishlist')
      .select('title')
      .eq('user_id', user.id)

    // Titres à exclure
    setMyBookTitles(new Set((books || []).map(b => b.title.toLowerCase())))
    setMyWishlistTitles(new Set((wishlist || []).map(w => w.title.toLowerCase())))

    // Genres favoris (livres notés 4-5)
    const wellRated = (books || []).filter(b => b.rating >= 4)
    const genreCount: Record<string, number> = {}
    wellRated.forEach(b => {
      if (b.genre) genreCount[b.genre] = (genreCount[b.genre] || 0) + 1
    })
    const sortedGenres = Object.entries(genreCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([g]) => g)
    setTopGenres(sortedGenres)

    // Auteurs favoris (livres notés 4-5)
    const authorCount: Record<string, number> = {}
    wellRated.forEach(b => {
      if (b.author) authorCount[b.author] = (authorCount[b.author] || 0) + 1
    })
    const sortedAuthors = Object.entries(authorCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([a]) => a)
    setTopAuthors(sortedAuthors)
  }, [])

  useEffect(() => { loadUserData() }, [loadUserData])

  // Recherche Google Books
  async function fetchBooks(query: string, lang: string, reason: string): Promise<SuggestedBook[]> {
    try {
      const res = await window.fetch(
        `/api/books-search?q=${encodeURIComponent(query)}&lang=${lang}&page=0`
      )
      const data: GoogleBook[] = await res.json()
      return data.map(b => ({ ...b, reason }))
    } catch { return [] }
  }

  // Filtre les livres déjà connus
  function filterKnown(books: SuggestedBook[]): SuggestedBook[] {
    return books.filter(b =>
      !myBookTitles.has(b.title.toLowerCase()) &&
      !myWishlistTitles.has(b.title.toLowerCase())
    )
  }

  // Dédoublonner par titre
  function dedupe(books: SuggestedBook[]): SuggestedBook[] {
    const seen = new Set<string>()
    return books.filter(b => {
      const key = b.title.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  async function loadAutoSuggestions() {
    if (topGenres.length === 0 && topAuthors.length === 0) {
      toast('Notez des livres 4-5⭐ pour obtenir des suggestions !', 'info')
      return
    }
    setLoading(true); setSuggestions([])

    const all: SuggestedBook[] = []

    // Par genre
    for (const genre of topGenres.slice(0, 2)) {
      const results = await fetchBooks(`subject:${genre}`, 'fr', `Genre : ${genre}`)
      all.push(...results)
    }

    // Par auteur
    for (const author of topAuthors.slice(0, 2)) {
      const firstName = author.split(' ')[0]
      const results = await fetchBooks(`inauthor:${firstName}`, 'fr', `Auteur : ${author}`)
      all.push(...results)
    }

    setSuggestions(dedupe(filterKnown(all)).slice(0, 30))
    setLoading(false)
  }

  async function loadManualSuggestions() {
    if (!manualGenre.trim() && !manualAuthor.trim()) {
      toast('Renseignez au moins un genre ou un auteur', 'info')
      return
    }
    setLoading(true); setSuggestions([])

    let query = ''
    let reason = ''

    if (manualSource === 'genre' || (manualSource === 'auto' && manualGenre.trim())) {
      query = `subject:${manualGenre.trim()}`
      reason = `Genre : ${manualGenre}`
      if (manualAuthor.trim()) { query += ` inauthor:${manualAuthor.trim()}`; reason += ` · ${manualAuthor}` }
    } else if (manualSource === 'author' || manualAuthor.trim()) {
      query = `inauthor:${manualAuthor.trim()}`
      reason = `Auteur : ${manualAuthor}`
    }

    if (manualYearMin.trim()) query += ` after:${manualYearMin}`
    if (manualYearMax.trim()) query += ` before:${manualYearMax}`

    const results = await fetchBooks(query, manualLang, reason)
    const filtered = filterKnown(results)
    setSuggestions(dedupe(filtered).slice(0, 30))
    setLoading(false)
  }

  async function addToWishlist(book: SuggestedBook) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Vérifier doublon
    const { data: existing } = await supabase
      .from('bibliotheque_wishlist')
      .select('id')
      .eq('user_id', user.id)
      .eq('title', book.title)
      .maybeSingle()

    if (existing) {
      toast('Déjà dans tes souhaits !', 'info')
      return
    }

    await supabase.from('bibliotheque_wishlist').insert({
      user_id: user.id,
      title: book.title,
      author: book.authors.join(', '),
      cover_url: getBestCover(book.imageLinks),
      google_books_id: book.id,
      year: extractYear(book.publishedDate),
      priority: 'Moyenne',
    })

    toast(`"${book.title}" ajouté aux souhaits ✨`, 'success')
    setMyWishlistTitles(prev => new Set(Array.from(prev).concat(book.title.toLowerCase())))
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display font-black text-2xl text-ink">Découvrir 🔭</h1>

      {/* Toggle mode */}
      <div className="flex p-1 bg-gray-100 rounded-2xl">
        <button onClick={() => setMode('auto')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl font-black text-sm transition-all ${
            mode === 'auto' ? 'bg-white text-violet shadow-sm' : 'text-gray-400'
          }`}>
          <Sparkles size={15}/> Pour moi
        </button>
        <button onClick={() => setMode('manual')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl font-black text-sm transition-all ${
            mode === 'manual' ? 'bg-white text-violet shadow-sm' : 'text-gray-400'
          }`}>
          <SlidersHorizontal size={15}/> Recherche
        </button>
      </div>

      {/* ── Mode Auto ── */}
      {mode === 'auto' && (
        <div className="space-y-3">
          {/* Résumé des préférences */}
          {(topGenres.length > 0 || topAuthors.length > 0) && (
            <div className="card p-4 bg-gradient-to-br from-violet-light to-pink-light space-y-2">
              <p className="text-xs font-black text-gray-500">BASÉ SUR TES PRÉFÉRENCES</p>
              {topGenres.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-xs font-black text-gray-500">Genres :</span>
                  {topGenres.map(g => (
                    <span key={g} className="text-xs font-black px-2 py-0.5 rounded-full bg-violet text-white">{g}</span>
                  ))}
                </div>
              )}
              {topAuthors.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-xs font-black text-gray-500">Auteurs :</span>
                  {topAuthors.map(a => (
                    <span key={a} className="text-xs font-black px-2 py-0.5 rounded-full bg-pink-light text-pink">{a}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {topGenres.length === 0 && topAuthors.length === 0 && (
            <div className="card p-6 text-center">
              <div className="text-4xl mb-2">⭐</div>
              <p className="font-black text-ink">Pas encore assez de données</p>
              <p className="text-sm text-gray-400 mt-1">Notez des livres 4-5⭐ dans ta bibliothèque pour obtenir des suggestions personnalisées !</p>
            </div>
          )}

          <button onClick={loadAutoSuggestions} disabled={loading}
            className="btn btn-primary w-full py-3 disabled:opacity-50">
            {loading
              ? '🔍 Recherche en cours…'
              : <><Sparkles size={16}/> {suggestions.length > 0 ? 'Rafraîchir' : 'Générer des suggestions'}</>
            }
          </button>
        </div>
      )}

      {/* ── Mode Manuel ── */}
      {mode === 'manual' && (
        <div className="card p-4 space-y-3 bg-gradient-to-br from-violet-light to-pink-light">

          {/* Source */}
          <div>
            <label className="block text-xs font-black text-ink mb-1.5">CHERCHER PAR</label>
            <div className="flex p-1 bg-white rounded-2xl">
              {([['auto','Genre + Auteur'],['genre','Genre'],['author','Auteur']] as const).map(([v, label]) => (
                <button key={v} onClick={() => setManualSource(v)}
                  className={`flex-1 py-1.5 rounded-xl font-black text-xs transition-all ${
                    manualSource === v ? 'bg-violet text-white shadow-sm' : 'text-gray-400'
                  }`}>{label}</button>
              ))}
            </div>
          </div>

          {/* Genre */}
          {(manualSource === 'auto' || manualSource === 'genre') && (
            <div>
              <label className="block text-xs font-black text-ink mb-1.5">GENRE</label>
              <input value={manualGenre} onChange={e => setManualGenre(e.target.value)}
                placeholder="Fantasy, Roman, Thriller…" className="input text-sm"/>
            </div>
          )}

          {/* Auteur */}
          {(manualSource === 'auto' || manualSource === 'author') && (
            <div>
              <label className="block text-xs font-black text-ink mb-1.5">AUTEUR</label>
              <input value={manualAuthor} onChange={e => setManualAuthor(e.target.value)}
                placeholder="Nom de l'auteur…" className="input text-sm"/>
            </div>
          )}

          {/* Années */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-black text-ink mb-1.5">ANNÉE MIN</label>
              <input type="number" value={manualYearMin} onChange={e => setManualYearMin(e.target.value)}
                placeholder="2000" className="input text-sm"/>
            </div>
            <div>
              <label className="block text-xs font-black text-ink mb-1.5">ANNÉE MAX</label>
              <input type="number" value={manualYearMax} onChange={e => setManualYearMax(e.target.value)}
                placeholder="2024" className="input text-sm"/>
            </div>
          </div>

          {/* Langue */}
          <div>
            <label className="block text-xs font-black text-ink mb-1.5">LANGUE</label>
            <div className="flex p-1 bg-white rounded-2xl">
              {([['fr','🇫🇷 Français'],['en','🇬🇧 Anglais'],['all','🌍 Toutes']] as const).map(([v, label]) => (
                <button key={v} onClick={() => setManualLang(v)}
                  className={`flex-1 py-1.5 rounded-xl font-black text-xs transition-all ${
                    manualLang === v ? 'bg-violet text-white shadow-sm' : 'text-gray-400'
                  }`}>{label}</button>
              ))}
            </div>
          </div>

          <button onClick={loadManualSuggestions} disabled={loading}
            className="btn btn-primary w-full py-3 disabled:opacity-50">
            {loading ? '🔍 Recherche…' : <><Search size={16}/> Rechercher</>}
          </button>
        </div>
      )}

      {/* ── Résultats ── */}
      {loading && (
        <div className="space-y-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="card flex gap-3 p-3 animate-pulse">
              <div className="w-12 h-16 rounded-xl bg-gray-100 flex-shrink-0"/>
              <div className="flex-1 space-y-2 py-1">
                <div className="h-4 bg-gray-100 rounded-full w-3/4"/>
                <div className="h-3 bg-gray-100 rounded-full w-1/2"/>
                <div className="h-3 bg-gray-100 rounded-full w-1/3"/>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && suggestions.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-bold text-gray-400">{suggestions.length} suggestion{suggestions.length > 1 ? 's' : ''}</p>
          {suggestions.map(book => {
            const cover = getBestCover(book.imageLinks)
            const year = extractYear(book.publishedDate)
            const alreadyInWishlist = myWishlistTitles.has(book.title.toLowerCase())

            return (
              <div key={book.id} className="card flex items-center gap-3 p-3">
                {cover
                  ? <Image src={cover} alt={book.title} width={48} height={64} className="rounded-xl object-cover flex-shrink-0 shadow-sm"/>
                  : <div className="w-12 h-16 rounded-xl bg-gradient-to-br from-violet to-pink flex items-center justify-center text-2xl flex-shrink-0">📖</div>
                }
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm text-ink line-clamp-2 leading-snug">{book.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{book.authors.join(', ')}</p>
                  <div className="flex gap-1.5 mt-1.5 flex-wrap items-center">
                    {year && <span className="text-[11px] bg-amber-light text-amber-dark font-bold px-2 py-0.5 rounded-full">{year}</span>}
                    {book.pageCount && <span className="text-[11px] text-gray-400">{book.pageCount}p</span>}
                    {book.reason && (
                      <span className="text-[11px] bg-violet-light text-violet font-bold px-2 py-0.5 rounded-full">
                        ✨ {book.reason}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => !alreadyInWishlist && addToWishlist(book)}
                  disabled={alreadyInWishlist}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                    alreadyInWishlist
                      ? 'bg-mint-light text-mint-dark cursor-default'
                      : 'bg-pink-light text-pink hover:bg-pink hover:text-white'
                  }`}
                  title={alreadyInWishlist ? 'Déjà dans tes souhaits' : 'Ajouter aux souhaits'}>
                  {alreadyInWishlist ? '✓' : '♥'}
                </button>
              </div>
            )
          })}

          <button onClick={mode === 'auto' ? loadAutoSuggestions : loadManualSuggestions}
            disabled={loading}
            className="w-full py-3 rounded-2xl bg-gray-50 hover:bg-gray-100 font-black text-sm text-gray-500 transition-colors flex items-center justify-center gap-2">
            <RefreshCw size={14}/> Rafraîchir
          </button>
        </div>
      )}

      {!loading && suggestions.length === 0 && (mode === 'auto' ? topGenres.length > 0 : true) && (
        <div className="card p-10 text-center">
          <div className="text-5xl mb-3 animate-float inline-block">🔭</div>
          <p className="font-black text-lg text-ink">Prêt à découvrir ?</p>
          <p className="text-sm text-gray-400 mt-1">
            {mode === 'auto'
              ? 'Clique sur "Générer des suggestions" !'
              : 'Renseigne un genre ou un auteur et lance la recherche'}
          </p>
        </div>
      )}
    </div>
  )
}

export default function DiscoverPage() {
  return <ToastProvider><AppLayout><DiscoverContent/></AppLayout></ToastProvider>
}
