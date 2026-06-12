import { createContext, useContext, useState, useCallback } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextValue {
  addToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within a ToastProvider')
  return context
}

const toastStyles: Record<ToastType, string> = {
  success: 'bg-success text-success-foreground',
  error: 'bg-error text-error-foreground',
  info: 'bg-info text-info-foreground',
  warning: 'bg-warning text-warning-foreground',
}

const AUTO_DISMISS_MS = 4000

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-md px-4 py-3 shadow-lg',
        toastStyles[toast.type],
      )}
    >
      <p className="text-sm font-medium">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="ml-4 rounded-sm opacity-70 hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = crypto.randomUUID()
      setToasts((prev) => [...prev, { id, message, type }])
      setTimeout(() => removeToast(id), AUTO_DISMISS_MS)
    },
    [removeToast],
  )

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
