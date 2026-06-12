import { cn } from '@/lib/utils'

export interface DatePickerProps {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  error?: boolean
  className?: string
}

export default function DatePicker({
  value,
  onChange,
  placeholder = 'dd/mm/aaaa',
  disabled = false,
  error = false,
  className,
}: DatePickerProps) {
  return (
    <div className={cn('relative w-full', className)}>
      <input
        type="date"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        aria-label="Selector de fecha"
        className={cn(
          'flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-red-500 focus:ring-red-500'
        )}
      />
    </div>
  )
}
