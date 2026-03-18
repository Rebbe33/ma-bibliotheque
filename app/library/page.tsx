'use client'
import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'
import { Book, BookStatus, GoogleBook } from '@/types'
import AppLayout from '@/components/layout/AppLayout'
import BottomSheet from '@/components/ui/BottomSheet'
import BookForm from '@/components/ui/BookForm'
import BookCard from '@/components/ui/BookCard'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { Search, X, Plus, SlidersHorizontal } from 'lucide-react'
import { getBestCover, extractYear } from '@/lib/google-books'

const STATUSES: BookStatus[] = ['À lire', 'En cours', 'Lu', 'Abandonné', 'À acquérir']
const STATUS_EMOJI: Record<BookStatus, string> = {
  'À lire':'📋', 'En cours':'📖', 'Lu':'✅', 'Abandonné':'💀', 'À acquérir':'🛒'
}
const STATUS_BG: Record<BookStatus, string> = {
  'Lu': 'bg-mint-light text-mint-dark',
  'En cours': 'bg-amber-light text-amber-dark',
  'À lire': 'bg-cyan-light text-cyan-dark',
  'Abandonné': 'bg-red-50 text-red-600',
  'À acquérir': 'bg-coral-light text-coral-dark',
}

function LibraryContent() {
  const supabase = createClient()
  const toast = useToast()

  const [books, setBooks] = useState<Book[]>([])
  const [allBooks, setAllBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<BookStatus | ''>('')
  const [sortBy, setSortBy] = useState<'date_added'|'title'|'author'|'rating'>('date_added')
  const [showFilters, setShowFilters] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [editBook, setEditBook] = useState<Book | null>(null)
  const [detailBook, setDetailBook] = useState<Book | null>(null)

  const loadBooks = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: all } = await supabase.from('bibliotheque_books').select('*').eq('user_id', user.id)
    setAllBooks(all || [])
    let q = supabase.from('bibliotheque_books').select('*').eq('user_id', user.id)
    if (statusFilter) q = q.eq('status', statusFilter)
    if (sortBy === 'rating') q = q.order('rating', { ascending: false })
    else if (sortBy === 'title') q = q.order('title')
    else if (sortBy === 'author') q = q.order('author')
    else q = q.order('date_added', { ascending: false })
    const { data } = await q
    setBooks(data || [])
    setLoading(false)
  }, [statusFilter, sortBy])

  useEffect(() => { loadBooks() }, [loadBooks])

  // Recherche floue — contient le mot, pas besoin du titre exact
  const filtered = books.filter(b => {
  if (!query) return true
  const q = query.toLowerCase()
  // Normaliser : enlever les zéros devant les chiffres (T01 → t1, 01 → 1)
  const normalize = (s: string) => s.toLowerCase().replace(/0+(\d)/g, '$1')
  const nq = normalize(q)
  return [b.title, b.author, b.genre || '', b.series_name || ''].some(s =>
    normalize(s).includes(nq) || s.toLowerCase().includes(q)
  )
})

  const counts = STATUSES.reduce((a, s) => ({ ...a, [s]: allBooks.filter(b => b.status === s).length }), {} as Record<BookStatus,number>)

  async function addBook(data: Partial<Book>) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('bibliotheque_books').insert({ ...data, user_id: user.id })
    if (error) { toast('Erreur lors de l\'ajout', 'error'); return }
    toast('Livre ajouté ! 📚', 'success')
    setShowAdd(false); loadBooks()
  }

  async function addToWishlist(googleBook: GoogleBook) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('bibliotheque_wishlist').insert({
      user_id: user.id,
      title: googleBook.title,
      author: googleBook.authors.join(', '),
      cover_url: getBestCover(googleBook.imageLinks),
      google_books_id: googleBook.id,
      year: extractYear(googleBook.publishedDate),
      priority: 'Moyenne',
    })
    toast('Ajouté à tes souhaits ✨', 'success')
    setShowAdd(false)
  }

