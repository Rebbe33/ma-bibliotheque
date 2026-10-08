'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { Plus, Trash2, BookOpen, Flame, TrendingUp } from 'lucide-react'

interface ReadingSession {
  id: string
  book_id?: string
  date: string
  pages: number
  moment?: string
  created_at: string
  book?: { title: string }
}

interface Book { id: string; title: string; status: string }

const MOMENTS = ['Matin', 'Après-midi', 'Soir', 'Nuit']
const MOMENT_EMOJI: Record<string, string> = {
  'Matin': '🌅', 'Après-midi': '☀️', 'Soir': '🌙', 'Nuit': '⭐'
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function formatDate(d: Date) {
  return d.toISOString().split('T')[0]
}

function ReadingContent() {
  const supabase = createClient()
  const toast = useToast()

  const today = new Date()
  const [viewDate, setViewDate] = useState({ year: today.getFullYear(), month: today.getMonth() })
  const [sessions, setSessions] = useState<ReadingSession[]>([])
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({
    date: formatDate(today),
    pages: '',
    moment: 'Soir',
    book_id: '',
  })

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const startOfMonth = `${viewDate.year}-${String(viewDate.month + 1).padStart(2, '0')}-01`
    const endOfMonth = `${viewDate.year}-${String(viewDate.month + 1).padStart(2, '0')}-${getDaysInMonth(viewDate.year, viewDate.month)}`

    const [{ data: sessionData }, { data: bookData }] = await Promise.all([
      supabase.from('bibliotheque_reading_sessions')
        .select('*, book:bibliotheque_books(title)')
        .eq('user_id', user.id)
        .gte('date', startOfMonth)
        .lte('date', endOfMonth)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('bibliotheque_books')
        .select('id, title, status')
        .eq('user_id', user.id)
        .in('status', ['En cours', 'Lu'])
        .order('title'),
    ])

    setSessions((sessionData || []) as ReadingSession[])
    setBooks((bookData || []) as Book[])
    setLoading(false)
  }, [viewDate, supabase])

  useEffect(() => { loadData() }, [loadData])

  async function addSession() {
    if (!form.pages || parseInt(form.pages) <= 0) { toast('Nombre de pages invalide', 'error'); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('bibliotheque_reading_sessions').insert({
      user_id: user.id,
      date: form.date,
      pages: parseInt(form.pages),
      moment: form.moment,
      book_id: form.book_id || null,
    })
    toast('Session ajoutée ! 📖', 'success')
    setForm({ date: formatDate(today), pages: '', moment: 'Soir', book_id: '' })
    setShowAdd(false)
    loadData()
  }

  async function deleteSession(id: string) {
    if (!confirm('Supprimer cette session ?')) return
    await supabase.from('bibliotheque_reading_sessions').delete().eq('id', id)
    toast('Session supprimée', 'info')
    loadData()
  }

  // Calculs stats
  const daysInMonth = getDaysInMonth(viewDate.year, viewDate.month)
  const pagesByDay: Record<string, number> = {}
  sessions.forEach(s => {
    pagesByDay[s.date] = (pagesByDay[s.date] || 0) + s.pages
  })

  const totalPagesMonth = Object.values(pagesByDay).reduce((a, b) => a + b, 0)
  const readingDays = Object.keys(pagesByDay).length
  const avgPages = readingDays > 0 ? Math.round(totalPagesMonth / readingDays) : 0
  const maxPages = Math.max(...Object.values(pagesByDay), 1)
  const bestDay = Object.entries(pagesByDay).sort((a, b) => b[1] - a[1])[0]

  function calcStreak() {
    let streak = 0
    const d = new Date(today)
    while (true) {
      const key = formatDate(d)
      if (pagesByDay[key]) { streak++; d.setDate(d.getDate() - 1) }
      else break
    }
    return streak
  }
  const streak = calcStreak()

  const todaySessions = sessions.filter(s => s.date === formatDate(today))
  const todayPages = todaySessions.reduce((a, s) => a + s.pages, 0)

  const MONTH_NAMES = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1
    const key = `${viewDate.year}-${String(viewDate.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    return { day: d, pages: pagesByDay[key] || 0, key }
  })

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-black text-2xl text-ink">Journal 📖</h1>
        <button onClick={() => setShowAdd(!showAdd)} className="btn btn-primary py-2 px-4 text-sm flex items-center gap-1.5">
          <Plus size={15}/> Session
        </button>
      </div>

      {/* Formulaire ajout */}
      {showAdd && (
        <div className="card p-4 space-y-3 bg-gradient-to-br from-violet-light to-pink-light">
          <p className="font-black text-sm text-ink">Nouvelle session de lecture</p>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-black text-gray-500 mb-1">DATE</label>
              <input type="date" value={form.date}
                onChange={e => setForm(f => ({...f, date: e.target.value}))}
                className="input text-sm"/>
            </div>
            <div>
              <label className="block text-xs font-black text-gray-500 mb-1">PAGES LUES</label>
              <input type="number" value={form.pages} min="1"
                onChange={e => setForm(f => ({...f, pages: e.target.value}))}
                placeholder="ex: 45" className="input text-sm"/>
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-gray-500 mb-1.5">MOMENT</label>
            <div className="flex gap-1.5">
              {MOMENTS.map(m => (
                <button key={m} onClick={() => setForm(f => ({...f, moment: m}))}
                  className={`flex-1 py-2 rounded-2xl font-black text-xs transition-all ${
                    form.moment === m ? 'bg-violet text-white shadow-sm' : 'bg-white text-gray-500'
                  }`}>
                  {MOMENT_EMOJI[m]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-gray-500 mb-1">LIVRE (optionnel)</label>
            <select value={form.book_id} onChange={e => setForm(f => ({...f, book_id: e.target.value}))}
              className="input text-sm">
              <option value="">— Aucun livre sélectionné —</option>
              {books.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
            </select>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setShowAdd(false)} className="btn btn-ghost flex-1">Annuler</button>
            <button onClick={addSession} disabled={!form.pages}
              className="btn btn-primary flex-[2] py-2.5 disabled:opacity-50">
              ✓ Enregistrer
            </button>
          </div>
        </div>
      )}

      {/* Stats du jour */}
      <div className="card p-4 bg-gradient-to-br from-violet to-pink text-white">
        <p className="font-bold text-white/70 text-xs">AUJOURD'HUI</p>
        <div className="flex items-end gap-2 mt-1">
          <p className="font-black text-5xl">{todayPages}</p>
          <p className="font-bold text-white/80 mb-1">pages</p>
        </div>
        <p className="text-white/70 text-xs mt-1">
          {todaySessions.length} session{todaySessions.length !== 1 ? 's' : ''}
          {todaySessions.length > 0 && ` · ${todaySessions.map(s => MOMENT_EMOJI[s.moment || '']).join(' ')}`}
        </p>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="card p-3 text-center">
          <Flame size={18} className="mx-auto mb-1 text-coral"/>
          <p className="font-black text-xl text-ink">{streak}</p>
          <p className="text-[10px] font-bold text-gray-400">JOURS DE SUITE</p>
        </div>
        <div className="card p-3 text-center">
          <TrendingUp size={18} className="mx-auto mb-1 text-violet"/>
          <p className="font-black text-xl text-ink">{avgPages}</p>
          <p className="text-[10px] font-bold text-gray-400">MOY. PAR JOUR</p>
        </div>
        <div className="card p-3 text-center">
          <BookOpen size={18} className="mx-auto mb-1 text-mint"/>
          <p className="font-black text-xl text-ink">{totalPagesMonth}</p>
          <p className="text-[10px] font-bold text-gray-400">CE MOIS</p>
        </div>
      </div>

      {/* Graphique pages par jour */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-black text-base text-ink">
            {MONTH_NAMES[viewDate.month]} {viewDate.year}
          </h2>
          <div className="flex gap-1">
            <button onClick={() => setViewDate(v => {
              const d = new Date(v.year, v.month - 1)
              return { year: d.getFullYear(), month: d.getMonth() }
            })} className="w-7 h-7 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors text-sm">‹</button>
            <button onClick={() => setViewDate(v => {
              const d = new Date(v.year, v.month + 1)
              return { year: d.getFullYear(), month: d.getMonth() }
            })} className="w-7 h-7 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors text-sm">›</button>
          </div>
        </div>

        <div className="flex items-end gap-0.5 h-28">
          {days.map(({ day, pages }) => {
            const pct = maxPages > 0 ? pages / maxPages : 0
            const isToday = day === today.getDate() &&
              viewDate.month === today.getMonth() &&
              viewDate.year === today.getFullYear()
            return (
              <div key={day} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="w-full flex flex-col justify-end" style={{ height: '88px' }}>
                  <div
                    className={`w-full rounded-t transition-all duration-500 ${
                      pages > 0 ? (isToday ? 'bg-pink' : 'bg-violet') : 'bg-gray-100'
                    }`}
                    style={{ height: pages > 0 ? `${Math.max(pct * 88, 4)}px` : '4px' }}
                  />
                </div>
                <span className={`text-[8px] font-black ${isToday ? 'text-pink' : 'text-gray-400'}`}>
                  {day}
                </span>
              </div>
            )
          })}
        </div>

        {bestDay && (
          <p className="text-xs text-gray-400 font-semibold mt-2 text-center">
            🏆 Meilleur jour : {new Date(bestDay[0] + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · {bestDay[1]} pages
          </p>
        )}
      </div>

      {/* Sessions du mois */}
      <div>
        <h2 className="font-black text-base text-ink mb-2">Sessions du mois</h2>
        {loading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="card h-14 animate-pulse bg-gray-50"/>)}
          </div>
        ) : sessions.length === 0 ? (
          <div className="card p-8 text-center">
            <div className="text-4xl mb-2">📖</div>
            <p className="font-black text-ink">Aucune session ce mois</p>
            <p className="text-sm text-gray-400 mt-1">Ajoute ta première session !</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map(s => (
              <div key={s.id} className="card flex items-center gap-3 p-3">
                <div className="w-10 h-10 rounded-2xl bg-violet-light flex items-center justify-center flex-shrink-0 text-lg">
                  {MOMENT_EMOJI[s.moment || ''] || '📖'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-ink">{s.pages} pages</span>
                    {s.moment && <span className="text-xs text-gray-400">{s.moment}</span>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400">
                      {new Date(s.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                    {s.book && <span className="text-xs text-violet font-bold truncate">· {(s.book as any).title}</span>}
                  </div>
                </div>
                <button onClick={() => deleteSession(s.id)}
                  className="w-7 h-7 rounded-xl bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-100 transition-colors flex-shrink-0">
                  <Trash2 size={12}/>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ReadingPage() {
  return <ToastProvider><AppLayout><ReadingContent/></AppLayout></ToastProvider>
}
