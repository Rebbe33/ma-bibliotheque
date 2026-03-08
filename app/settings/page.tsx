'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { Book, WishItem } from '@/types'
import { Download, Upload, LogOut, User, BookOpen, Heart } from 'lucide-react'
import { useRouter } from 'next/navigation'

function SettingsContent() {
  const supabase = createClient()
  const toast = useToast()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [bookCount, setBookCount] = useState(0)
  const [wishCount, setWishCount] = useState(0)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (!user) return
      const [{ count: bc }, { count: wc }] = await Promise.all([
        supabase.from('books').select('*', { count:'exact', head:true }).eq('user_id', user.id),
        supabase.from('wishlist').select('*', { count:'exact', head:true }).eq('user_id', user.id),
      ])
      setBookCount(bc || 0); setWishCount(wc || 0)
    }
    load()
  }, [])

  async function exportJSON() {
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u) return
    const [{ data: books }, { data: wishes }] = await Promise.all([
      supabase.from('books').select('*').eq('user_id', u.id),
      supabase.from('wishlist').select('*').eq('user_id', u.id),
    ])
    const blob = new Blob([JSON.stringify({ version:2, exportDate:new Date().toISOString(), books, wishes }, null, 2)], { type:'application/json' })
    const d = new Date()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `bibliotheque_${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}.json`
    document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 1000)
    toast('Export téléchargé ! 📦', 'success')
  }

  async function exportCSV() {
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u) return
    const { data: books } = await supabase.from('books').select('*').eq('user_id', u.id)
    const cols = ['Titre','Auteur','Genre','Année','Statut','Pages','Éditeur','ISBN','Série','N° Série','Note','Notes']
    const rows = (books||[]).map((b:Book) => [b.title,b.author,b.genre||'',b.year||'',b.status,b.pages||'',b.publisher||'',b.isbn||'',b.series_name||'',b.series_number||'',b.rating||'',b.notes||''].map(v=>`"${String(v).replace(/"/g,'""')}"`))
    const csv = [cols.map(c=>`"${c}"`).join(','), ...rows.map(r=>r.join(','))].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8' }))
    a.download = 'bibliotheque.csv'
    document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 1000)
    toast('CSV exporté ! 📊', 'success')
  }

  async function importJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u) return
    try {
      const data = JSON.parse(await file.text())
      const books: Book[] = Array.isArray(data) ? data : (data.books || [])
      const wishes: WishItem[] = data.wishes || []
      if (!confirm(`Importer ${books.length} livre${books.length!==1?'s':''} et ${wishes.length} souhait${wishes.length!==1?'s':''} ? Ils s'ajouteront à vos données existantes.`)) return
      for (const b of books) { const { id, ...rest } = b; await supabase.from('books').insert({ ...rest, user_id: u.id }) }
      for (const w of wishes) { const { id, ...rest } = w; await supabase.from('wishlist').insert({ ...rest, user_id: u.id }) }
      toast(`${books.length} livres importés ! ✅`, 'success')
      const [{ count: bc }, { count: wc }] = await Promise.all([
        supabase.from('books').select('*', { count:'exact', head:true }).eq('user_id', u.id),
        supabase.from('wishlist').select('*', { count:'exact', head:true }).eq('user_id', u.id),
      ])
      setBookCount(bc||0); setWishCount(wc||0)
    } catch { toast('Fichier invalide ❌', 'error') }
    e.target.value = ''
  }

  const username = user?.user_metadata?.username || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Lecteur'
  const initials = username.slice(0,2).toUpperCase()

  return (
    <div className="space-y-5 pb-8">
      <h1 className="font-display font-black text-2xl text-ink">Réglages ⚙️</h1>

      {/* Profile */}
      <div className="card p-5 bg-gradient-to-br from-violet-light to-pink-light">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-violet to-pink flex items-center justify-center text-white font-black text-xl shadow-glow">
            {initials}
          </div>
          <div>
            <p className="font-black text-lg text-ink">{username}</p>
            <p className="text-sm text-gray-500 font-semibold">{user?.email}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-white rounded-2xl p-3 flex items-center gap-2.5 shadow-sm">
            <BookOpen size={18} className="text-violet flex-shrink-0"/>
            <div>
              <p className="font-black text-xl text-ink leading-none">{bookCount}</p>
              <p className="text-[11px] font-bold text-gray-400">livres</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-3 flex items-center gap-2.5 shadow-sm">
            <Heart size={18} className="text-pink flex-shrink-0"/>
            <div>
              <p className="font-black text-xl text-ink leading-none">{wishCount}</p>
              <p className="text-[11px] font-bold text-gray-400">souhaits</p>
            </div>
          </div>
        </div>
      </div>

      {/* Export */}
      <div>
        <h2 className="font-black text-base text-ink mb-3">📤 Exporter</h2>
        <div className="card divide-y divide-gray-50">
          {[
            { label:'Sauvegarde JSON', desc:'Livres + souhaits · réimportable', icon:'📦', action:exportJSON },
            { label:'Export CSV', desc:'Bibliothèque uniquement · Excel', icon:'📊', action:exportCSV },
          ].map(({ label, desc, icon, action }) => (
            <button key={label} onClick={action} className="w-full flex items-center gap-4 p-4 text-left hover:bg-bg-base transition-colors">
              <span className="text-2xl flex-shrink-0">{icon}</span>
              <div className="flex-1">
                <p className="font-black text-sm text-ink">{label}</p>
                <p className="text-xs text-gray-400 font-semibold mt-0.5">{desc}</p>
              </div>
              <Download size={16} className="text-gray-300 flex-shrink-0"/>
            </button>
          ))}
        </div>
      </div>

      {/* Import */}
      <div>
        <h2 className="font-black text-base text-ink mb-3">📥 Importer</h2>
        <label className="block card p-6 text-center cursor-pointer hover:bg-bg-base transition-colors border-2 border-dashed border-violet-mid rounded-2xl">
          <Upload size={28} className="mx-auto mb-2 text-violet"/>
          <p className="font-black text-sm text-ink">Choisir un fichier JSON</p>
          <p className="text-xs text-gray-400 font-semibold mt-1">S'ajoute à vos données existantes</p>
          <input type="file" accept=".json" onChange={importJSON} className="hidden"/>
        </label>
      </div>

      {/* Sign out */}
      <div>
        <h2 className="font-black text-base text-ink mb-3">Compte</h2>
        <button onClick={async () => { await supabase.auth.signOut(); router.push('/auth') }}
          className="card w-full flex items-center gap-4 p-4 text-left hover:bg-red-50 transition-colors group">
          <div className="w-10 h-10 rounded-2xl bg-red-50 group-hover:bg-red-100 flex items-center justify-center transition-colors">
            <LogOut size={18} className="text-red-400"/>
          </div>
          <div>
            <p className="font-black text-sm text-red-500">Se déconnecter</p>
            <p className="text-xs text-gray-400 font-semibold">Retour à la page de connexion</p>
          </div>
        </button>
      </div>

      {/* Info */}
      <div className="bg-violet-light rounded-3xl p-4">
        <p className="text-sm font-semibold text-violet-dark leading-relaxed">
          💡 <strong>Sauvegarde automatique</strong> — chaque modification est instantanément sauvegardée. Exportez en JSON régulièrement pour une copie locale.
        </p>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return <ToastProvider><AppLayout><SettingsContent/></AppLayout></ToastProvider>
}
