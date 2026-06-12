import { useState, useRef, useEffect, ReactNode } from 'react'
import { ChevronDown, Check, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps {
  options: SelectOption[]
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  searchable?: boolean
  disabled?: boolean
  error?: boolean
  className?: string
  renderOption?: (option: SelectOption) => ReactNode
}

export default function Select({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar...',
  searchable = false,
  disabled = false,
  error = false,
  className,
  renderOption,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const selectRef = useRef<HTMLDivElement>(null)

  const filteredOptions = searchable
    ? options.filter((option) =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedOption = options.find((option) => option.value === value)

  return (
    <div ref={selectRef} className={cn('relative w-full', className)}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-red-500 focus:ring-red-500'
        )}
      >
        <span className={selectedOption ? 'text-gray-900' : 'text-gray-500'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-500" />
      </button>

      {isOpen && (
        <div
          className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg"
          role="listbox"
        >
          {searchable && (
            <div className="border-b border-gray-200 p-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-md border border-gray-300 py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          <div className="max-h-60 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">
                No hay opciones
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value)
                    setIsOpen(false)
                    setSearchTerm('')
                  }}
                  disabled={option.disabled}
                  role="option"
                  aria-selected={value === option.value}
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-gray-50 focus:bg-gray-50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
                    value === option.value && 'bg-blue-50',
                    option.disabled && 'text-gray-400'
                  )}
                >
                  <span>
                    {renderOption ? renderOption(option) : option.label}
                  </span>
                  {value === option.value && (
                    <Check className="h-4 w-4 text-blue-500" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
