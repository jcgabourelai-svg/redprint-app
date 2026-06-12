import { Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './Button'

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-4 py-12', className)}
      {...props}
    >
      <div className="text-muted-foreground">
        {icon || <Inbox className="h-12 w-12" />}
      </div>
      <div className="text-center">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actionLabel && onAction && (
        <Button onClick={onAction}>{actionLabel}</Button>
      )}
    </div>
  )
}

export { EmptyState }
