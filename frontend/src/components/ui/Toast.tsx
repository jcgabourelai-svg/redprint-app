import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react'
import type { ColorVariant } from '@/types/colors'

export interface ToastProps {
  isOpen: boolean
  onClose: () => void
  variant?: ColorVariant
  title?: string
  message: string
}

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
  primary: Info,
  neutral: Info,
}

const Toast = ({ isOpen, onClose, variant = 'info', title, message }: ToastProps) => {
  const Icon = icons[variant] || Info

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 20, x: '-50%' }}
          className="fixed bottom-4 left-1/2 z-50 flex w-full max-w-md items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-lg"
        >
          <Icon
            className={`h-5 w-5 flex-shrink-0 ${
              variant === 'success' && 'text-success'
            } ${
              variant === 'error' && 'text-destructive'
            } ${
              variant === 'warning' && 'text-warning'
            } ${
              variant === 'info' && 'text-info'
            }`}
          />
          <div className="flex-1">
            {title && <p className="font-semibold">{title}</p>}
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 hover:bg-muted"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default Toast