async function updateBook(id: string, data: Partial<Book>) {
  if (data.status === 'À acquérir') {
    const book = allBooks.find(b => b.id === id)
    if (book) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Vérifier si déjà dans la wishlist
        const { data: existing } = await supabase
          .from('bibliotheque_wishlist')
          .select('id')
          .eq('user_id', user.id)
          .eq('title', book.title)
          .maybeSingle()

        if (existing) {
          toast('Déjà dans tes souhaits !', 'info')
        } else {
          await supabase.from('bibliotheque_wishlist').insert({
            user_id: user.id,
            title: book.title,
            author: book.author,
            cover_url: book.cover_url,
            google_books_id: book.google_books_id,
            year: book.year,
            priority: 'Haute',
            notes: book.notes,
          })
          toast('Ajouté à tes souhaits ! 🛒', 'success')
        }
        // Mettre à jour le statut sans supprimer le livre
        await supabase.from('bibliotheque_books').update({ status: 'À acquérir' }).eq('id', id)
        setEditBook(null); loadBooks()
        return
      }
    }
  }
  const { error } = await supabase.from('bibliotheque_books').update(data).eq('id', id)
  if (error) { toast('Erreur', 'error'); return }
  toast('Mis à jour !', 'success')
  setEditBook(null); loadBooks()
}

  async function deleteBook(id: string) {
    if (!confirm('Supprimer ce livre ?')) return
    await supabase.from('bibliotheque_books').delete().eq('id', id)
    toast('Supprimé', 'info'); loadBooks()
  }

  async function markRead(id: string) {
    await supabase.from('bibliotheque_books').update({ status: 'Lu' }).eq('id', id)
    toast('Marqué comme lu ✅', 'success'); loadBooks()
  }

  return (
    <div className="space-y-4">

      {/* Status pills — padding vertical pour que les chips ne soient pas rognées */}
      <div className="-mt-2 flex gap-2 overflow-x-auto py-1 -mx-4 px-4 scrollbar-hide">
        <button onClick={() => setStatusFilter('')}
          className={`flex-shrink-0 px-4 py-2 rounded-pill font-black text-sm transition-all ${
            statusFilter === '' ? 'bg-violet text-white shadow-glow' : 'bg-white text-gray-500 shadow-sm hover:shadow-card'
          }`}>
          Tous · {allBooks.length}
        </button>
        {STATUSES.map(s => (
          <button key={s} onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
            className={`flex-shrink-0 px-4 py-2 rounded-pill font-black text-sm transition-all whitespace-nowrap ${
              statusFilter === s ? `${STATUS_BG[s]} shadow-card ring-2 ring-offset-1 ring-current` : 'bg-white text-gray-500 shadow-sm hover:shadow-card'
            }`}>
            {STATUS_EMOJI[s]} {s} · {counts[s] || 0}
          </button>
        ))}
      </div>

      {/* Search row — style inline pour éviter que l'icône chevauche le texte */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher un livre…"
            style={{ paddingLeft: '2.25rem' }}
            className="input pr-9 py-2.5 text-sm"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X size={15} className="text-gray-400" />
            </button>
          )}
        </div>
        <button onClick={() => setShowFilters(true)}
          className="w-11 h-11 rounded-2xl bg-white shadow-sm flex items-center justify-center hover:shadow-card transition-all text-gray-500 hover:text-violet flex-shrink-0">
          <SlidersHorizontal size={18} />
        </button>
      </div>

      {(query || statusFilter) && (
        <p className="text-xs font-bold text-gray-400">
          {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
          {statusFilter ? ` · ${statusFilter}` : ''}
        </p>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="card flex gap-3 p-3.5 animate-pulse">
              <div className="w-[52px] h-[72px] rounded-xl bg-gray-100 flex-shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-4 bg-gray-100 rounded-full w-3/4" />
                <div className="h-3 bg-gray-100 rounded-full w-1/2" />
                <div className="h-6 bg-gray-100 rounded-full w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-5xl mb-3 animate-float inline-block">{allBooks.length === 0 ? '📚' : '🔍'}</div>
          <p className="font-black text-lg text-ink">{allBooks.length === 0 ? 'Bibliothèque vide !' : 'Aucun résultat'}</p>
          <p className="text-sm text-gray-400 mt-1">{allBooks.length === 0 ? 'Ajoutez votre premier livre ✨' : 'Essayez un autre terme'}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(book => (
            <BookCard key={book.id} book={book}
              onClick={() => setDetailBook(book)}
              onEdit={e => { e.stopPropagation(); setEditBook(book) }}
              onDelete={e => { e.stopPropagation(); deleteBook(book.id) }}
              onMarkRead={e => { e.stopPropagation(); markRead(book.id) }}
            />
          ))}
        </div>
      )}

      <button onClick={() => setShowAdd(true)}
        className="fixed bottom-20 right-4 z-30 w-14 h-14 rounded-full bg-gradient-to-br from-violet to-pink text-white shadow-glow flex items-center justify-center hover:scale-110 active:scale-95 transition-transform">
        <Plus size={28} />
      </button>

      <BottomSheet open={showAdd} onClose={() => setShowAdd(false)} title="Ajouter un livre">
        <BookForm onSave={addBook} onCancel={() => setShowAdd(false)} onAddToWishlist={addToWishlist} />
      </BottomSheet>

      <BottomSheet open={!!editBook} onClose={() => setEditBook(null)} title="Modifier">
        {editBook && <BookForm initial={editBook} onSave={d => updateBook(editBook.id, d)} onCancel={() => setEditBook(null)} />}
      </BottomSheet>

      <BottomSheet open={!!detailBook} onClose={() => setDetailBook(null)}>
        {detailBook && <BookDetail book={detailBook} onEdit={() => { setEditBook(detailBook); setDetailBook(null) }} />}
      </BottomSheet>

      <BottomSheet open={showFilters} onClose={() => setShowFilters(false)} title="Trier par">
        <div className="space-y-2 pb-2">
          {([['date_added','📅 Plus récent'],['title','🔤 Titre'],['author','👤 Auteur'],['rating','⭐ Note']] as const).map(([v, label]) => (
            <button key={v} onClick={() => { setSortBy(v); setShowFilters(false) }}
              className={`w-full text-left px-4 py-3 rounded-2xl font-bold text-sm transition-colors ${
                sortBy === v ? 'bg-violet-light text-violet' : 'bg-gray-50 hover:bg-gray-100'
              }`}>
              {label} {sortBy === v && '✓'}
            </button>
          ))}
        </div>
      </BottomSheet>
    </div>
  )
}

