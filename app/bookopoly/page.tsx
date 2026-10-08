'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { CheckCircle2, Circle, BookOpen, Trophy, X } from 'lucide-react'

interface Book { id: string; title: string; author: string; cover_url?: string }
interface CompletedCase { case_id: string; book_id?: string; completed_at: string }

// Cases du plateau dans l'ordre (sens horaire depuis coin haut-gauche)
const CASES = [
  // Rangée du haut (gauche → droite)
  { id: 'book-sale', label: 'Book Sale!', emoji: '🛍️', color: 'bg-amber-light text-amber-dark', corner: true },
  { id: 'highest-ratings', label: 'Highest # of Ratings', emoji: '⭐', color: 'bg-blue-50 text-blue-700' },
  { id: 'surprise', label: '?', emoji: '❓', color: 'bg-purple-50 text-purple-700' },
  { id: 'highest-avg', label: 'Highest Avg Rating', emoji: '🏅', color: 'bg-yellow-50 text-yellow-700' },
  { id: 'shortest', label: 'Shortest Book', emoji: '📄', color: 'bg-green-50 text-green-700' },
  { id: 'travel-abroad', label: 'Travel Abroad', emoji: '✈️', color: 'bg-sky-50 text-sky-700' },
  { id: 'nature', label: 'Nature', emoji: '🌿', color: 'bg-emerald-50 text-emerald-700' },
  { id: 'society', label: 'Society', emoji: '🌍', color: 'bg-orange-50 text-orange-700' },
  { id: 'library-fine-top', label: 'Library Fine', emoji: '💰', color: 'bg-red-50 text-red-600' },
  { id: 'times-of-life', label: 'Times of Life', emoji: '⏳', color: 'bg-rose-50 text-rose-700' },
  // Coin haut-droit
  { id: 'go-to-book-ban', label: 'Go to Book Ban!', emoji: '🚫', color: 'bg-red-100 text-red-700', corner: true },
  // Rangée droite (haut → bas)
  { id: 'most-recent', label: 'Most Recently Added', emoji: '🆕', color: 'bg-cyan-50 text-cyan-700' },
  { id: 'longest-shelved', label: 'Longest Shelved', emoji: '📚', color: 'bg-indigo-50 text-indigo-700' },
  { id: 'partner-pick', label: 'Partner Pick', emoji: '💑', color: 'bg-pink-50 text-pink-700' },
  { id: 'longest', label: 'Longest Book', emoji: '📖', color: 'bg-violet-50 text-violet-700' },
  { id: 'travel-away', label: 'Travel Away', emoji: '🧳', color: 'bg-sky-50 text-sky-700' },
  { id: 'contemporary', label: 'Contemporary Fiction', emoji: '🏙️', color: 'bg-gray-50 text-gray-700' },
  { id: 'award-winner', label: 'Award Winner', emoji: '🏆', color: 'bg-amber-50 text-amber-700' },
  { id: 'classics', label: 'Classics', emoji: '🏛️', color: 'bg-stone-50 text-stone-700' },
  { id: 'fantasy-scifi', label: 'Fantasy or Sci-Fi', emoji: '🚀', color: 'bg-purple-50 text-purple-700' },
  // Coin bas-droit
  { id: 'book-ban', label: 'Book Ban!', emoji: '📵', color: 'bg-red-100 text-red-700', corner: true },
  // Rangée du bas (droite → gauche)
  { id: 'library-fine-bottom', label: 'Library Fine', emoji: '💰', color: 'bg-red-50 text-red-600' },
  { id: 'travel-afar', label: 'Travel Afar', emoji: '🌏', color: 'bg-sky-50 text-sky-700' },
  { id: 'relationships', label: 'Relationships', emoji: '❤️', color: 'bg-rose-50 text-rose-700' },
  { id: 'war', label: 'War', emoji: '⚔️', color: 'bg-slate-50 text-slate-700' },
  { id: 'tradition-change', label: 'Tradition or Change', emoji: '🔄', color: 'bg-teal-50 text-teal-700' },
  { id: 'published-this-year', label: 'Published This Year', emoji: '📅', color: 'bg-lime-50 text-lime-700' },
  { id: 'recommended', label: 'Recommended', emoji: '👍', color: 'bg-green-50 text-green-700' },
  { id: 'part-of-series', label: 'Part of a Series', emoji: '🔢', color: 'bg-blue-50 text-blue-700' },
  { id: 'travel-along', label: 'Travel Along', emoji: '🗺️', color: 'bg-sky-50 text-sky-700' },
  // Coin bas-gauche
  { id: 'ya-children', label: 'YA / Children\'s', emoji: '🧒', color: 'bg-yellow-50 text-yellow-700', corner: true },
  // Rangée gauche (bas → haut)
  { id: 'mystery', label: 'Mystery', emoji: '🔍', color: 'bg-gray-50 text-gray-700' },
  { id: 'historical', label: 'Historical Fiction', emoji: '📜', color: 'bg-amber-50 text-amber-700' },
]

