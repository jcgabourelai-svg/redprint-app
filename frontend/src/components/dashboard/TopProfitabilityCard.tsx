import { Printer, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/formatters'
import type { PrinterRentabilidad } from '@/types/api'

export interface TopProfitabilityCardProps {
  printers: PrinterRentabilidad[]
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
        {printers.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Sin datos de rentabilidad este mes
          </p>
        )}
        {printers.map((printer, index) => {
          const positivo = printer.margen >= 0
          return (
            <div
              key={printer.impresora_id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
                <span className="text-sm font-semibold text-muted-foreground">{index + 1}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Printer className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">
                    {printer.codigo_negocio || printer.marca}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {printer.modelo}
                  {printer.roi !== null && ` · ROI ${printer.roi.toFixed(1)}%`}
                </p>
              </div>
              <div className="flex items-center gap-1 text-right">
                {positivo ? (
                  <TrendingUp className="h-3 w-3 text-success" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-destructive" />
                )}
                <p className={cn(
                  'text-sm font-semibold',
                  positivo ? 'text-success' : 'text-destructive'
                )}>
                  {formatCurrency(printer.margen)}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
