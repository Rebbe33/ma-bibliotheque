'use client'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'

/* ── Single Toast ── */
interface ToastProps { message: string; type?: 'success' | 'error' | 'info'; onDone: () => void }

const ICONS = { success: '✅', error: '❌', info: '💡' }
const COLORS = {
  success: 'border-mint text-mint-dark',
  error:   'border-coral text-coral-dark',
  info:    'border-violet text-violet-dark',
}

function Toast({ message, type = 'info', onDone }: ToastProps) {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); setTimeout(onDone, 300) }, 2600)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className={`toast border-2 ${COLORS[type]} transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
      {ICONS[type]} {message}
    </div>
  )
}

/* ── Context ── */
interface ToastItem { id: number; message: string; type?: 'success' | 'error' | 'info' }
const ToastCtx = createContext<(msg: string, type?: ToastItem['type']) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const add = useCallback((message: string, type?: ToastItem['type']) => {
    setToasts(t => [...t, { id: Date.now(), message, type }])
  }, [])

  return (
    <ToastCtx.Provider value={add}>
      {children}
      <div className="toast-wrap flex flex-col items-center gap-2">
        {toasts.map(t => (
          <Toast key={t.id} message={t.message} type={t.type}
            onDone={() => setToasts(ts => ts.filter(x => x.id !== t.id))} />
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
