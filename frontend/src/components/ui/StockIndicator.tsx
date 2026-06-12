import { cn } from '@/lib/utils'

interface StockIndicatorProps {
  current: number
  threshold: number
}

export default function StockIndicator({ current, threshold }: StockIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'h-2.5 w-2.5 rounded-full',
          current === 0 ? 'bg-red-500' : current <= threshold ? 'bg-yellow-500' : 'bg-green-500'
        )}
      />
      <span className={cn(
        current === 0 ? 'text-red-600 font-medium' : current <= threshold ? 'text-yellow-600' : 'text-gray-700'
      )}>
        {current}
      </span>
    </div>
  )
}
