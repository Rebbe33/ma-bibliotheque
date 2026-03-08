'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { BookOpen, Mail, Lock, User, ArrowRight } from 'lucide-react'

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(''); setSuccess('')
    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { username: username || email.split('@')[0] } }
      })
      if (error) setError(error.message)
      else setSuccess('🎉 Compte créé ! Vérifiez vos emails pour confirmer.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message === 'Invalid login credentials' ? 'Email ou mot de passe incorrect.' : error.message)
      else router.push('/library')
    }
    setLoading(false)
  }

  async function handleGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    })
    if (error) setError(error.message)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{
      background: 'linear-gradient(135deg, #f5f3ff 0%, #fce7f3 50%, #cffafe 100%)'
    }}>
      {/* Floating deco blobs */}
      <div className="fixed top-10 left-6 w-24 h-24 rounded-full bg-violet/20 blur-2xl pointer-events-none animate-float" />
      <div className="fixed bottom-20 right-6 w-32 h-32 rounded-full bg-pink/20 blur-2xl pointer-events-none animate-float" style={{ animationDelay:'1.5s' }} />
      <div className="fixed top-1/2 right-10 w-20 h-20 rounded-full bg-cyan/20 blur-2xl pointer-events-none animate-float" style={{ animationDelay:'0.8s' }} />

      <div className="w-full max-w-sm relative">
        {/* Logo */}
        <div className="text-center mb-8 animate-pop-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-4xl bg-gradient-to-br from-violet to-pink shadow-glow mb-4 mx-auto">
            <BookOpen size={36} className="text-white" />
          </div>
          <h1 className="font-display font-black text-3xl text-ink">Ma <span className="text-violet">Biblio</span></h1>
          <p className="text-gray-500 text-sm mt-1 font-semibold">
            {mode === 'login' ? 'Bienvenue de retour ! 👋' : 'Rejoins la communauté lecteurs ! 🎉'}
          </p>
        </div>

        {/* Card */}
        <div className="card p-6 shadow-float animate-slide-up">
          {/* Mode toggle */}
          <div className="flex p-1 bg-violet-light rounded-2xl mb-6">
            {(['login','signup'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); setSuccess('') }}
                className={`flex-1 py-2 rounded-xl font-black text-sm transition-all duration-200 ${
                  mode === m
                    ? 'bg-white text-violet shadow-card'
                    : 'text-gray-500 hover:text-violet'
                }`}
              >
                {m === 'login' ? 'Connexion' : 'Inscription'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Ton pseudo" className="input pl-10" />
              </div>
            )}
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required className="input pl-10" />
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mot de passe" required minLength={6} className="input pl-10" />
            </div>

            {error   && <div className="bg-red-50 text-red-600 rounded-2xl p-3 text-sm font-semibold">⚠️ {error}</div>}
            {success && <div className="bg-green-50 text-green-600 rounded-2xl p-3 text-sm font-semibold">{success}</div>}

            <button type="submit" disabled={loading} className="btn btn-primary w-full py-3 text-base disabled:opacity-60">
              {loading ? '⏳ Chargement...' : mode === 'login' ? <>Se connecter <ArrowRight size={16}/></> : <>Créer mon compte <ArrowRight size={16}/></>}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-gray-400 text-xs font-bold">OU</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* Google */}
          <button onClick={handleGoogle} className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white border-2 border-gray-100 rounded-2xl font-bold text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-200 transition-all shadow-sm">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continuer avec Google
          </button>
        </div>

        <p className="text-center mt-4 text-xs text-gray-400 font-semibold">
          🔒 Données sécurisées et privées
        </p>
      </div>
    </div>
  )
}
