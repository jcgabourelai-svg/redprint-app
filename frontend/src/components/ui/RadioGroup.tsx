import { cn } from '@/lib/utils'

export interface RadioOption {
  value: string
  label: string
  disabled?: boolean
}

export interface RadioGroupProps {
  name: string
  options: RadioOption[]
  value?: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}

export default function RadioGroup({
  name,
  options,
  value,
  onChange,
  disabled = false,
  className,
}: RadioGroupProps) {
  return (
    <div className={cn('space-y-2', className)} role="radiogroup" aria-label={name}>
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            'flex cursor-pointer items-center',
            disabled && 'cursor-not-allowed opacity-50'
          )}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            disabled={disabled || option.disabled}
            className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="ml-2 text-sm text-gray-700">{option.label}</span>
        </label>
      ))}
    </div>
  )
}
