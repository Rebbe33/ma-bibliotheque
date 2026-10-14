'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { X, CheckCircle2, BookOpen, Dices } from 'lucide-react'

interface Book { id: string; title: string; author: string }
interface CompletedCase { case_id: string; book_id?: string; completed_at: string }

// 11 cases par côté (incluant les coins) = 40 cases total comme Monopoly
// Coins : indices 0 (BG), 10 (BD), 20 (HD), 30 (HG)
// Bas (BG→BD) : 0-10
// Droite (BD→HD) : 10-20
// Haut (HD→HG) : 20-30
// Gauche (HG→BG) : 30-40 (=0)

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
// Total = 34 cases (pas exactement 40 — on s'adapte à tes cases réelles)

// Répartition visuelle : 9 cases par côté entre les 4 coins
const SIDE_COUNT = Math.floor((CASES.length - 4) / 4) // cases non-coin par côté
// Coins sont aux positions 0, S+1, 2*(S+1), 3*(S+1) où S = SIDE_COUNT

// On crée une disposition fixe adaptée à nos 34 cases
// Bas : cases[0..8] (9 + coin gauche = index 0, coin droit = index 9)
// Droite : cases[9..18]
// Haut : cases[18..27]
// Gauche : cases[27..33] + retour à 0

// Répartition réelle avec 34 cases :
// On fait 4 coins + 30 cases de côté = 4 * 7,5 → on ajuste à 4 côtés de 8 + 4 coins = 36
// On garde les 34 cases telles quelles et on répartit :
// Bas (BG→BD) : indices 0-8  (9 cases dont le coin 0 et le coin 8)
// Droite (BD→HD) : indices 8-16 (le coin 8 est partagé)
// Haut (HD→HG) : indices 16-24
// Gauche (HG→BG) : indices 24-33+0

// Simplification : on mappe directement sur 4 rangées
const BOTTOM = CASES.slice(0, 9)     // index 0 (coin BG) → 8 (avant coin BD) + coin BD est à index 9
const CORNER_BR = CASES[9]
const RIGHT = CASES.slice(10, 19)    // 9 cases droite (haut)
const CORNER_TR = CASES[19]
const TOP_RAW = CASES.slice(20, 29)  // 9 cases haut (de droite à gauche, on les inverse à l'affichage)
const CORNER_TL = CASES[29]
const LEFT_RAW = CASES.slice(30, 34) // 4 cases gauche restantes
const CORNER_BL = CASES[0]           // le coin BG est déjà dans BOTTOM[0]

// Pour l'affichage du plateau :
// Rangée TOP = [CORNER_TL, ...TOP_RAW inversé, CORNER_TR] → mais on veut gauche→droite
// Rangée BOTTOM = [CORNER_BL, ...BOTTOM.slice(1), CORNER_BR] → gauche→droite
const TOP_ROW = [CORNER_TL, ...TOP_RAW.slice().reverse(), CORNER_TR]
const BOTTOM_ROW = [CORNER_BL, ...BOTTOM.slice(1), CORNER_BR]
const RIGHT_COL = RIGHT  // bas→haut quand on lit de haut en bas = on les inverse
const LEFT_COL = [...LEFT_RAW].reverse() // idem

function BookopolyContent() {
  const supabase = createClient()
  const toast = useToast()

  const [completed, setCompleted] = useState<CompletedCase[]>([])
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)

  // État du dé
  const [activeCase, setActiveCase] = useState<typeof CASES[0] | null>(null)
  const [rolling, setRolling] = useState(false)
  const [diceValue, setDiceValue] = useState(1)
  const [bookSearch, setBookSearch] = useState('')
  const [needsValidation, setNeedsValidation] = useState(false) // case tirée, attend validation

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

  // Dés emoji
  const DICE_FACES = ['⚀','⚁','⚂','⚃','⚄','⚅']

  async function rollDice() {
    if (remaining.length === 0) { toast('Toutes les cases sont complétées ! 🎉', 'success'); return }
    if (needsValidation) { toast('Valide d\'abord la case en cours !', 'error'); return }

    setRolling(true)
    setActiveCase(null)

    // Animation dé
    let count = 0
    const interval = setInterval(() => {
      setDiceValue(Math.floor(Math.random() * 6) + 1)
      count++
      if (count >= 12) {
        clearInterval(interval)
        setRolling(false)
        // Tirer une case aléatoire parmi les non-complétées
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
    // On skip la case (on peut relancer sans valider)
    setNeedsValidation(false)
    setActiveCase(null)
    setBookSearch('')
    toast('Case passée — relance le dé !', 'info')
  }

  const filteredBooks = books.filter(b =>
    !bookSearch || b.title.toLowerCase().includes(bookSearch.toLowerCase()) ||
    b.author.toLowerCase().includes(bookSearch.toLowerCase())
  )

  // Composant case du plateau
  function Square({ c, vertical = false }: { c: typeof CASES[0]; vertical?: boolean }) {
    const done = completedIds.has(c.id)
    const isActive = activeCase?.id === c.id
    const compEntry = completed.find(x => x.case_id === c.id)
    const linkedBook = compEntry?.book_id ? books.find(b => b.id === compEntry.book_id) : null

    return (
      <button
        onClick={() => {
          if (done) uncomplete(c.id)
        }}
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

      {/* Barre de progression */}
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

      {/* Plateau de jeu */}
      {loading ? (
        <div className="card h-72 animate-pulse bg-gray-50 flex items-center justify-center">
          <p className="text-gray-400 text-sm">Chargement…</p>
        </div>
      ) : (
        <div className="card p-1.5 bg-white">
          {/* Rangée du HAUT */}
          <div className="flex gap-0.5 mb-0.5">
            {TOP_ROW.map(c => <Square key={c.id} c={c} />)}
          </div>

          {/* Zone centrale avec colonnes gauche et droite */}
          <div className="flex gap-0.5">
            {/* Colonne GAUCHE (haut→bas dans l'affichage) */}
            <div className="flex flex-col gap-0.5">
              {LEFT_COL.map(c => <Square key={c.id} c={c} vertical />)}
            </div>

            {/* Centre */}
            <div className="flex-1 rounded-xl bg-gradient-to-br from-violet-light via-pink-light to-violet-light flex flex-col items-center justify-center gap-2 py-4 min-h-[160px]">
              {/* Dé animé */}
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

            {/* Colonne DROITE (haut→bas) */}
            <div className="flex flex-col gap-0.5">
              {RIGHT_COL.map(c => <Square key={c.id} c={c} vertical />)}
            </div>
          </div>

          {/* Rangée du BAS */}
          <div className="flex gap-0.5 mt-0.5">
            {BOTTOM_ROW.map(c => <Square key={c.id} c={c} />)}
          </div>
        </div>
      )}

      {/* Panel validation de la case tirée */}
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

          {/* Recherche de livre */}
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
                  <button
                    key={b.id}
                    onClick={() => validateCase(b.id)}
                    className="w-full text-left px-3 py-2.5 rounded-xl bg-gray-50 hover:bg-violet-light transition-colors"
                  >
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
            <button
              onClick={() => validateCase(undefined)}
              className="flex-[2] py-2.5 rounded-2xl font-black text-sm bg-green-50 text-green-600 hover:bg-green-100 transition-all"
            >
              ✓ Valider sans livre
            </button>
          </div>
        </div>
      )}

      {/* Cases complétées */}
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