function BookDetail({ book, onEdit }: { book: Book; onEdit: () => void }) {
  function coverIdx(t: string) { let h=0; for(const c of t)h=(h*31+c.charCodeAt(0))&0xfffffff; return h%8 }
  const STATUS_CHIP: Record<BookStatus, string> = { 'Lu':'chip chip-lu','En cours':'chip chip-en','À lire':'chip chip-al','Abandonné':'chip chip-ab','À acquérir':'chip chip-aq' }

  return (
    <div className="space-y-5 pb-4">
      <div className="flex gap-4 items-start">
        {book.cover_url
          ? <Image src={book.cover_url} alt={book.title} width={88} height={124} className="rounded-2xl object-cover shadow-float flex-shrink-0" />
          : <div className={`cover-${coverIdx(book.title)} w-22 h-[124px] rounded-2xl flex items-center justify-center text-4xl flex-shrink-0 shadow-float`} style={{width:88}}>📖</div>
        }
        <div className="flex-1 pt-1">
          <h2 className="font-black text-xl text-ink leading-tight">{book.title}</h2>
          <p className="text-gray-500 font-semibold mt-1">{book.author}</p>
          {book.series_name && (
            <span className="inline-block mt-2 text-xs font-bold text-violet bg-violet-light px-3 py-1 rounded-full">
              {book.series_name}{book.series_number ? ` #${book.series_number}` : ''}
            </span>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <span className={(STATUS_CHIP as any)[book.status]}>{book.status}</span>
            {book.rating > 0 && <span className="text-sm">{'⭐'.repeat(book.rating)}</span>}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[['Genre',book.genre],['Année',book.year],['Pages',book.pages&&`${book.pages} pages`],['Éditeur',book.publisher],['ISBN',book.isbn]].filter(([,v])=>v).map(([k,v])=>(
          <div key={k as string} className="bg-bg-base rounded-2xl p-3">
            <p className="text-[10px] font-black text-gray-400 uppercase">{k}</p>
            <p className="font-bold text-sm text-ink mt-0.5">{v}</p>
          </div>
        ))}
      </div>
      {book.notes && (
        <div className="bg-amber-light rounded-2xl p-4">
          <p className="text-[10px] font-black text-amber-dark uppercase mb-1.5">📝 Notes</p>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{book.notes}</p>
        </div>
      )}
      <button onClick={onEdit} className="btn btn-primary w-full py-3">✏️ Modifier</button>
    </div>
  )
}

export default function LibraryPage() {
  return <ToastProvider><AppLayout><LibraryContent /></AppLayout></ToastProvider>
}