function BookopolyContent() {
  const supabase = createClient()
  const toast = useToast()

  const [completed, setCompleted] = useState<CompletedCase[]>([])
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCase, setActiveCase] = useState<string | null>(null)
  const [bookSearch, setBookSearch] = useState('')

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: comp }, { data: bks }] = await Promise.all([
      supabase.from('bibliotheque_bookopoly').select('*').eq('user_id', user.id),
      supabase.from('bibliotheque_books')
        .select('id, title, author, cover_url')
        .eq('user_id', user.id)
        .eq('status', 'Lu')
        .order('title'),
    ])

    setCompleted((comp || []) as CompletedCase[])
    setBooks((bks || []) as Book[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  const completedMap = Object.fromEntries(completed.map(c => [c.case_id, c]))
  const totalCompleted = completed.length
  const progress = Math.round((totalCompleted / CASES.length) * 100)

  async function toggleCase(caseId: string, bookId?: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (completedMap[caseId]) {
      // Décocher
      await supabase.from('bibliotheque_bookopoly').delete()
        .eq('user_id', user.id).eq('case_id', caseId)
      toast('Case décochée', 'info')
    } else {
      // Cocher
      await supabase.from('bibliotheque_bookopoly').insert({
        user_id: user.id,
        case_id: caseId,
        book_id: bookId || null,
        completed_at: new Date().toISOString(),
      })
      toast('Case complétée ! 🎉', 'success')
    }
    setActiveCase(null)
    setBookSearch('')
    loadData()
  }

  async function linkBook(caseId: string, bookId: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (completedMap[caseId]) {
      // Mettre à jour le livre lié
      await supabase.from('bibliotheque_bookopoly').update({ book_id: bookId })
        .eq('user_id', user.id).eq('case_id', caseId)
    } else {
      await supabase.from('bibliotheque_bookopoly').insert({
        user_id: user.id,
        case_id: caseId,
        book_id: bookId,
        completed_at: new Date().toISOString(),
      })
    }
    toast('Livre lié à la case ! 📖', 'success')
    setActiveCase(null)
    setBookSearch('')
    loadData()
  }

  const filteredBooks = books.filter(b =>
    !bookSearch || b.title.toLowerCase().includes(bookSearch.toLowerCase()) || b.author.toLowerCase().includes(bookSearch.toLowerCase())
  )

  const activeCaseData = activeCase ? CASES.find(c => c.id === activeCase) : null
  const activeCaseCompleted = activeCase ? completedMap[activeCase] : null

  // Layout Monopoly : on affiche le board en grille avec les cases sur les bords
  // Haut: indices 0-10 (11 cases)
  // Droite: indices 11-19 (9 cases)
  // Bas: indices 21-30 (10 cases, inversé)
  // Gauche: indices 31-32 (2 cases, inversé) + coins 20, 30
  // On regroupe par côté pour simplifier

  const topRow = CASES.slice(0, 11)    // 11 cases dont coins 0 et 10
  const rightCol = CASES.slice(11, 20)  // 9 cases (entre coins)
  const bottomRow = CASES.slice(20, 31) // 11 cases dont coins 20 et 30
  const leftCol = CASES.slice(31, 33)   // 2 cases restantes

  function CaseSquare({ c, size = 'sm' }: { c: typeof CASES[0], size?: 'sm' | 'corner' }) {
    const done = !!completedMap[c.id]
    const linkedBook = done && completedMap[c.id].book_id
      ? books.find(b => b.id === completedMap[c.id].book_id)
      : null

    return (
      <button
        onClick={() => setActiveCase(activeCase === c.id ? null : c.id)}
        className={`relative flex flex-col items-center justify-center p-1 border border-gray-200 rounded-lg transition-all hover:shadow-sm active:scale-95 ${
          size === 'corner' ? 'w-14 h-14' : 'flex-1 h-14 min-w-0'
        } ${done ? 'bg-green-50 border-green-300' : 'bg-white'} ${
          activeCase === c.id ? 'ring-2 ring-violet' : ''
        }`}
      >
        <span className="text-base leading-none">{c.emoji}</span>
        <span className={`text-[7px] font-bold leading-tight text-center mt-0.5 ${done ? 'text-green-700' : 'text-gray-500'} line-clamp-2`}>
          {c.label}
        </span>
        {done && (
          <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full flex items-center justify-center">
            <CheckCircle2 size={10} className="text-white" />
          </div>
        )}
        {linkedBook && (
          <div className="absolute -bottom-1 -left-1 w-3.5 h-3.5 bg-violet rounded-full flex items-center justify-center">
            <BookOpen size={8} className="text-white" />
          </div>
        )}
      </button>
    )
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-black text-2xl text-ink">Bookopoly 🎲</h1>
        <div className="text-right">
          <p className="font-black text-violet">{totalCompleted}/{CASES.length}</p>
          <p className="text-[10px] font-bold text-gray-400">CASES</p>
        </div>
      </div>

      {/* Barre de progression */}
      <div className="card p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-black text-gray-500">Progression</span>
          <span className="text-xs font-black text-violet">{progress}%</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet to-pink rounded-full transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
        {totalCompleted === CASES.length && (
          <p className="text-center text-xs font-black text-amber-600 mt-2">
            🏆 Challenge complété ! Félicitations !
          </p>
        )}
      </div>

      {/* Plateau de jeu */}
      {loading ? (
        <div className="card h-64 animate-pulse bg-gray-50 flex items-center justify-center">
          <p className="text-gray-400 text-sm">Chargement du plateau…</p>
        </div>
      ) : (
        <div className="card p-2 overflow-hidden">
          {/* Rangée du haut */}
          <div className="flex gap-0.5 mb-0.5">
            {topRow.map(c => <CaseSquare key={c.id} c={c} size={c.corner ? 'corner' : 'sm'} />)}
          </div>

          {/* Zone centrale + colonnes */}
          <div className="flex gap-0.5">
            {/* Colonne gauche */}
            <div className="flex flex-col gap-0.5 w-14 flex-shrink-0">
              {[...leftCol].reverse().map(c => (
                <CaseSquare key={c.id} c={c} size="corner" />
              ))}
            </div>

            {/* Zone centrale */}
            <div className="flex-1 rounded-xl bg-gradient-to-br from-violet-light to-pink-light flex flex-col items-center justify-center p-3 min-h-[120px]">
              <div className="text-3xl mb-1">🎲</div>
              <p className="font-display font-black text-violet text-sm text-center">Bookopoly</p>
              <p className="text-[10px] text-gray-500 font-bold text-center mt-1">
                {totalCompleted} case{totalCompleted !== 1 ? 's' : ''} complétée{totalCompleted !== 1 ? 's' : ''}
              </p>
              <div className="mt-2 flex flex-wrap gap-1 justify-center">
                {[...Array(Math.min(totalCompleted, 10))].map((_, i) => (
                  <span key={i} className="text-xs">⭐</span>
                ))}
                {totalCompleted > 10 && <span className="text-[10px] text-gray-400 font-bold">+{totalCompleted - 10}</span>}
              </div>
            </div>

            {/* Colonne droite */}
            <div className="flex flex-col gap-0.5 w-14 flex-shrink-0">
              {rightCol.map(c => <CaseSquare key={c.id} c={c} size="corner" />)}
            </div>
          </div>

          {/* Rangée du bas (inversée) */}
          <div className="flex gap-0.5 mt-0.5">
            {[...bottomRow].reverse().map(c => <CaseSquare key={c.id} c={c} size={c.corner ? 'corner' : 'sm'} />)}
          </div>
        </div>
      )}

      {/* Panel case active */}
      {activeCase && activeCaseData && (
        <div className="card p-4 space-y-3 border-2 border-violet">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{activeCaseData.emoji}</span>
              <div>
                <p className="font-black text-ink">{activeCaseData.label}</p>
                {activeCaseCompleted && (
                  <p className="text-xs text-green-600 font-bold">✓ Complétée le {new Date(activeCaseCompleted.completed_at).toLocaleDateString('fr-FR')}</p>
                )}
              </div>
            </div>
            <button onClick={() => { setActiveCase(null); setBookSearch('') }}
              className="w-7 h-7 rounded-xl bg-gray-100 flex items-center justify-center">
              <X size={14} className="text-gray-500" />
            </button>
          </div>

          {/* Livre lié */}
          {activeCaseCompleted?.book_id && (
            <div className="bg-violet-light rounded-2xl p-3 flex items-center gap-2">
              <BookOpen size={14} className="text-violet flex-shrink-0" />
              <span className="text-xs font-bold text-violet truncate">
                {books.find(b => b.id === activeCaseCompleted.book_id)?.title || 'Livre inconnu'}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => toggleCase(activeCase)}
              className={`flex-1 py-2.5 rounded-2xl font-black text-sm transition-all ${
                activeCaseCompleted
                  ? 'bg-red-50 text-red-500 hover:bg-red-100'
                  : 'bg-green-50 text-green-600 hover:bg-green-100'
              }`}
            >
              {activeCaseCompleted ? '✕ Décocher' : '✓ Marquer comme lu'}
            </button>
          </div>

          {/* Lier un livre */}
          <div>
            <p className="text-xs font-black text-gray-500 mb-2">LIER UN LIVRE</p>
            <input
              value={bookSearch}
              onChange={e => setBookSearch(e.target.value)}
              placeholder="Chercher dans vos livres lus…"
              className="input text-sm mb-2"
            />
            {bookSearch && (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {filteredBooks.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-2">Aucun résultat</p>
                ) : (
                  filteredBooks.slice(0, 8).map(b => (
                    <button
                      key={b.id}
                      onClick={() => linkBook(activeCase, b.id)}
                      className="w-full text-left px-3 py-2 rounded-xl bg-gray-50 hover:bg-violet-light transition-colors"
                    >
                      <p className="font-bold text-sm text-ink truncate">{b.title}</p>
                      <p className="text-xs text-gray-400 truncate">{b.author}</p>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Liste des cases complétées */}
      {totalCompleted > 0 && (
        <div>
          <h2 className="font-black text-base text-ink mb-2">Cases complétées</h2>
          <div className="space-y-2">
            {completed.map(comp => {
              const caseData = CASES.find(c => c.id === comp.case_id)
              const book = books.find(b => b.id === comp.book_id)
              if (!caseData) return null
              return (
                <div key={comp.case_id} className="card flex items-center gap-3 p-3">
                  <div className="w-10 h-10 rounded-2xl bg-green-50 flex items-center justify-center text-xl flex-shrink-0">
                    {caseData.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm text-ink truncate">{caseData.label}</p>
                    {book ? (
                      <p className="text-xs text-violet font-bold truncate">📖 {book.title}</p>
                    ) : (
                      <p className="text-xs text-gray-400">{new Date(comp.completed_at).toLocaleDateString('fr-FR')}</p>
                    )}
                  </div>
                  <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function BookopolyPage() {
  return <ToastProvider><AppLayout><BookopolyContent /></AppLayout></ToastProvider>
}

