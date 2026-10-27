'use client'
import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Book, BookStatus, GoogleBook } from '@/types'
import { Search, X, Star } from 'lucide-react'
import { getBestCover, extractYear, getISBN } from '@/lib/google-books'

const STATUSES: BookStatus[] = ['À lire', 'En cours', 'Lu', 'Abandonné', 'Prêté', 'À acquérir']

const STATUS_EMOJI: Record<BookStatus, string> = {
  'À lire':     '📋',
  'En cours':   '📖',
  'Lu':         '✅',
  'Abandonné':  '💀',
  'Prêté':      '🤝',
  'À acquérir': '🛒',
}

const STATUS_COLORS: Record<BookStatus, string> = {
  'À lire':     'bg-blue-50 text-blue-700 ring-blue-200',
  'En cours':   'bg-amber-light text-amber-dark ring-amber-200',
  'Lu':         'bg-mint-light text-mint-dark ring-green-200',
  'Abandonné':  'bg-red-50 text-red-700 ring-red-200',
  'Prêté':      'bg-violet-light text-violet ring-violet/30',
  'À acquérir': 'bg-orange-50 text-orange-700 ring-orange-200',
}

interface Props {
  initial?: Partial<Book>
  onSave: (data: Partial<Book>) => void
  onCancel: () => void
  onAddToWishlist?: (book: GoogleBook) => void
}

