'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { X } from 'lucide-react'

interface Book { id: string; title: string; author: string }
interface CompletedCase { case_id: string; book_id?: string; completed_at: string }

const CASES = [
  // BAS — gauche vers droite (index 0 = coin bas-gauche)
  { id: 'ya-children',       label: "YA / Children's",       emoji: '🧒', corner: true  },
  { id: 'mystery',           label: 'Mystery',               emoji: '🔍'                },
  { id: 'historical',        label: 'Historical Fiction',    emoji: '📜'                },
  { id: 'travel-along',      label: 'Travel Along',          emoji: '🗺️'               },
  { id: 'part-of-series',    label: 'Part of a Series',      emoji: '🔢'                },
  { id: 'recommended',       label: 'Recommended',           emoji: '👍'                },
  { id: 'published-this-year',label: 'Published This Year',  emoji: '📅'                },
  { id: 'tradition-change',  label: 'Tradition or Change',   emoji: '🔄'                },
  { id: 'war',               label: 'War',                   emoji: '⚔️'               },
  { id: 'relationships',     label: 'Relationships',         emoji: '❤️'               },
  // Coin bas-droite
  { id: 'book-ban',          label: 'Book Ban!',             emoji: '📵', corner: true  },

  // DROITE — bas vers haut
  { id: 'travel-afar',       label: 'Travel Afar',           emoji: '🌏'                },
  { id: 'library-fine-bottom',label: 'Library Fine',         emoji: '💰'                },
  { id: 'fantasy-scifi',     label: 'Fantasy or Sci-Fi',     emoji: '🚀'                },
  { id: 'classics',          label: 'Classics',              emoji: '🏛️'               },
  { id: 'award-winner',      label: 'Award Winner',          emoji: '🏆'                },
  { id: 'contemporary',      label: 'Contemporary Fiction',  emoji: '🏙️'               },
  { id: 'travel-away',       label: 'Travel Away',           emoji: '🧳'                },
  { id: 'longest',           label: 'Longest Book',          emoji: '📖'                },
  { id: 'partner-pick',      label: 'Partner Pick',          emoji: '💑'                },
  // Coin haut-droite
  { id: 'go-to-book-ban',    label: 'Go to Book Ban!',       emoji: '🚫', corner: true  },

  // HAUT — droite vers gauche
  { id: 'longest-shelved',   label: 'Longest Shelved',       emoji: '📚'                },
  { id: 'most-recent',       label: 'Most Recently Added',   emoji: '🆕'                },
  { id: 'times-of-life',     label: 'Times of Life',         emoji: '⏳'                },
  { id: 'library-fine-top',  label: 'Library Fine',          emoji: '💰'                },
  { id: 'society',           label: 'Society',               emoji: '🌍'                },
  { id: 'nature',            label: 'Nature',                emoji: '🌿'                },
  { id: 'travel-abroad',     label: 'Travel Abroad',         emoji: '✈️'               },
  { id: 'shortest',          label: 'Shortest Book',         emoji: '📄'                },
  { id: 'highest-avg',       label: 'Highest Avg Rating',    emoji: '🏅'                },
  // Coin haut-gauche
  { id: 'go-book-sale',      label: 'Book Sale!',            emoji: '🛍️', corner: true },

  // GAUCHE — haut vers bas
  { id: 'surprise',          label: '?',                     emoji: '❓'                },
  { id: 'highest-ratings',   label: 'Highest # of Ratings',  emoji: '⭐'                },
]

const BOTTOM = CASES.slice(0, 9)
const CORNER_BR = CASES[9]
const RIGHT = CASES.slice(10, 19)
const CORNER_TR = CASES[19]
const TOP_RAW = CASES.slice(20, 29)
const CORNER_TL = CASES[29]
const LEFT_RAW = CASES.slice(30, 34)
const CORNER_BL = CASES[0]

