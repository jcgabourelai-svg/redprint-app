import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, Search, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CreatableSelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface CreatableSelectProps {
  options: CreatableSelectOption[]
  value?: string
  onChange: (value: string) => void
  onCreate?: (label: string) => Promise<string | number | null | undefined> | string | number | null | undefined
  canCreate?: boolean
  placeholder?: string
  searchPlaceholder?: string
  createLabel?: (label: string) => string
  disabled?: boolean
  error?: boolean
  loading?: boolean
  className?: string
}

export default function CreatableSelect({
  options,
  value,
  onChange,
  onCreate,
  canCreate = false,
  placeholder = 'Seleccionar...',
  searchPlaceholder = 'Buscar...',
  createLabel,
  disabled = false,
  error = false,
  loading = false,
  className,
}: CreatableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [creating, setCreating] = useState(false)
  const selectRef = useRef<HTMLDivElement>(null)

  const normalizedSearch = searchTerm.trim().toLowerCase()

  const filteredOptions = normalizedSearch
    ? options.filter((option) => option.label.toLowerCase().includes(normalizedSearch))
    : options

  // Existe una opción que coincide exactamente (ignorando mayúsc/espacios) con el texto buscado?
  const exactMatchExists = filteredOptions.some(
    (option) => option.label.trim().toLowerCase() === normalizedSearch
  )

  const showCreateOption =
    canCreate && !!onCreate && normalizedSearch.length > 0 && !exactMatchExists

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

  const handleCreate = async () => {
    if (!onCreate) return
    const label = searchTerm.trim()
    if (!label) return

    setCreating(true)
    try {
      const newId = await onCreate(label)
      if (newId != null) {
        onChange(String(newId))
      }
      setIsOpen(false)
      setSearchTerm('')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div ref={selectRef} className={cn('relative w-full', className)}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-destructive focus:ring-destructive'
        )}
      >
        <span className={selectedOption ? 'text-foreground truncate' : 'text-muted-foreground'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>

      {isOpen && (
        <div
          className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-lg"
          role="listbox"
        >
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
                className="w-full rounded-md border border-input bg-card py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto py-1">
            {loading ? (
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                Cargando...
              </div>
            ) : filteredOptions.length === 0 && !showCreateOption ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                {normalizedSearch ? 'Sin resultados' : 'No hay opciones'}
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
                    'flex w-full items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-muted focus:bg-muted focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
                    value === option.value && 'bg-primary/10',
                    option.disabled && 'text-muted-foreground'
                  )}
                >
                  <span>{option.label}</span>
                  {value === option.value && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))
            )}

            {showCreateOption && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10 focus:outline-none disabled:opacity-50"
              >
                {creating ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                <span>
                  {createLabel
                    ? createLabel(searchTerm.trim())
                    : `Crear «${searchTerm.trim()}»`}
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
