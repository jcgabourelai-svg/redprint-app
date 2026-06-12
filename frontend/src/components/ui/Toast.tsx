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
          className="fixed bottom-4 left-1/2 z-50 flex w-full max-w-md items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-lg"
        >
          <Icon
            className={`h-5 w-5 flex-shrink-0 ${
              variant === 'success' && 'text-green-500'
            } ${
              variant === 'error' && 'text-red-500'
            } ${
              variant === 'warning' && 'text-amber-500'
            } ${
              variant === 'info' && 'text-blue-500'
            }`}
          />
          <div className="flex-1">
            {title && <p className="font-semibold">{title}</p>}
            <p className="text-sm text-gray-600">{message}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 hover:bg-gray-100"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default Toast
