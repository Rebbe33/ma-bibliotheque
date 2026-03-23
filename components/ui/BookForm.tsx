'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { GoogleBook, Book, BookStatus } from '@/types'
import { extractYear, getBestCover, getISBN } from '@/lib/google-books'
import { createClient } from '@/lib/supabase'
import BookSearch from './BookSearch'
import { Search, ChevronDown } from 'lucide-react'

interface Props {
  initial?: Partial<Book>
  onSave: (data: Partial<Book>) => Promise<void>
  onCancel: () => void
  onAddToWishlist?: (book: GoogleBook) => void
}

const STATUSES: BookStatus[] = ['À lire', 'En cours', 'Lu', 'Abandonné', 'À acquérir']
const STATUS_EMOJI: Record<BookStatus, string> = {
  'À lire': '📋', 'En cours': '📖', 'Lu': '✅', 'Abandonné': '💀', 'À acquérir': '🛒'
}
const STATUS_COLORS: Record<BookStatus, string> = {
  'À lire': 'bg-blue-50 text-blue-700 ring-blue-200',
  'En cours': 'bg-amber-light text-amber-dark ring-amber-200',
  'Lu': 'bg-mint-light text-mint-dark ring-green-200',
  'Abandonné': 'bg-red-50 text-red-700 ring-red-200',
  'À acquérir': 'bg-coral-light text-coral-dark ring-coral-200',
}

export default function BookForm({ initial = {}, onSave, onCancel, onAddToWishlist }: Props) {
  const supabase = createClient()
  const [step, setStep] = useState<'search' | 'form'>(initial.title ? 'form' : 'search')
  const [saving, setSaving] = useState(false)
  const [existingSeries, setExistingSeries] = useState<string[]>([])
  const [seriesMode, setSeriesMode] = useState<'existing' | 'new'>(
    initial.series_name ? 'existing' : 'new'
  )
  const [form, setForm] = useState({
    title: initial.title || '',
    author: initial.author || '',
    genre: initial.genre || '',
    year: initial.year?.toString() || '',
    pages: initial.pages?.toString() || '',
    publisher: initial.publisher || '',
    isbn: initial.isbn || '',
    series_name: initial.series_name || '',
    series_number: initial.series_number?.toString() || '',
    cover_url: initial.cover_url || '',
    status: (initial.status || 'À lire') as BookStatus,
    rating: initial.rating || 0,
    notes: initial.notes || '',
    google_books_id: initial.google_books_id || '',
  })

  useEffect(() => {
    async function loadSeries() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('bibliotheque_books')
        .select('series_name')
        .eq('user_id', user.id)
        .not('series_name', 'is', null)
      const names = Array.from(new Set((data || []).map((b: any) => b.series_name as string))).sort()
      setExistingSeries(names)
      if (names.length > 0 && !initial.series_name) setSeriesMode('existing')
    }
    loadSeries()
  }, [])

  function set(field: string, value: string | number) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function fromGoogle(book: GoogleBook) {
    setForm({
      title: book.title,
      author: book.authors.join(', '),
      genre: book.categories?.[0] || '',
      year: extractYear(book.publishedDate)?.toString() || '',
      pages: book.pageCount?.toString() || '',
      publisher: book.publisher || '',
      isbn: getISBN(book.industryIdentifiers) || '',
      series_name: book.seriesInfo?.shortSeriesBookTitle || '',
      series_number: book.seriesInfo?.bookDisplayNumber || '',
      cover_url: getBestCover(book.imageLinks) || '',
      status: 'À lire',
      rating: 0,
      notes: '',
      google_books_id: book.id,
    })
    setStep('form')
  }

