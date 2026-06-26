import { Printer, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PrinterItem {
  id: string
  name: string
  model: string
  profitability: number
  trend?: 'up' | 'down'
}

export interface TopProfitabilityCardProps {
  printers: PrinterItem[]
  title: string
  viewReportText?: string
  onViewReportClick?: () => void
  className?: string
}

export default function TopProfitabilityCard({
  printers,
  title,
  viewReportText,
  onViewReportClick,
  className,
}: TopProfitabilityCardProps) {
  return (
    <div className={cn('rounded-lg border border-border bg-card shadow-sm', className)}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="font-semibold text-foreground">{title}</h3>
        {viewReportText && onViewReportClick && (
          <button
            onClick={onViewReportClick}
            className="text-sm font-medium text-primary hover:text-primary"
          >
            {viewReportText}
          </button>
        )}
      </div>
      <div className="divide-y divide-border">
        {printers.map((printer, index) => (
          <div
            key={printer.id}
            className="flex items-center gap-3 px-4 py-3 hover:bg-muted"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
              <span className="text-sm font-semibold text-muted-foreground">{index + 1}</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Printer className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">{printer.name}</p>
              </div>
              <p className="text-xs text-muted-foreground">{printer.model}</p>
            </div>
            <div className="text-right">
              <p className={cn(
                'text-sm font-semibold',
                printer.profitability >= 0 ? 'text-success' : 'text-destructive'
              )}>
                {printer.profitability >= 0 ? '+' : ''}${printer.profitability.toLocaleString('es-MX')}
              </p>
              {printer.trend && (
                <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                  {printer.trend === 'up' ? (
                    <TrendingUp className="h-3 w-3 text-success" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-destructive" />
                  )}
                  {printer.trend === 'up' ? 'Tendencia +' : 'Tendencia -'}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
