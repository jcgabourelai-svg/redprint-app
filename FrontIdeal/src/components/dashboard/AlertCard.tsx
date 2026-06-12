import { CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ColorVariant } from '@/types/colors'

export interface AlertProps {
  type: ColorVariant
  title: string
  message: string
  action?: string
  onActionClick?: () => void
  className?: string
}

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
  primary: Info,
  neutral: Info,
}

const iconStyles = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
  primary: 'text-blue-500',
  neutral: 'text-gray-500',
}

export default function AlertCard({
  type,
  title,
  message,
  action,
  onActionClick,
  className,
}: AlertProps) {
  const Icon = icons[type]

  return (
    <div className={cn('rounded-lg border border-gray-200 bg-white p-4 shadow-sm', className)}>
      <div className="flex gap-3">
        <Icon className={cn('mt-0.5 h-5 w-5 flex-shrink-0', iconStyles[type])} />
        <div className="flex-1">
          <h3 className="font-medium text-gray-900">{title}</h3>
          <p className="mt-1 text-sm text-gray-600">{message}</p>
          {action && onActionClick && (
            <button
              onClick={onActionClick}
              className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              {action}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