async function handleSave() {
  if (!form.title.trim() || !form.author.trim()) return
  setSaving(true)

  const bookData = {
    title: form.title.trim(),
    author: form.author.trim(),
    genre: form.genre.trim() || undefined,
    year: form.year ? parseInt(form.year) : undefined,
    pages: form.pages ? parseInt(form.pages) : undefined,
    publisher: form.publisher.trim() || undefined,
    isbn: form.isbn.trim() || undefined,
    series_name: form.series_name.trim() || undefined,
    series_number: form.series_number ? parseFloat(form.series_number) : undefined,
    cover_url: form.cover_url.trim() || undefined,
    status: form.status,
    rating: form.rating,
    notes: form.notes.trim() || undefined,
    google_books_id: form.google_books_id || undefined,
  }

  // Sauvegarder dans la bibliothèque dans tous les cas
  await onSave(bookData)

  // Si "À acquérir" → aussi ajouter à la wishlist
  if (form.status === 'À acquérir' && onAddToWishlist) {
    const fakeGoogleBook = {
      id: form.google_books_id || '',
      title: form.title.trim(),
      authors: [form.author.trim()],
      publishedDate: form.year || '',
      imageLinks: form.cover_url ? { thumbnail: form.cover_url } : undefined,
    } as any
    await onAddToWishlist(fakeGoogleBook)
  }

  setSaving(false)
}

  if (step === 'search') return (
    <div>
      <BookSearch onSelect={fromGoogle} onManual={() => setStep('form')} onAddToWishlist={onAddToWishlist} />
      <button onClick={onCancel} className="mt-2 btn btn-ghost w-full">Annuler</button>
    </div>
  )

  return (
    <div className="space-y-4 pb-2">
      {/* Cover + re-search */}
      <div className="flex items-start gap-4">
        {form.cover_url
          ? <div className="relative flex-shrink-0">
              <Image src={form.cover_url} alt={form.title} width={72} height={100} className="rounded-2xl object-cover shadow-card" />
              <button onClick={() => setStep('search')}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-violet text-white flex items-center justify-center text-xs shadow">✕</button>
            </div>
          : <button onClick={() => setStep('search')}
              className="w-[72px] h-[100px] rounded-2xl bg-violet-light flex flex-col items-center justify-center gap-1 text-violet hover:bg-violet/20 transition-colors flex-shrink-0">
              <Search size={20} />
              <span className="text-[10px] font-bold">Chercher</span>
            </button>
        }
        <div className="flex-1 space-y-2">
          <div>
            <label className="block text-xs font-black text-gray-500 mb-1">TITRE *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} className="input" placeholder="Le nom du livre" />
          </div>
          <div>
            <label className="block text-xs font-black text-gray-500 mb-1">AUTEUR *</label>
            <input value={form.author} onChange={e => set('author', e.target.value)} className="input" placeholder="Auteur" />
          </div>
        </div>
      </div>

      {/* Status selector */}
      <div>
        <label className="block text-xs font-black text-gray-500 mb-2">STATUT</label>
        <div className="flex gap-2 flex-wrap">
          {STATUSES.map(s => (
            <button key={s} onClick={() => set('status', s)}
              className={`px-3 py-1.5 rounded-pill text-xs font-black ring-2 ring-transparent transition-all ${
                form.status === s ? STATUS_COLORS[s] + ' ring-offset-1' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}>
              {STATUS_EMOJI[s]} {s}
            </button>
          ))}
        </div>
      </div>

      {/* Rating */}
      <div>
        <label className="block text-xs font-black text-gray-500 mb-2">NOTE</label>
        <div className="flex gap-1">
          {[1,2,3,4,5].map(n => (
            <button key={n} onClick={() => set('rating', form.rating === n ? 0 : n)}
              className={`text-2xl transition-all hover:scale-125 ${n <= form.rating ? '' : 'opacity-25'}`}>⭐</button>
          ))}
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { field:'genre',     label:'Genre',   placeholder:'Roman, BD…' },
          { field:'year',      label:'Année',   placeholder:'2023', type:'number' },
          { field:'pages',     label:'Pages',   placeholder:'320',  type:'number' },
          { field:'publisher', label:'Éditeur', placeholder:'Gallimard' },
        ].map(({ field, label, placeholder, type }) => (
          <div key={field}>
            <label className="block text-xs font-black text-gray-500 mb-1">{label.toUpperCase()}</label>
            <input type={type || 'text'} value={(form as any)[field]} onChange={e => set(field, e.target.value)}
              className="input text-sm" placeholder={placeholder} />
          </div>
        ))}
        <div className="col-span-2">
          <label className="block text-xs font-black text-gray-500 mb-1">ISBN</label>
          <input value={form.isbn} onChange={e => set('isbn', e.target.value)} className="input text-sm" placeholder="978-2-07-036024-5" />
        </div>
      </div>

      {/* Série */}
<div>
  <label className="block text-xs font-black text-gray-500 mb-2">SÉRIE</label>
  {existingSeries.length > 0 && (
    <div className="flex p-1 bg-gray-100 rounded-2xl mb-2">
      <button onClick={() => setSeriesMode('existing')}
        className={`flex-1 py-1.5 rounded-xl font-black text-xs transition-all ${
          seriesMode === 'existing' ? 'bg-white text-violet shadow-sm' : 'text-gray-400'
        }`}>
        Série existante
      </button>
      <button onClick={() => { setSeriesMode('new'); set('series_name', '') }}
        className={`flex-1 py-1.5 rounded-xl font-black text-xs transition-all ${
          seriesMode === 'new' ? 'bg-white text-violet shadow-sm' : 'text-gray-400'
        }`}>
        Nouvelle série
      </button>
    </div>
  )}
  <div className="grid grid-cols-[1fr_80px] gap-2">
    {seriesMode === 'existing' && existingSeries.length > 0 ? (
      <div className="relative">
        <select value={form.series_name} onChange={e => set('series_name', e.target.value)}
          className="input text-sm appearance-none pr-8 w-full">
          <option value="">— Aucune —</option>
          {existingSeries.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
      </div>
    ) : (
      <input value={form.series_name} onChange={e => set('series_name', e.target.value)}
        className="input text-sm" placeholder="Nom de la série" />
    )}
    <input
      type="number"
      value={form.series_number}
      onChange={e => set('series_number', e.target.value)}
      className="input text-sm text-center"
      placeholder="N°"
      min="0"
      max="99"
    />
  </div>
</div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-black text-gray-500 mb-1">NOTES PERSONNELLES</label>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
          className="input resize-none text-sm" placeholder="Vos impressions, citations préférées…" />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button onClick={onCancel} className="btn btn-secondary flex-1">Annuler</button>
        <button onClick={handleSave} disabled={!form.title.trim() || !form.author.trim() || saving}
          className="btn btn-primary flex-[2] py-3 disabled:opacity-50">
          {saving ? '⏳ Sauvegarde…' : '💾 Enregistrer'}
        </button>
      </div>
    </div>
  )
}
