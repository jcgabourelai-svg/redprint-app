import { cn } from '@/lib/utils'

export interface ProgressBarProps {
  value: number
  max?: number
  color?: 'primary' | 'success' | 'warning' | 'error'
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

export default function ProgressBar({
  value,
  max = 100,
  color = 'primary',
  size = 'md',
  showLabel = false,
  className,
}: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100)

  const sizeStyles = {
    sm: 'h-2',
    md: 'h-4',
    lg: 'h-6',
  }

  const colorStyles = {
    primary: 'bg-blue-500',
    success: 'bg-green-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
  }

  return (
    <div className={cn('w-full', className)}>
      <div
        className="relative w-full overflow-hidden rounded-full bg-gray-200"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className={cn(
            'transition-all duration-300 ease-in-out',
            sizeStyles[size],
            colorStyles[color]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <p className="mt-1 text-xs text-gray-600">
          {value} de {max} ({percentage.toFixed(0)}%)
        </p>
      )}
    </div>
  )
}
