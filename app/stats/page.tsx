'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
import { Book, BookStatus } from '@/types'

interface ReadingSession {
  id: string
  book_id?: string
  date: string
  pages: number
}

const STATUS_COLOR: Record<BookStatus, string> = {
  'Lu':         '#10b981',
  'En cours':   '#f59e0b',
  'À lire':     '#06b6d4',
  'Abandonné':  '#f97316',
  'Prêté':      '#8b5cf6',
  'À acquérir': '#a855f7',
}

const STATUS_CARD: Record<BookStatus, { bg: string; emoji: string }> = {
  'Lu':         { bg: '#10b981', emoji: '✅' },
  'En cours':   { bg: '#f59e0b', emoji: '📖' },
  'À lire':     { bg: '#06b6d4', emoji: '📋' },
  'Abandonné':  { bg: '#f97316', emoji: '💀' },
  'Prêté':      { bg: '#8b5cf6', emoji: '🤝' },
  'À acquérir': { bg: '#a855f7', emoji: '🛒' },
}

const STATUSES_BAR: BookStatus[] = ['Lu', 'En cours', 'À lire', 'Abandonné', 'Prêté', 'À acquérir']

const YEAR_COLORS = ['#7c3aed', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#f97316', '#8b5cf6', '#a855f7']

export default function StatsPage() {
  const supabase = createClient()
  const [books, setBooks] = useState<Book[]>([])
  const [sessions, setSessions] = useState<ReadingSession[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: bks }, { data: sess }] = await Promise.all([
        supabase.from('bibliotheque_books').select('*').eq('user_id', user.id),
        supabase.from('bibliotheque_reading_sessions').select('id, book_id, date, pages').eq('user_id', user.id),
      ])
      setBooks(bks || [])
      setSessions(sess || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <AppLayout><div className="flex items-center justify-center py-24 text-4xl animate-float">📊</div></AppLayout>

  // ── Stats globales ──────────────────────────────────────────────
  const byStatus = (s: BookStatus) => books.filter(b => b.status === s).length
  const luBooks = books.filter(b => b.status === 'Lu')

  const totalPagesAll = luBooks.filter(b => b.pages).reduce((s, b) => s + (b.pages || 0), 0)
  const rated = books.filter(b => b.rating > 0)
  const avg = rated.length ? (rated.reduce((s, b) => s + b.rating, 0) / rated.length).toFixed(1) : null

  const pagesArr = luBooks.filter(b => b.pages).map(b => b.pages || 0)
  const pagesMin = pagesArr.length ? Math.min(...pagesArr) : null
  const pagesMax = pagesArr.length ? Math.max(...pagesArr) : null
  const pagesAvgBook = pagesArr.length ? Math.round(pagesArr.reduce((a, b) => a + b, 0) / pagesArr.length) : null

  const genres: Record<string, number> = {}
  books.forEach(b => { if (b.genre) genres[b.genre] = (genres[b.genre] || 0) + 1 })
  const topGenres = Object.entries(genres).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const maxG = topGenres[0]?.[1] || 1

  const ratings = [5, 4, 3, 2, 1].map(r => ({ r, n: books.filter(b => b.rating === r).length }))
  const maxR = Math.max(...ratings.map(x => x.n), 1)

  // ── Stats par année ─────────────────────────────────────────────
  const availableYears = Array.from(new Set(
    sessions.map(s => new Date(s.date).getFullYear())
  )).sort((a, b) => b - a)
  if (!availableYears.includes(selectedYear) && availableYears.length > 0) {
    // keep selectedYear as is if no sessions, it's fine
  }

  const yearSessions = sessions.filter(s => new Date(s.date).getFullYear() === selectedYear)
  const totalPagesYear = yearSessions.reduce((a, s) => a + s.pages, 0)

  // Livres lus cette année = livres avec des sessions cette année (approx)
  const booksReadThisYear = Array.from(new Set(yearSessions.filter(s => s.book_id).map(s => s.book_id as string)))
  const booksLuYear = luBooks.length // total lu (pas de date_finished sur les livres)

  // Pages par mois pour l'année sélectionnée
  const pagesByMonth = Array.from({ length: 12 }, (_, i) => {
    const monthSessions = yearSessions.filter(s => new Date(s.date).getMonth() === i)
    return monthSessions.reduce((a, s) => a + s.pages, 0)
  })
  const maxMonth = Math.max(...pagesByMonth, 1)

  // Genres par année (livres avec sessions cette année)
  const booksThisYearIds = new Set(yearSessions.filter(s => s.book_id).map(s => s.book_id))
  const genresYear: Record<string, number> = {}
  books.filter(b => b.id && booksThisYearIds.has(b.id)).forEach(b => {
    if (b.genre) genresYear[b.genre] = (genresYear[b.genre] || 0) + 1
  })
  const topGenresYear = Object.entries(genresYear).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const maxGY = topGenresYear[0]?.[1] || 1

  // Nationalités par année
  const nationsYear: Record<string, number> = {}
  books.filter(b => b.id && booksThisYearIds.has(b.id)).forEach(b => {
    const nat = (b as any).nationality || (b as any).author_nationality
    if (nat) nationsYear[nat] = (nationsYear[nat] || 0) + 1
  })
  const topNationsYear = Object.entries(nationsYear).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const maxNY = topNationsYear[0]?.[1] || 1

  // Nationalités globales (tous les livres lus)
  const nationsAll: Record<string, number> = {}
  luBooks.forEach(b => {
    const nat = (b as any).nationality || (b as any).author_nationality
    if (nat) nationsAll[nat] = (nationsAll[nat] || 0) + 1
  })
  const topNationsAll = Object.entries(nationsAll).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const maxNA = topNationsAll[0]?.[1] || 1

  const MONTH_SHORT = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
  const GENRE_COLORS = ['bg-violet', 'bg-pink', 'bg-cyan', 'bg-lime', 'bg-amber', 'bg-coral']

  return (
    <AppLayout>
      <div className="space-y-4 pb-8">
        <h1 className="font-display font-black text-2xl text-ink">Mes statistiques 📊</h1>

        {/* Hero — total */}
        <div className="card p-5 text-white" style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}>
          <p className="font-bold text-white/70 text-sm">Total de livres</p>
          <p className="font-black text-6xl">{books.length}</p>
          <p className="font-semibold text-white/80 text-sm mt-1">dans ta bibliothèque</p>
        </div>

        {/* Cartes par statut */}
        <div className="grid grid-cols-2 gap-3">
          {(['Lu', 'En cours', 'À lire', 'Abandonné', 'Prêté', 'À acquérir'] as BookStatus[]).map(s => {
            const n = byStatus(s)
            const { bg, emoji } = STATUS_CARD[s]
            return (
              <div key={s} className="card p-4 text-white" style={{ background: bg }}>
                <div className="text-2xl">{emoji}</div>
                <div className="font-black text-3xl mt-1">{n}</div>
                <div className="font-bold text-white/80 text-xs mt-0.5">{s}</div>
              </div>
            )
          })}
        </div>

        {/* Pages & notes globales */}
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4 text-center">
            <div className="text-2xl mb-1">📄</div>
            <div className="font-black text-2xl text-ink">{totalPagesAll > 0 ? totalPagesAll.toLocaleString('fr-FR') : '0'}</div>
            <div className="text-xs font-bold text-gray-400 mt-0.5">PAGES LUES (TOTAL)</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl mb-1">⭐</div>
            <div className="font-black text-2xl text-ink">{avg || '—'}</div>
            <div className="text-xs font-bold text-gray-400 mt-0.5">NOTE MOYENNE</div>
          </div>
        </div>

        {/* Pages par livre */}
        {pagesArr.length > 0 && (
          <div className="card p-4">
            <h2 className="font-black text-base text-ink mb-3">Pages par livre (livres lus)</h2>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="font-black text-xl text-ink">{pagesMin?.toLocaleString('fr-FR')}</div>
                <div className="text-[10px] font-bold text-gray-400 mt-0.5">MINIMUM</div>
              </div>
              <div>
                <div className="font-black text-xl text-violet">{pagesAvgBook?.toLocaleString('fr-FR')}</div>
                <div className="text-[10px] font-bold text-gray-400 mt-0.5">MOYENNE</div>
              </div>
              <div>
                <div className="font-black text-xl text-ink">{pagesMax?.toLocaleString('fr-FR')}</div>
                <div className="text-[10px] font-bold text-gray-400 mt-0.5">MAXIMUM</div>
              </div>
            </div>
          </div>
        )}

        {/* Répartition par statut */}
        {books.length > 0 && (
          <div className="card p-4">
            <h2 className="font-black text-base text-ink mb-3">Répartition par statut</h2>
            <div className="space-y-2.5">
              {STATUSES_BAR.map(s => {
                const n = byStatus(s)
                return (
                  <div key={s} className="flex items-center gap-3">
                    <span className="text-xs font-black text-gray-500 w-20 shrink-0">{s}</span>
                    <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${books.length ? Math.round(n / books.length * 100) : 0}%`, background: STATUS_COLOR[s] }} />
                    </div>
                    <span className="font-black text-sm text-ink w-6 text-right">{n}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ═══ STATS PAR ANNÉE ═══ */}
        <div className="flex items-center justify-between pt-2">
          <h2 className="font-display font-black text-lg text-ink">Par année 📅</h2>
          {availableYears.length > 0 && (
            <div className="flex gap-1 flex-wrap justify-end">
              {availableYears.map(y => (
                <button key={y} onClick={() => setSelectedYear(y)}
                  className={`px-3 py-1 rounded-2xl text-xs font-black transition-all ${
                    selectedYear === y ? 'bg-violet text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                  {y}
                </button>
              ))}
            </div>
          )}
        </div>

        {availableYears.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-gray-400 text-sm">Ajoute des sessions de lecture pour voir les stats annuelles !</p>
          </div>
        ) : (
          <>
            {/* Chiffres clés de l'année */}
            <div className="grid grid-cols-2 gap-3">
              <div className="card p-4 text-center">
                <div className="text-2xl mb-1">📚</div>
                <div className="font-black text-2xl text-ink">{booksReadThisYear.length}</div>
                <div className="text-xs font-bold text-gray-400 mt-0.5">LIVRES LUS</div>
              </div>
              <div className="card p-4 text-center">
                <div className="text-2xl mb-1">📄</div>
                <div className="font-black text-2xl text-ink">{totalPagesYear.toLocaleString('fr-FR')}</div>
                <div className="text-xs font-bold text-gray-400 mt-0.5">PAGES LUES</div>
              </div>
            </div>

            {/* Graphique pages par mois */}
            {totalPagesYear > 0 && (
              <div className="card p-4">
                <h2 className="font-black text-base text-ink mb-3">Pages par mois — {selectedYear}</h2>
                <div className="flex items-end gap-1 h-24">
                  {pagesByMonth.map((p, i) => {
                    const pct = p / maxMonth
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                        <div className="w-full flex flex-col justify-end" style={{ height: '80px' }}>
                          <div className="w-full rounded-t transition-all duration-500"
                            style={{
                              height: p > 0 ? `${Math.max(pct * 80, 4)}px` : '4px',
                              background: p > 0 ? '#7c3aed' : '#f3f4f6'
                            }} />
                        </div>
                        <span className="text-[7px] font-black text-gray-400">{MONTH_SHORT[i]}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Genres cette année */}
            {topGenresYear.length > 0 && (
              <div className="card p-4">
                <h2 className="font-black text-base text-ink mb-3">Genres lus en {selectedYear}</h2>
                <div className="space-y-2.5">
                  {topGenresYear.map(([g, n], i) => (
                    <div key={g} className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${GENRE_COLORS[i % GENRE_COLORS.length]}`} />
                      <span className="text-sm font-bold text-ink flex-1 truncate">{g}</span>
                      <div className="w-24 h-2.5 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
                        <div className={`h-full rounded-full ${GENRE_COLORS[i % GENRE_COLORS.length]}`}
                          style={{ width: `${Math.round(n / maxGY * 100)}%` }} />
                      </div>
                      <span className="font-black text-sm text-ink w-5 text-right">{n}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Nationalités cette année */}
            {topNationsYear.length > 0 && (
              <div className="card p-4">
                <h2 className="font-black text-base text-ink mb-3">Nationalités des auteurs — {selectedYear}</h2>
                <div className="space-y-2.5">
                  {topNationsYear.map(([nat, n], i) => (
                    <div key={nat} className="flex items-center gap-3">
                      <span className="text-sm font-bold text-ink flex-1 truncate">{nat}</span>
                      <div className="w-24 h-2.5 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.round(n / maxNY * 100)}%`, background: YEAR_COLORS[i % YEAR_COLORS.length] }} />
                      </div>
                      <span className="font-black text-sm text-ink w-5 text-right">{n}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══ STATS GLOBALES (tous les livres lus) ═══ */}
        {/* Genres favoris globaux */}
        {topGenres.length > 0 && (
          <div className="card p-4">
            <h2 className="font-black text-base text-ink mb-3">Genres favoris (tous temps)</h2>
            <div className="space-y-2.5">
              {topGenres.map(([g, n], i) => (
                <div key={g} className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${GENRE_COLORS[i % GENRE_COLORS.length]}`} />
                  <span className="text-sm font-bold text-ink flex-1 truncate">{g}</span>
                  <div className="w-28 h-2.5 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
                    <div className={`h-full rounded-full ${GENRE_COLORS[i % GENRE_COLORS.length]}`}
                      style={{ width: `${Math.round(n / maxG * 100)}%` }} />
                  </div>
                  <span className="font-black text-sm text-ink w-5 text-right">{n}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Nationalités globales */}
        {topNationsAll.length > 0 && (
          <div className="card p-4">
            <h2 className="font-black text-base text-ink mb-3">Nationalités des auteurs (tous temps)</h2>
            <div className="space-y-2.5">
              {topNationsAll.map(([nat, n], i) => (
                <div key={nat} className="flex items-center gap-3">
                  <span className="text-sm font-bold text-ink flex-1 truncate">{nat}</span>
                  <div className="w-28 h-2.5 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${Math.round(n / maxNA * 100)}%`, background: YEAR_COLORS[i % YEAR_COLORS.length] }} />
                  </div>
                  <span className="font-black text-sm text-ink w-5 text-right">{n}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {topNationsAll.length === 0 && luBooks.length > 0 && (
          <div className="card p-4 text-center">
            <p className="text-sm text-gray-400">
              💡 Ajoute la nationalité des auteurs dans les fiches livres pour voir ces stats !
            </p>
          </div>
        )}

        {/* Distribution des notes */}
        <div className="card p-4">
          <h2 className="font-black text-base text-ink mb-3">Distribution des notes</h2>
          <div className="space-y-2">
            {ratings.map(({ r, n }) => (
              <div key={r} className="flex items-center gap-3">
                <span className="text-sm w-20 shrink-0">{'⭐'.repeat(r)}</span>
                <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber rounded-full transition-all duration-700"
                    style={{ width: `${Math.round(n / maxR * 100)}%` }} />
                </div>
                <span className="font-black text-sm text-ink w-5 text-right">{n}</span>
              </div>
            ))}
          </div>
        </div>

        {books.length === 0 && (
          <div className="card p-10 text-center">
            <div className="text-5xl mb-3 animate-float inline-block">📚</div>
            <p className="font-black text-lg text-ink">Pas encore de données</p>
            <p className="text-sm text-gray-400 mt-1">Ajoute des livres pour voir tes stats !</p>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
