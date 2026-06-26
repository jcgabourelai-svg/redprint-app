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
  success: 'text-success',
  error: 'text-destructive',
  warning: 'text-warning',
  info: 'text-primary',
  primary: 'text-primary',
  neutral: 'text-muted-foreground',
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
    <div className={cn('rounded-lg border border-border bg-card p-4 shadow-sm', className)}>
      <div className="flex gap-3">
        <Icon className={cn('mt-0.5 h-5 w-5 flex-shrink-0', iconStyles[type])} />
        <div className="flex-1">
          <h3 className="font-medium text-foreground">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
          {action && onActionClick && (
            <button
              onClick={onActionClick}
              className="mt-2 text-sm font-medium text-primary hover:text-primary"
            >
              {action}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
