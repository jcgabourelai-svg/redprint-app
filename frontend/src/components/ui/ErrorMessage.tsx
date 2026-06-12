import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './Button'

export interface ErrorMessageProps extends React.HTMLAttributes<HTMLDivElement> {
  message?: string
  onRetry?: () => void
}

function ErrorMessage({ message = 'Something went wrong', onRetry, className, ...props }: ErrorMessageProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-4 rounded-lg border border-destructive/20 bg-destructive/5 p-8', className)}
      {...props}
    >
      <AlertCircle className="h-10 w-10 text-destructive" />
      <p className="text-sm text-destructive font-medium">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

export { ErrorMessage }
