'use client'
import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'
import { WishItem, WishPriority, GoogleBook } from '@/types'
import AppLayout from '@/components/layout/AppLayout'
import BottomSheet from '@/components/ui/BottomSheet'
import BookSearch from '@/components/ui/BookSearch'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { Plus, Trash2, Edit2, MapPin, ArrowRight, Search, X } from 'lucide-react'
import { getBestCover, extractYear } from '@/lib/google-books'

const PRIOS: WishPriority[] = ['Haute', 'Moyenne', 'Basse']
const PRIO_STYLE: Record<WishPriority, string> = {
  Haute:   'bg-coral-light text-coral-dark',
  Moyenne: 'bg-amber-light text-amber-dark',
  Basse:   'bg-cyan-light text-cyan-dark',
}
const PRIO_BAR: Record<WishPriority, string> = {
  Haute: 'bg-coral', Moyenne: 'bg-amber', Basse: 'bg-cyan'
}

type WForm = { title:string; author:string; genre:string; priority:WishPriority; where_to_find:string; notes:string; cover_url:string; google_books_id:string; year?:number }
const EMPTY: WForm = { title:'', author:'', genre:'', priority:'Moyenne', where_to_find:'', notes:'', cover_url:'', google_books_id:'' }

function WishlistContent() {
  const supabase = createClient()
  const toast = useToast()
  const [wishes, setWishes] = useState<WishItem[]>([])
  const [allWishes, setAllWishes] = useState<WishItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [prioFilter, setPrioFilter] = useState<WishPriority | ''>('')
  const [showAdd, setShowAdd] = useState(false)
  const [editWish, setEditWish] = useState<WishItem | null>(null)
  const [step, setStep] = useState<'search'|'form'>('search')
  const [form, setForm] = useState<WForm>(EMPTY)

  const loadWishes = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Tous les souhaits pour les compteurs des étiquettes
    const { data: all } = await supabase.from('bibliotheque_wishlist').select('*').eq('user_id', user.id)
    setAllWishes(all || [])

    // Souhaits filtrés pour l'affichage
    let q = supabase.from('bibliotheque_wishlist').select('*').eq('user_id', user.id)
    if (prioFilter) q = q.eq('priority', prioFilter)
    const { data } = await q.order('date_added', { ascending: false })
    setWishes(data || []); setLoading(false)
  }, [prioFilter])

  useEffect(() => { loadWishes() }, [loadWishes])

  const filtered = wishes.filter(w =>
    !query || [w.title, w.author||'', w.where_to_find||'', w.notes||''].some(s => s.toLowerCase().includes(query.toLowerCase()))
  )

  function fromGoogle(book: GoogleBook) {
    setForm({ title:book.title, author:book.authors.join(', '), genre:book.categories?.[0]||'', priority:'Moyenne', where_to_find:'', notes:'', cover_url:getBestCover(book.imageLinks)||'', google_books_id:book.id, year:extractYear(book.publishedDate) })
    setStep('form')
  }

  async function saveWish() {
    if (!form.title.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (editWish) {
      await supabase.from('bibliotheque_wishlist').update({ ...form, user_id: user.id }).eq('id', editWish.id)
      toast('Mis à jour !', 'success'); setEditWish(null)
    } else {
      await supabase.from('bibliotheque_wishlist').insert({ ...form, user_id: user.id })
      toast('Souhait ajouté ✨', 'success'); setShowAdd(false)
    }
    setForm(EMPTY); setStep('search'); loadWishes()
  }

  async function deleteWish(id: string) {
    if (!confirm('Supprimer ?')) return
    await supabase.from('bibliotheque_wishlist').delete().eq('id', id)
    toast('Supprimé', 'info'); loadWishes()
  }

  async function moveToLibrary(w: WishItem) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('bibliotheque_books').insert({ user_id:user.id, title:w.title, author:w.author||'', genre:w.genre, status:'À lire', rating:0, notes:w.notes, cover_url:w.cover_url, google_books_id:w.google_books_id, year:w.year })
    await supabase.from('bibliotheque_wishlist').delete().eq('id', w.id)
    toast('Ajouté à ta bibliothèque ! 📚', 'success'); loadWishes()
  }

  function openEdit(w: WishItem) {
    setForm({ title:w.title, author:w.author||'', genre:w.genre||'', priority:w.priority, where_to_find:w.where_to_find||'', notes:w.notes||'', cover_url:w.cover_url||'', google_books_id:w.google_books_id||'', year:w.year })
    setStep('form'); setEditWish(w)
  }

  const WishForm = () => (
    <div className="space-y-3 pb-2">
      {form.cover_url && (
        <div className="flex justify-center">
          <Image src={form.cover_url} alt={form.title} width={64} height={90} className="rounded-2xl object-cover shadow-card" />
        </div>
      )}
      <div>
        <label className="block text-xs font-black text-gray-500 mb-1">TITRE *</label>
        <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} className="input" placeholder="Titre" />
      </div>
      <div>
        <label className="block text-xs font-black text-gray-500 mb-1">AUTEUR</label>
        <input value={form.author} onChange={e=>setForm(f=>({...f,author:e.target.value}))} className="input" placeholder="Auteur" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-black text-gray-500 mb-1">PRIORITÉ</label>
          <select value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value as WishPriority}))} className="input select">
            {PRIOS.map(p=><option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-black text-gray-500 mb-1">GENRE</label>
          <input value={form.genre} onChange={e=>setForm(f=>({...f,genre:e.target.value}))} className="input" placeholder="Roman…" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-black text-gray-500 mb-1">📍 OÙ LE TROUVER ?</label>
        <input value={form.where_to_find} onChange={e=>setForm(f=>({...f,where_to_find:e.target.value}))} className="input" placeholder="Fnac, bibliothèque, Amazon…" />
      </div>
      <div>
        <label className="block text-xs font-black text-gray-500 mb-1">NOTES</label>
        <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={2} className="input resize-none" placeholder="Recommandé par…" />
      </div>
      <div className="flex gap-3 pt-1">
        <button onClick={()=>{setShowAdd(false);setEditWish(null);setForm(EMPTY);setStep('search')}} className="btn btn-secondary flex-1">Annuler</button>
        <button onClick={saveWish} disabled={!form.title.trim()} className="btn btn-primary flex-[2] py-3 disabled:opacity-50">💾 Enregistrer</button>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">

      {/* Barre de recherche — style inline pour éviter chevauchement icône */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
        <input
          value={query}
          onChange={e=>setQuery(e.target.value)}
          placeholder="Rechercher un souhait…"
          style={{ paddingLeft: '2.25rem' }}
          className="input pr-9 py-2.5 text-sm"
        />
        {query && (
          <button onClick={()=>setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X size={15} className="text-gray-400"/>
          </button>
        )}
      </div>

      {/* Priority filter — py-1 pour que les pills ne soient pas rognées */}
      <div className="-mt-2 flex gap-2 overflow-x-auto py-1 -mx-4 px-4">
        <button onClick={()=>setPrioFilter('')}
          className={`flex-shrink-0 px-4 py-2 rounded-pill font-black text-sm transition-all ${prioFilter===''?'bg-pink text-white shadow-glow-pink':'bg-white text-gray-500 shadow-sm'}`}>
          Tous · {allWishes.length}
        </button>
        {PRIOS.map(p=>(
          <button key={p} onClick={()=>setPrioFilter(prioFilter===p?'':p)}
            className={`flex-shrink-0 px-4 py-2 rounded-pill font-black text-sm transition-all whitespace-nowrap ${
              prioFilter===p ? `${PRIO_STYLE[p]} shadow-card ring-2 ring-offset-1 ring-current` : 'bg-white text-gray-500 shadow-sm'
            }`}>
            {p} · {allWishes.filter(w=>w.priority===p).length}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i=><div key={i} className="card h-20 animate-pulse bg-gray-50"/>)}
        </div>
      ) : filtered.length===0 ? (
        <div className="card p-10 text-center">
          <div className="text-5xl mb-3 animate-float inline-block">{allWishes.length===0?'✨':'🔍'}</div>
          <p className="font-black text-lg text-ink">{allWishes.length===0?'Liste vide !':'Aucun résultat'}</p>
          <p className="text-sm text-gray-400 mt-1">{allWishes.length===0?'Ajoutez vos envies de lecture !':'Autre filtre ?'}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(w=>(
            <div key={w.id} className="card overflow-hidden">
              <div className="flex">
                <div className={`w-1.5 flex-shrink-0 ${PRIO_BAR[w.priority]}`}/>
                <div className="flex-1 p-3.5 min-w-0">
                  <div className="flex items-start gap-3">
                    {w.cover_url && <Image src={w.cover_url} alt={w.title} width={40} height={56} className="rounded-xl object-cover flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm text-ink line-clamp-1">{w.title}</p>
                      <p className="text-xs text-gray-500 font-semibold">{w.author||'Auteur inconnu'}</p>
                      <div className="flex gap-2 mt-1.5 flex-wrap items-center">
                        <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${PRIO_STYLE[w.priority]}`}>{w.priority}</span>
                        {w.genre && <span className="text-[11px] text-gray-400">{w.genre}</span>}
                      </div>
                      {w.where_to_find && <div className="flex items-center gap-1 mt-1 text-[11px] text-gray-400 font-semibold"><MapPin size={10}/>{w.where_to_find}</div>}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col border-l border-gray-100 flex-shrink-0">
                  <button onClick={()=>openEdit(w)} className="flex-1 px-3 hover:bg-amber-light transition-colors flex items-center justify-center"><Edit2 size={14} className="text-amber-dark"/></button>
                  <button onClick={()=>moveToLibrary(w)} className="flex-1 px-3 hover:bg-mint-light transition-colors flex items-center justify-center border-t border-b border-gray-100"><ArrowRight size={14} className="text-mint-dark"/></button>
                  <button onClick={()=>deleteWish(w.id)} className="flex-1 px-3 hover:bg-red-50 transition-colors flex items-center justify-center"><Trash2 size={14} className="text-red-400"/></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button onClick={()=>{setForm(EMPTY);setStep('search');setShowAdd(true)}}
        className="fixed bottom-20 right-4 z-30 w-14 h-14 rounded-full bg-gradient-to-br from-pink to-coral text-white shadow-glow-pink flex items-center justify-center hover:scale-110 active:scale-95 transition-transform">
        <Plus size={28}/>
      </button>

      <BottomSheet open={showAdd||!!editWish} onClose={()=>{setShowAdd(false);setEditWish(null);setForm(EMPTY);setStep('search')}} title={editWish?'Modifier le souhait':'Ajouter un souhait ✨'}>
        {step==='search'&&!editWish ? (
          <div>
            <BookSearch onSelect={fromGoogle} onManual={()=>setStep('form')} mode="wishlist"/>
            <button onClick={()=>setShowAdd(false)} className="mt-2 btn btn-ghost w-full">Annuler</button>
          </div>
        ) : <WishForm/>}
      </BottomSheet>
    </div>
  )
}

export default function WishlistPage() {
  return <ToastProvider><AppLayout><WishlistContent/></AppLayout></ToastProvider>
}
