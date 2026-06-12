import { cn } from '@/lib/utils'

const progressColors = {
  default: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
  info: 'bg-info',
}

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  label?: string
  color?: keyof typeof progressColors
}

function ProgressBar({ value, label, color = 'default', className, ...props }: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value))

  return (
    <div className={cn('w-full space-y-1', className)} {...props}>
      {label && (
        <div className="flex justify-between text-sm">
          <span className="font-medium text-foreground">{label}</span>
          <span className="text-muted-foreground">{clampedValue}%</span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn('h-full rounded-full transition-all duration-300 ease-in-out', progressColors[color])}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  )
}

export { ProgressBar }
