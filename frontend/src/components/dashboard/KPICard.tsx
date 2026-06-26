import { ReactNode } from 'react'
import { ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface KPICardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  icon?: ReactNode
  color?: 'blue' | 'green' | 'amber' | 'red'
  className?: string
}

export default function KPICard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon,
  color = 'blue',
  className,
}: KPICardProps) {
  const colorStyles = {
    blue: 'bg-primary',
    green: 'bg-success',
    amber: 'bg-warning',
    red: 'bg-destructive',
  }

  const trendIcons = {
    up: ArrowUp,
    down: ArrowDown,
    neutral: Minus,
  }

  const TrendIcon = trend ? trendIcons[trend] : undefined

  return (
    <div className={cn('rounded-lg border border-border bg-card p-6 shadow-sm', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          )}
          {trend && trendValue && TrendIcon && (
            <div className={cn(
              'mt-2 flex items-center gap-1 text-sm',
              trend === 'up' && 'text-success',
              trend === 'down' && 'text-destructive',
              trend === 'neutral' && 'text-muted-foreground'
            )}>
              <TrendIcon className="h-4 w-4" />
              {trendValue}
            </div>
          )}
        </div>
        {icon && (
          <div className={cn('flex h-12 w-12 items-center justify-center rounded-lg', colorStyles[color])}>
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}
