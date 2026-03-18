'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import BottomSheet from '@/components/ui/BottomSheet'
import { Search, UserPlus, Check, X, ChevronRight, ArrowLeft, MapPin } from 'lucide-react'
import Image from 'next/image'

interface FriendProfile {
  id: string
  email: string
  full_name?: string
  username?: string
  avatar_url?: string
}

interface Friendship {
  id: string
  requester_id: string
  addressee_id: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
  profile?: FriendProfile
}

interface WishItem {
  id: string
  title: string
  author?: string
  cover_url?: string
  priority: string
  where_to_find?: string
  genre?: string
  year?: number
  notes?: string
}

const PRIO_STYLE: Record<string, string> = {
  Haute:   'bg-coral-light text-coral-dark',
  Moyenne: 'bg-amber-light text-amber-dark',
  Basse:   'bg-cyan-light text-cyan-dark',
}
const PRIO_BAR: Record<string, string> = {
  Haute: 'bg-coral', Moyenne: 'bg-amber', Basse: 'bg-cyan'
}

function FriendsContent() {
  const supabase = createClient()
  const toast = useToast()

  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [friends, setFriends] = useState<Friendship[]>([])
  const [pendingReceived, setPendingReceived] = useState<Friendship[]>([])
  const [pendingSent, setPendingSent] = useState<Friendship[]>([])
  const [loading, setLoading] = useState(true)

  // Recherche
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FriendProfile[]>([])
  const [searching, setSearching] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  // Vue wishlist ami
  const [viewingFriend, setViewingFriend] = useState<FriendProfile | null>(null)
  const [friendWishlist, setFriendWishlist] = useState<WishItem[]>([])
  const [loadingWishlist, setLoadingWishlist] = useState(false)

  const loadFriendships = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setCurrentUserId(user.id)

    const { data } = await supabase
      .from('bibliotheque_friendships')
      .select('*')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    if (!data) { setLoading(false); return }

    // Récupérer les profils des amis
    const enriched = await Promise.all(data.map(async (f) => {
      const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id
      const { data: profile } = await supabase
        .from('bibliotheque_public_profiles')
        .select('*')
        .eq('id', otherId)
        .single()
      return { ...f, profile: profile || undefined }
    }))

    setFriends(enriched.filter(f => f.status === 'accepted'))
    setPendingReceived(enriched.filter(f => f.status === 'pending' && f.addressee_id === user.id))
    setPendingSent(enriched.filter(f => f.status === 'pending' && f.requester_id === user.id))
    setLoading(false)
  }, [])

  useEffect(() => { loadFriendships() }, [loadFriendships])

  async function searchUsers() {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const { data } = await supabase
        .from('bibliotheque_public_profiles')
        .select('*')
        .or(`email.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`)
        .neq('id', currentUserId)
        .limit(10)
      setSearchResults(data || [])
    } catch { setSearchResults([]) }
    setSearching(false)
  }

  async function sendRequest(addresseeId: string) {
    const { error } = await supabase.from('bibliotheque_friendships').insert({
      requester_id: currentUserId,
      addressee_id: addresseeId,
      status: 'pending',
    })
    if (error) {
      toast('Demande déjà envoyée ou erreur', 'error')
    } else {
      toast('Demande envoyée ! 📨', 'success')
      setShowSearch(false)
      setSearchQuery('')
      setSearchResults([])
      loadFriendships()
    }
  }

  async function acceptRequest(friendshipId: string) {
    await supabase.from('bibliotheque_friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId)
    toast('Ami ajouté ! 🎉', 'success')
    loadFriendships()
  }

  async function declineRequest(friendshipId: string) {
    await supabase.from('bibliotheque_friendships')
      .update({ status: 'declined' })
      .eq('id', friendshipId)
    toast('Demande refusée', 'info')
    loadFriendships()
  }

  async function removeFriend(friendshipId: string) {
    if (!confirm('Retirer cet ami ?')) return
    await supabase.from('bibliotheque_friendships').delete().eq('id', friendshipId)
    toast('Ami retiré', 'info')
    loadFriendships()
  }

  async function viewWishlist(friend: FriendProfile) {
    setViewingFriend(friend)
    setLoadingWishlist(true)
    const { data } = await supabase
      .from('bibliotheque_wishlist')
      .select('*')
      .eq('user_id', friend.id)
      .order('date_added', { ascending: false })
    setFriendWishlist(data || [])
    setLoadingWishlist(false)
  }

  function getDisplayName(profile?: FriendProfile) {
    if (!profile) return 'Utilisateur'
    return profile.full_name || profile.username || profile.email?.split('@')[0] || 'Utilisateur'
  }

  function getInitials(profile?: FriendProfile) {
    const name = getDisplayName(profile)
    return name.slice(0, 2).toUpperCase()
  }

  // ── Vue wishlist d'un ami ──
  if (viewingFriend) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setViewingFriend(null)}
            className="w-9 h-9 rounded-2xl bg-white shadow-sm flex items-center justify-center hover:bg-gray-50 transition-colors flex-shrink-0">
            <ArrowLeft size={18} className="text-gray-500"/>
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-violet to-pink flex items-center justify-center text-white font-black text-sm flex-shrink-0">
              {getInitials(viewingFriend)}
            </div>
            <div className="min-w-0">
              <p className="font-black text-base text-ink truncate">
                Souhaits de {getDisplayName(viewingFriend)}
              </p>
              <p className="text-xs text-gray-400">{friendWishlist.length} souhait{friendWishlist.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>

        {loadingWishlist ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="card h-20 animate-pulse bg-gray-50"/>)}
          </div>
        ) : friendWishlist.length === 0 ? (
          <div className="card p-10 text-center">
            <div className="text-5xl mb-3 animate-float inline-block">✨</div>
            <p className="font-black text-lg text-ink">Liste vide !</p>
            <p className="text-sm text-gray-400 mt-1">{getDisplayName(viewingFriend)} n'a pas encore de souhaits</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {friendWishlist.map(w => (
              <div key={w.id} className="card overflow-hidden">
                <div className="flex">
                  <div className={`w-1.5 flex-shrink-0 ${PRIO_BAR[w.priority] || 'bg-gray-200'}`}/>
                  <div className="flex-1 p-3.5 min-w-0">
                    <div className="flex items-start gap-3">
                      {w.cover_url && (
                        <Image src={w.cover_url} alt={w.title} width={40} height={56} className="rounded-xl object-cover flex-shrink-0"/>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm text-ink line-clamp-1">{w.title}</p>
                        <p className="text-xs text-gray-500 font-semibold">{w.author || 'Auteur inconnu'}</p>
                        <div className="flex gap-2 mt-1.5 flex-wrap items-center">
                          <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${PRIO_STYLE[w.priority] || 'bg-gray-100 text-gray-500'}`}>
                            {w.priority}
                          </span>
                          {w.genre && <span className="text-[11px] text-gray-400">{w.genre}</span>}
                        </div>
                        {w.where_to_find && (
                          <div className="flex items-center gap-1 mt-1 text-[11px] text-gray-400 font-semibold">
                            <MapPin size={10}/>{w.where_to_find}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Vue principale amis ──
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-black text-2xl text-ink">Mes amis 👥</h1>
        <button onClick={() => setShowSearch(true)}
          className="btn btn-primary py-2 px-4 text-sm">
          <UserPlus size={15}/> Ajouter
        </button>
      </div>

      {/* Demandes reçues */}
      {pendingReceived.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-black text-gray-500 uppercase tracking-wide">
            Demandes reçues · {pendingReceived.length}
          </p>
          {pendingReceived.map(f => (
            <div key={f.id} className="card p-4 bg-violet-light">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet to-pink flex items-center justify-center text-white font-black flex-shrink-0">
                  {getInitials(f.profile)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm text-ink">{getDisplayName(f.profile)}</p>
                  <p className="text-xs text-gray-500">{f.profile?.email}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => acceptRequest(f.id)}
                    className="w-8 h-8 rounded-xl bg-mint text-white flex items-center justify-center hover:opacity-80 transition-opacity">
                    <Check size={15}/>
                  </button>
                  <button onClick={() => declineRequest(f.id)}
                    className="w-8 h-8 rounded-xl bg-gray-200 text-gray-500 flex items-center justify-center hover:bg-gray-300 transition-colors">
                    <X size={15}/>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Demandes envoyées */}
      {pendingSent.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-black text-gray-500 uppercase tracking-wide">
            En attente · {pendingSent.length}
          </p>
          {pendingSent.map(f => (
            <div key={f.id} className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center font-black text-gray-400 flex-shrink-0">
                  {getInitials(f.profile)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm text-ink">{getDisplayName(f.profile)}</p>
                  <p className="text-xs text-gray-400">Demande envoyée…</p>
                </div>
                <span className="text-[11px] font-black px-2 py-1 rounded-full bg-amber-light text-amber-dark flex-shrink-0">
                  En attente
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Liste d'amis */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="card h-16 animate-pulse bg-gray-50"/>)}
        </div>
      ) : friends.length === 0 && pendingReceived.length === 0 && pendingSent.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-5xl mb-3 animate-float inline-block">👥</div>
          <p className="font-black text-lg text-ink">Aucun ami pour l'instant</p>
          <p className="text-sm text-gray-400 mt-1">Ajoutez des amis pour voir leurs souhaits !</p>
        </div>
      ) : friends.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-black text-gray-500 uppercase tracking-wide">
            Amis · {friends.length}
          </p>
          {friends.map(f => (
            <button key={f.id} onClick={() => f.profile && viewWishlist(f.profile)}
              className="card w-full p-4 flex items-center gap-3 text-left hover:bg-bg-base transition-colors">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet to-pink flex items-center justify-center text-white font-black flex-shrink-0">
                {getInitials(f.profile)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm text-ink">{getDisplayName(f.profile)}</p>
                <p className="text-xs text-gray-400">Voir la wishlist →</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <ChevronRight size={16} className="text-gray-300"/>
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {/* Sheet recherche */}
      <BottomSheet open={showSearch} onClose={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]) }}
        title="Ajouter un ami">
        <div className="space-y-3 pb-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10"/>
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchUsers()}
                placeholder="Email, pseudo ou nom…"
                style={{ paddingLeft: '2.25rem' }} className="input text-sm py-2.5"/>
            </div>
            <button onClick={searchUsers} disabled={!searchQuery.trim() || searching}
              className="btn btn-primary px-4 py-2.5 disabled:opacity-50 flex-shrink-0">
              {searching ? '⏳' : <Search size={16}/>}
            </button>
          </div>

          {searching && (
            <div className="space-y-2">
              {[1,2].map(i => (
                <div key={i} className="flex gap-3 p-3 rounded-2xl bg-gray-50 animate-pulse">
                  <div className="w-10 h-10 rounded-2xl bg-gray-200 flex-shrink-0"/>
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-3 bg-gray-200 rounded-full w-1/2"/>
                    <div className="h-3 bg-gray-200 rounded-full w-1/3"/>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!searching && searchResults.length === 0 && searchQuery && (
            <div className="text-center py-6">
              <p className="font-black text-ink">😕 Aucun résultat</p>
              <p className="text-sm text-gray-400 mt-1">Vérifiez l'email ou le pseudo</p>
            </div>
          )}

          {searchResults.map(profile => {
            const alreadyFriend = friends.some(f => f.profile?.id === profile.id)
            const alreadySent = pendingSent.some(f => f.profile?.id === profile.id)
            const pendingFromThem = pendingReceived.some(f => f.profile?.id === profile.id)

            return (
              <div key={profile.id} className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet to-pink flex items-center justify-center text-white font-black flex-shrink-0">
                  {getInitials(profile)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm text-ink">{getDisplayName(profile)}</p>
                  <p className="text-xs text-gray-400">{profile.email}</p>
                </div>
                {alreadyFriend ? (
                  <span className="text-[11px] font-black px-2 py-1 rounded-full bg-mint-light text-mint-dark flex-shrink-0">Ami ✓</span>
                ) : alreadySent ? (
                  <span className="text-[11px] font-black px-2 py-1 rounded-full bg-amber-light text-amber-dark flex-shrink-0">En attente</span>
                ) : pendingFromThem ? (
                  <span className="text-[11px] font-black px-2 py-1 rounded-full bg-violet-light text-violet flex-shrink-0">Demande reçue</span>
                ) : (
                  <button onClick={() => sendRequest(profile.id)}
                    className="w-8 h-8 rounded-xl bg-violet text-white flex items-center justify-center hover:bg-violet-dark transition-colors flex-shrink-0">
                    <UserPlus size={15}/>
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </BottomSheet>
    </div>
  )
}

export default function FriendsPage() {
  return <ToastProvider><AppLayout><FriendsContent/></AppLayout></ToastProvider>
}
