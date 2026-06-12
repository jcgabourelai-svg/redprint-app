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
    <div className={cn('rounded-lg border border-gray-200 bg-white shadow-sm', className)}>
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        {viewReportText && onViewReportClick && (
          <button
            onClick={onViewReportClick}
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            {viewReportText}
          </button>
        )}
      </div>
      <div className="divide-y divide-gray-100">
        {printers.map((printer, index) => (
          <div
            key={printer.id}
            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded bg-gray-100">
              <span className="text-sm font-semibold text-gray-600">{index + 1}</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Printer className="h-4 w-4 text-gray-400" />
                <p className="text-sm font-medium text-gray-900">{printer.name}</p>
              </div>
              <p className="text-xs text-gray-500">{printer.model}</p>
            </div>
            <div className="text-right">
              <p className={cn(
                'text-sm font-semibold',
                printer.profitability >= 0 ? 'text-green-600' : 'text-red-600'
              )}>
                {printer.profitability >= 0 ? '+' : ''}${printer.profitability.toLocaleString('es-MX')}
              </p>
              {printer.trend && (
                <div className="flex items-center justify-end gap-1 text-xs text-gray-500">
                  {printer.trend === 'up' ? (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500" />
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