const TOP_ROW = [CORNER_TL, ...TOP_RAW.slice().reverse(), CORNER_TR]
const BOTTOM_ROW = [CORNER_BL, ...BOTTOM.slice(1), CORNER_BR]
const RIGHT_COL = RIGHT
const LEFT_COL = [...LEFT_RAW].reverse()

const LS_ACTIVE = 'bookopoly_active_case_id'
const LS_NEEDS  = 'bookopoly_needs_validation'
const LS_DICE   = 'bookopoly_dice_value'

function BookopolyContent() {
  const supabase = createClient()
  const toast = useToast()

  const [completed, setCompleted] = useState<CompletedCase[]>([])
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)

  // État du dé — initialisé depuis localStorage
  const [activeCase, setActiveCase] = useState<typeof CASES[0] | null>(() => {
    try {
      const id = localStorage.getItem(LS_ACTIVE)
      return id ? (CASES.find(c => c.id === id) ?? null) : null
    } catch { return null }
  })
  const [rolling, setRolling] = useState(false)
  const [diceValue, setDiceValue] = useState<number>(() => {
    try { return parseInt(localStorage.getItem(LS_DICE) || '1') || 1 } catch { return 1 }
  })
  const [bookSearch, setBookSearch] = useState('')
  const [needsValidation, setNeedsValidation] = useState<boolean>(() => {
    try { return localStorage.getItem(LS_NEEDS) === 'true' } catch { return false }
  })

  // Persister dans localStorage à chaque changement
  useEffect(() => {
    try {
      if (activeCase) localStorage.setItem(LS_ACTIVE, activeCase.id)
      else localStorage.removeItem(LS_ACTIVE)
    } catch {}
  }, [activeCase])

  useEffect(() => {
    try { localStorage.setItem(LS_NEEDS, String(needsValidation)) } catch {}
  }, [needsValidation])

  useEffect(() => {
    try { localStorage.setItem(LS_DICE, String(diceValue)) } catch {}
  }, [diceValue])

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: comp }, { data: bks }] = await Promise.all([
      supabase.from('bibliotheque_bookopoly').select('*').eq('user_id', user.id),
      supabase.from('bibliotheque_books')
        .select('id, title, author')
        .eq('user_id', user.id)
        .eq('status', 'Lu')
        .order('title'),
    ])

    setCompleted((comp || []) as CompletedCase[])
    setBooks((bks || []) as Book[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  const completedIds = new Set(completed.map(c => c.case_id))
  const remaining = CASES.filter(c => !completedIds.has(c.id))
  const totalCompleted = completed.length
  const progress = Math.round((totalCompleted / CASES.length) * 100)

  const DICE_FACES = ['⚀','⚁','⚂','⚃','⚄','⚅']

  async function rollDice() {
    if (remaining.length === 0) { toast('Toutes les cases sont complétées ! 🎉', 'success'); return }
    if (needsValidation) { toast('Valide d\'abord la case en cours !', 'error'); return }

    setRolling(true)
    setActiveCase(null)

    let count = 0
    const interval = setInterval(() => {
      setDiceValue(Math.floor(Math.random() * 6) + 1)
      count++
      if (count >= 12) {
        clearInterval(interval)
        setRolling(false)
        const picked = remaining[Math.floor(Math.random() * remaining.length)]
        setActiveCase(picked)
        setNeedsValidation(true)
        setBookSearch('')
      }
    }, 80)
  }

  async function validateCase(bookId?: string) {
    if (!activeCase) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('bibliotheque_bookopoly').upsert({
      user_id: user.id,
      case_id: activeCase.id,
      book_id: bookId || null,
      completed_at: new Date().toISOString(),
    }, { onConflict: 'user_id,case_id' })

    if (error) { toast('Erreur', 'error'); return }
    toast('Case complétée ! 🎉', 'success')
    setNeedsValidation(false)
    setActiveCase(null)
    setBookSearch('')
    loadData()
  }

  async function uncomplete(caseId: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('bibliotheque_bookopoly').delete().eq('user_id', user.id).eq('case_id', caseId)
    toast('Case décochée', 'info')
    loadData()
  }

  function skipCase() {
    setNeedsValidation(false)
    setActiveCase(null)
    setBookSearch('')
    toast('Case passée — relance le dé !', 'info')
  }

  const filteredBooks = books.filter(b =>
    !bookSearch || b.title.toLowerCase().includes(bookSearch.toLowerCase()) ||
    b.author.toLowerCase().includes(bookSearch.toLowerCase())
  )

  function Square({ c, vertical = false }: { c: typeof CASES[0]; vertical?: boolean }) {
    const done = completedIds.has(c.id)
    const isActive = activeCase?.id === c.id

    return (
      <button
        onClick={() => { if (done) uncomplete(c.id) }}
        className={`
          relative flex flex-col items-center justify-center text-center
          border transition-all select-none
          ${c.corner ? 'w-12 h-12 flex-shrink-0 rounded-lg' : vertical ? 'w-12 flex-1 rounded-md' : 'flex-1 h-12 rounded-md'}
          ${done ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200'}
          ${isActive ? 'ring-2 ring-violet border-violet shadow-sm scale-105 z-10' : ''}
        `}
        title={c.label}
      >
        <span className={c.corner ? 'text-xl' : 'text-sm'}>{c.emoji}</span>
        {!c.corner && (
          <span className={`text-[6px] font-bold leading-tight px-0.5 line-clamp-2 ${done ? 'text-green-600' : 'text-gray-400'}`}>
            {c.label}
          </span>
        )}
        {done && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full flex items-center justify-center">
            <span className="text-white text-[6px]">✓</span>
          </div>
        )}
        {isActive && (
          <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-violet rounded-full flex items-center justify-center animate-bounce">
            <span className="text-white text-[8px]">🎲</span>
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
          <p className="text-[10px] font-bold text-gray-400">COMPLÉTÉES</p>
        </div>
      </div>

      <div className="card p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-black text-gray-500">Progression</span>
          <span className="text-xs font-black text-violet">{progress}%</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-violet to-pink rounded-full transition-all duration-700"
            style={{ width: `${progress}%` }} />
        </div>
        {remaining.length === 0 && (
          <p className="text-center text-xs font-black text-amber-600 mt-2">🏆 Challenge complété !</p>
        )}
      </div>

      {loading ? (
        <div className="card h-72 animate-pulse bg-gray-50 flex items-center justify-center">
          <p className="text-gray-400 text-sm">Chargement…</p>
        </div>
      ) : (
        <div className="card p-1.5 bg-white">
          <div className="flex gap-0.5 mb-0.5">
            {TOP_ROW.map(c => <Square key={c.id} c={c} />)}
          </div>
          <div className="flex gap-0.5">
            <div className="flex flex-col gap-0.5">
              {LEFT_COL.map(c => <Square key={c.id} c={c} vertical />)}
            </div>
            <div className="flex-1 rounded-xl bg-gradient-to-br from-violet-light via-pink-light to-violet-light flex flex-col items-center justify-center gap-2 py-4 min-h-[160px]">
              <button
                onClick={rollDice}
                disabled={rolling || (needsValidation && !!activeCase)}
                className={`
                  text-5xl transition-all duration-100 select-none
                  ${rolling ? 'animate-spin' : 'hover:scale-110 active:scale-90'}
                  ${needsValidation && !rolling ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                {DICE_FACES[diceValue - 1]}
              </button>

              <p className="font-display font-black text-violet text-sm">Bookopoly</p>

              {!needsValidation && !rolling && remaining.length > 0 && (
                <p className="text-[10px] text-gray-500 font-bold text-center px-4">
                  {totalCompleted === 0 ? 'Lance le dé pour commencer !' : `${remaining.length} case${remaining.length > 1 ? 's' : ''} restante${remaining.length > 1 ? 's' : ''}`}
                </p>
              )}
              {rolling && (
                <p className="text-[10px] text-violet font-black animate-pulse">En cours…</p>
              )}
              {needsValidation && activeCase && !rolling && (
                <div className="text-center px-2">
                  <p className="text-xs font-black text-violet">{activeCase.emoji} {activeCase.label}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Valide avec un livre !</p>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              {RIGHT_COL.map(c => <Square key={c.id} c={c} vertical />)}
            </div>
          </div>
          <div className="flex gap-0.5 mt-0.5">
            {BOTTOM_ROW.map(c => <Square key={c.id} c={c} />)}
          </div>
        </div>
      )}

      {/* Panel validation */}
      {activeCase && needsValidation && !rolling && (
        <div className="card p-4 space-y-3 border-2 border-violet">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-3xl">{activeCase.emoji}</span>
              <div>
                <p className="font-black text-ink">{activeCase.label}</p>
                <p className="text-xs text-gray-400">Lie un livre lu pour valider cette case</p>
              </div>
            </div>
            <button onClick={() => { setActiveCase(null); setNeedsValidation(false); setBookSearch('') }}
              className="w-7 h-7 rounded-xl bg-gray-100 flex items-center justify-center">
              <X size={14} className="text-gray-500" />
            </button>
          </div>

          <div>
            <label className="text-xs font-black text-gray-500 mb-1.5 block">CHOISIR UN LIVRE LU</label>
            <input
              value={bookSearch}
              onChange={e => setBookSearch(e.target.value)}
              placeholder="Rechercher parmi tes livres lus…"
              className="input text-sm"
            />
          </div>

          {bookSearch && (
            <div className="space-y-1 max-h-44 overflow-y-auto">
              {filteredBooks.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-3">Aucun résultat</p>
              ) : (
                filteredBooks.slice(0, 8).map(b => (
                  <button key={b.id} onClick={() => validateCase(b.id)}
                    className="w-full text-left px-3 py-2.5 rounded-xl bg-gray-50 hover:bg-violet-light transition-colors">
                    <p className="font-bold text-sm text-ink truncate">{b.title}</p>
                    <p className="text-xs text-gray-400 truncate">{b.author}</p>
                  </button>
                ))
              )}
            </div>
          )}

          {books.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-2">
              Aucun livre lu pour l'instant — termine un livre d'abord !
            </p>
          )}

          <div className="flex gap-2">
            <button onClick={skipCase}
              className="flex-1 py-2.5 rounded-2xl font-black text-sm bg-gray-100 text-gray-500 hover:bg-gray-200 transition-all">
              Passer
            </button>
            <button onClick={() => validateCase(undefined)}
              className="flex-[2] py-2.5 rounded-2xl font-black text-sm bg-green-50 text-green-600 hover:bg-green-100 transition-all">
              ✓ Valider sans livre
            </button>
          </div>
        </div>
      )}

      {totalCompleted > 0 && (
        <div>
          <h2 className="font-black text-base text-ink mb-2">Cases complétées ({totalCompleted})</h2>
          <div className="space-y-2">
            {completed.map(comp => {
              const caseData = CASES.find(c => c.id === comp.case_id)
              const book = comp.book_id ? books.find(b => b.id === comp.book_id) : null
              if (!caseData) return null
              return (
                <div key={comp.case_id} className="card flex items-center gap-3 p-3">
                  <div className="w-10 h-10 rounded-2xl bg-green-50 flex items-center justify-center text-xl flex-shrink-0">
                    {caseData.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm text-ink truncate">{caseData.label}</p>
                    {book
                      ? <p className="text-xs text-violet font-bold truncate">📖 {book.title}</p>
                      : <p className="text-xs text-gray-400">{new Date(comp.completed_at).toLocaleDateString('fr-FR')}</p>
                    }
                  </div>
                  <button onClick={() => uncomplete(comp.case_id)}
                    className="w-7 h-7 rounded-xl bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-100 flex-shrink-0">
                    <X size={12} />
                  </button>
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
