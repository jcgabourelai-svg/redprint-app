import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

type ToastType = 'success' | 'error' | 'info'

interface ToastMsg {
  id: number
  type: ToastType
  text: string
}

interface ToastApi {
  success: (text: string) => void
  error: (text: string) => void
  info: (text: string) => void
}

const ToastCtx = createContext<ToastApi | null>(null)

const icons: Record<ToastType, string> = {
  success: '✅',
  error: '⚠️',
  info: 'ℹ️',
}

const tones: Record<ToastType, string> = {
  success: 'bg-emerald-600',
  error: 'bg-red-600',
  info: 'bg-gray-900',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  const idRef = useRef(0)

  const push = useCallback((type: ToastType, text: string) => {
    const id = ++idRef.current
    setToasts((prev) => [...prev.slice(-3), { id, type, text }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3200)
  }, [])

  const value = useMemo<ToastApi>(
    () => ({
      success: (text: string) => push('success', text),
      error: (text: string) => push('error', text),
      info: (text: string) => push('info', text),
    }),
    [push]
  )

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed left-1/2 top-3 z-[100] w-[92%] max-w-sm -translate-x-1/2 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-medium text-white shadow-lg ${tones[t.type]}`}
          >
            <span>{icons[t.type]}</span>
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider')
  return ctx
}