export default function BookForm({ initial, onSave, onCancel, onAddToWishlist }: Props) {
  const [tab, setTab] = useState<'search' | 'manual'>(initial ? 'manual' : 'search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GoogleBook[]>([])
  const [searching, setSearching] = useState(false)
  const [form, setForm] = useState({
    title:         initial?.title         || '',
    author:        initial?.author        || '',
    nationality:    (initial as any)?.nationality    || '',
    date_finished:  (initial as any)?.date_finished  || '',
    physical_status:(initial as any)?.physical_status || '',
    return_date:    (initial as any)?.return_date    || '',
    genre:          initial?.genre         || '',
    year:          initial?.year          ? String(initial.year) : '',
    pages:         initial?.pages         ? String(initial.pages) : '',
    publisher:     initial?.publisher     || '',
    isbn:          initial?.isbn          || '',
    series_name:   initial?.series_name   || '',
    series_number: initial?.series_number ? String(initial.series_number) : '',
    cover_url:     initial?.cover_url     || '',
    status:        (initial?.status       || 'À lire') as BookStatus,
    rating:        initial?.rating        || 0,
    notes:         initial?.notes         || '',
    google_books_id: initial?.google_books_id || '',
    borrower_name: (initial as any)?.borrower_name || '',
  })

  const [seriesSuggestions, setSeriesSuggestions] = useState<string[]>([])
  const seriesRef = useRef<HTMLDivElement>(null)

  // Charger les suggestions de séries existantes
  useEffect(() => {
    async function loadSeries() {
      try {
        const { createClient } = await import('@/lib/supabase')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase
          .from('bibliotheque_books')
          .select('series_name')
          .eq('user_id', user.id)
          .not('series_name', 'is', null)
        if (data) {
          const names = Array.from(new Set(data.map((d: any) => d.series_name).filter(Boolean))) as string[]
          setSeriesSuggestions(names)
        }
      } catch {}
    }
    loadSeries()
  }, [])

  async function doSearch() {
    if (!query.trim()) return
    setSearching(true); setResults([])
    try {
      const res = await fetch(`/api/books-search?q=${encodeURIComponent(query)}&lang=fr`)
      const data: GoogleBook[] = await res.json()
      setResults(data)
    } catch { setResults([]) }
    setSearching(false)
  }

  function fillFromGoogle(book: GoogleBook) {
    setForm(f => ({
      ...f,
      title:           book.title,
      author:          book.authors?.join(', ') || '',
      genre:           book.categories?.[0] || f.genre,
      year:            extractYear(book.publishedDate) ? String(extractYear(book.publishedDate)) : f.year,
      pages:           book.pageCount ? String(book.pageCount) : f.pages,
      publisher:       book.publisher || f.publisher,
      isbn:            getISBN(book.industryIdentifiers) || f.isbn,
      cover_url:       getBestCover(book.imageLinks) || f.cover_url,
      google_books_id: book.id,
    }))
    setTab('manual')
  }

  function handleSave() {
    if (!form.title.trim()) return
    const data: Partial<Book> = {
      title:           form.title.trim(),
      author:          form.author.trim(),
      genre:           form.genre || undefined,
      year:            form.year ? parseInt(form.year) : undefined,
      pages:           form.pages ? parseInt(form.pages) : undefined,
      publisher:       form.publisher || undefined,
      isbn:            form.isbn || undefined,
      series_name:     form.series_name || undefined,
      series_number:   form.series_number ? parseFloat(form.series_number) : undefined,
      cover_url:       form.cover_url || undefined,
      status:          form.status,
      rating:          form.rating,
      notes:           form.notes || undefined,
      google_books_id: form.google_books_id || undefined,
      borrower_name:   form.status === 'Prêté' ? (form.borrower_name || undefined) : undefined,
      ...(form.nationality ? { nationality: form.nationality } : {}),
      ...(form.status === 'Lu' && form.date_finished ? { date_finished: form.date_finished } : { date_finished: null }),
    } as any

    ;(data as any).physical_status = form.physical_status || null
    ;(data as any).return_date = form.physical_status === 'Emprunté biblio' && form.return_date ? form.return_date : null
    onSave(data)
  }

  const filteredSeries = form.series_name
    ? seriesSuggestions.filter(s => s.toLowerCase().includes(form.series_name.toLowerCase()) && s !== form.series_name)
    : []

  return (
    <div className="space-y-4 pb-2">
      {/* Tabs */}
      {!initial && (
        <div className="flex p-1 bg-gray-100 rounded-2xl">
          {(['search', 'manual'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-xl font-black text-sm transition-all ${tab === t ? 'bg-white text-violet shadow-sm' : 'text-gray-400'}`}>
              {t === 'search' ? '🔍 Rechercher' : '✏️ Manuel'}
            </button>
          ))}
        </div>
      )}

      {/* Search tab */}
      {tab === 'search' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
              <input value={query} onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSearch()}
                placeholder="Titre, auteur, ISBN…"
                style={{ paddingLeft: '2.25rem' }}
                className="input text-sm py-2.5" />
            </div>
            <button onClick={doSearch} disabled={!query.trim() || searching}
              className="btn btn-primary px-4 py-2.5 disabled:opacity-50 flex-shrink-0">
              {searching ? '⏳' : <Search size={16} />}
            </button>
          </div>

          {searching && (
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

          {!searching && results.length > 0 && (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {results.map(book => {
                const cover = getBestCover(book.imageLinks)
                const year = extractYear(book.publishedDate)
                return (
                  <div key={book.id} className="flex items-center gap-3 p-2.5 rounded-2xl bg-gray-50 hover:bg-violet-light transition-colors">
                    {cover
                      ? <Image src={cover} alt={book.title} width={36} height={50} className="rounded-lg object-cover flex-shrink-0" />
                      : <div className="w-9 h-[50px] rounded-lg bg-gray-200 flex items-center justify-center text-base flex-shrink-0">📖</div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs text-ink line-clamp-3 leading-snug">{book.title}</p>
                      <p className="text-[11px] text-gray-500">{book.authors?.join(', ')}</p>
                      {year && <p className="text-[11px] text-gray-400">{year}{book.pageCount ? ` · ${book.pageCount}p` : ''}</p>}
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <button onClick={() => fillFromGoogle(book)}
                        className="px-3 py-1.5 rounded-xl bg-violet text-white text-xs font-black hover:bg-violet-dark transition-colors">
                        + Ajouter
                      </button>
                      {onAddToWishlist && (
                        <button onClick={() => onAddToWishlist(book)}
                          className="px-3 py-1.5 rounded-xl bg-pink-light text-pink text-xs font-black hover:bg-pink hover:text-white transition-colors">
                          ♥ Souhait
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <button onClick={() => setTab('manual')} className="btn btn-ghost w-full text-gray-400 text-sm">
            ✏️ Saisie manuelle
          </button>
        </div>
      )}

      {/* Manual tab */}
      {tab === 'manual' && (
        <div className="space-y-3">
          {/* Cover preview */}
          {form.cover_url && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
              <Image src={form.cover_url} alt="Cover" width={48} height={68} className="rounded-xl object-cover shadow-sm" />
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm text-ink line-clamp-2 leading-snug">{form.title || 'Sans titre'}</p>
                <p className="text-xs text-gray-500">{form.author || 'Auteur inconnu'}</p>
              </div>
              <button onClick={() => setForm(f => ({ ...f, cover_url: '' }))}
                className="w-7 h-7 rounded-xl bg-red-50 text-red-400 flex items-center justify-center">
                <X size={13} />
              </button>
            </div>
          )}

          {/* Titre + Auteur + Nationalité */}
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-black text-gray-500 mb-1">TITRE *</label>
              <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
                placeholder="Titre du livre" className="input" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-black text-gray-500 mb-1">AUTEUR</label>
                <input value={form.author} onChange={e => setForm(f => ({...f, author: e.target.value}))}
                  placeholder="Nom de l'auteur" className="input text-sm" />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-500 mb-1">NATIONALITÉ</label>
                <input value={form.nationality} onChange={e => setForm(f => ({...f, nationality: e.target.value}))}
                  placeholder="Française, US…" className="input text-sm" />
              </div>
            </div>
          </div>

          {/* Statut */}
          <div>
            <label className="block text-xs font-black text-gray-500 mb-1.5">STATUT</label>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map(s => (
                <button key={s} onClick={() => setForm(f => ({
                  ...f,
                  status: s,
                  date_finished: s === 'Lu' && !f.date_finished
                    ? new Date().toISOString().split('T')[0]
                    : f.date_finished,
                }))}
                  className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all ring-2 ${
                    form.status === s
                      ? `${STATUS_COLORS[s]} ring-current`
                      : 'bg-gray-50 text-gray-500 ring-transparent hover:ring-gray-200'
                  }`}>
                  {STATUS_EMOJI[s]} {s}
                </button>
              ))}
            </div>
          </div>

          {/* Champ emprunteur — visible uniquement si statut = Prêté */}
          {form.status === 'Prêté' && (
            <div>
              <label className="block text-xs font-black text-gray-500 mb-1">PRÊTÉ À</label>
              <input value={form.borrower_name}
                onChange={e => setForm(f => ({...f, borrower_name: e.target.value}))}
                placeholder="Nom de la personne…"
                className="input" />
            </div>
          )}

          {/* Date de fin — visible uniquement si statut = Lu */}
          {form.status === 'Lu' && (
            <div>
              <label className="block text-xs font-black text-gray-500 mb-1">DATE DE LECTURE TERMINÉE</label>
              <input type="date" value={form.date_finished}
                onChange={e => setForm(f => ({...f, date_finished: e.target.value}))}
                className="input text-sm" />
            </div>
          )}

          {/* Possession physique */}
          <div>
            <label className="block text-xs font-black text-gray-500 mb-1.5">POSSESSION PHYSIQUE</label>
            <div className="flex flex-wrap gap-1.5">
              {([
                ['Possédé',         '🏠'],
                ['Emprunté biblio', '🔄'],
                ['À acheter',       '🛍️'],
                ['À vendre/donner', '📤'],
              ] as const).map(([s, emoji]) => (
                <button key={s}
                  onClick={() => setForm(f => ({
                    ...f,
                    physical_status: f.physical_status === s ? '' : s,
                    return_date: f.physical_status === s ? '' : (s !== 'Emprunté biblio' ? '' : f.return_date),
                  }))}
                  className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all ring-2 ${
                    form.physical_status === s
                      ? 'bg-violet text-white ring-violet'
                      : 'bg-gray-50 text-gray-500 ring-transparent hover:ring-gray-200'
                  }`}>
                  {emoji} {s}
                </button>
              ))}
            </div>
          </div>

          {/* Date de retour — visible uniquement si Emprunté biblio */}
          {form.physical_status === 'Emprunté biblio' && (
            <div>
              <label className="block text-xs font-black text-gray-500 mb-1">DATE DE RETOUR</label>
              <input type="date" value={form.return_date}
                onChange={e => setForm(f => ({...f, return_date: e.target.value}))}
                className="input text-sm" />
            </div>
          )}

          {/* Note */}
          <div>
            <label className="block text-xs font-black text-gray-500 mb-1.5">NOTE</label>
            <div className="flex gap-2">
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setForm(f => ({...f, rating: f.rating === n ? 0 : n}))}
                  className={`text-2xl transition-all hover:scale-125 ${n <= form.rating ? '' : 'opacity-25'}`}>
                  ⭐
                </button>
              ))}
            </div>
          </div>

          {/* Série */}
          <div ref={seriesRef} className="relative">
            <label className="block text-xs font-black text-gray-500 mb-1">SÉRIE</label>
            <div className="flex gap-2">
              <input value={form.series_name}
                onChange={e => setForm(f => ({...f, series_name: e.target.value}))}
                placeholder="Nom de la série"
                className="input flex-1" />
              <input value={form.series_number}
                onChange={e => setForm(f => ({...f, series_number: e.target.value}))}
                type="number" placeholder="N°" min="0" max="99"
                className="input w-16 text-center" />
            </div>
            {filteredSeries.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white rounded-2xl shadow-float border border-gray-100 overflow-hidden">
                {filteredSeries.slice(0, 5).map(s => (
                  <button key={s} onClick={() => setForm(f => ({...f, series_name: s}))}
                    className="w-full text-left px-4 py-2.5 text-sm font-bold hover:bg-violet-light hover:text-violet transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Genre + Année */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-black text-gray-500 mb-1">GENRE</label>
              <input value={form.genre} onChange={e => setForm(f => ({...f, genre: e.target.value}))}
                placeholder="Roman, SF, Manga…" className="input text-sm" />
            </div>
            <div>
              <label className="block text-xs font-black text-gray-500 mb-1">ANNÉE</label>
              <input value={form.year} onChange={e => setForm(f => ({...f, year: e.target.value}))}
                type="number" placeholder="2024" className="input text-sm" />
            </div>
          </div>

          {/* Pages + Éditeur */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-black text-gray-500 mb-1">PAGES</label>
              <input value={form.pages} onChange={e => setForm(f => ({...f, pages: e.target.value}))}
                type="number" placeholder="320" className="input text-sm" />
            </div>
            <div>
              <label className="block text-xs font-black text-gray-500 mb-1">ÉDITEUR</label>
              <input value={form.publisher} onChange={e => setForm(f => ({...f, publisher: e.target.value}))}
                placeholder="Gallimard…" className="input text-sm" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-black text-gray-500 mb-1">NOTES PERSO</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))}
              placeholder="Tes impressions, citations…" rows={3}
              className="input resize-none text-sm" />
          </div>

          {/* URL couverture manuelle */}
          {!form.cover_url && (
            <div>
              <label className="block text-xs font-black text-gray-500 mb-1">URL COUVERTURE</label>
              <input value={form.cover_url} onChange={e => setForm(f => ({...f, cover_url: e.target.value}))}
                placeholder="https://…" className="input text-sm" />
            </div>
          )}

          {/* Boutons */}
          <div className="flex gap-2 pt-1">
            <button onClick={onCancel} className="btn btn-ghost flex-1">Annuler</button>
            <button onClick={handleSave} disabled={!form.title.trim()}
              className="btn btn-primary flex-[2] py-3 disabled:opacity-50">
              {initial ? '✓ Enregistrer' : '+ Ajouter'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
