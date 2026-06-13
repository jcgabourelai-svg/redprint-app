import { useState, ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Search, Filter, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import Button from './Button'

export interface Column<T> {
  key: string
  label: string
  sortable?: boolean
  sortableKey?: keyof T
  render?: (value: any, row: T) => ReactNode
}

export interface FilterOption {
  label: string
  value: string
}

export interface FilterConfig {
  key: string
  label: string
  options?: FilterOption[]
  type?: 'select' | 'text'
  placeholder?: string
}

export interface TableProps<T> {
  data: T[]
  columns: Column<T>[]
  searchable?: boolean
  sortable?: boolean
  paginatable?: boolean
  pageSize?: number
  emptyMessage?: string
  className?: string
  filters?: FilterConfig[]
  filterState?: Record<string, string>
  onFilterChange?: (filters: Record<string, string>) => void
  onRowClick?: (row: T) => void
}

export default function Table<T extends Record<string, any>>({
  data,
  columns,
  searchable = true,
  sortable = true,
  paginatable = true,
  pageSize = 25,
  emptyMessage = 'No hay datos disponibles',
  className,
  filters,
  filterState,
  onFilterChange,
  onRowClick,
}: TableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortColumn, setSortColumn] = useState<keyof T | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [currentPage, setCurrentPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)
  const [internalFilters, setInternalFilters] = useState<Record<string, string>>({})

  const isControlled = onFilterChange !== undefined
  const activeFilters = isControlled && filterState ? filterState : internalFilters

  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length

  const setFilterValue = (key: string, value: string) => {
    const next = { ...activeFilters, [key]: value }
    if (onFilterChange) onFilterChange(next)
    else setInternalFilters(next)
    setCurrentPage(1)
  }

  const clearFilters = () => {
    if (onFilterChange) onFilterChange({})
    else setInternalFilters({})
    setSearchTerm('')
    setCurrentPage(1)
  }

  const filteredData = data
    .filter((row) => {
      if (isControlled) return true
      return Object.entries(activeFilters).every(([key, value]) => {
        if (!value) return true
        return String(row[key as keyof T]).toLowerCase() === value.toLowerCase()
      })
    })
    .filter((row) =>
      Object.values(row).some((value) =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    )

  const sortedData = sortable && sortColumn
    ? [...filteredData].sort((a, b) => {
        const aValue = a[sortColumn]
        const bValue = b[sortColumn]

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
        return 0
      })
    : filteredData

  const paginatedData = paginatable
    ? sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : sortedData

  const totalPages = Math.ceil(sortedData.length / pageSize)

  const handleSort = (column: Column<T>) => {
    if (!column.sortable || !sortable) return

    const key = column.sortableKey || column.key
    if (sortColumn === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(key as keyof T)
      setSortDirection('asc')
    }
  }

  return (
    <div className={cn('w-full', className)}>
      {searchable && (
        <div className="mb-4 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Buscar en tabla"
              />
            </div>
            {filters && filters.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowFilters((v) => !v)}
              >
                <Filter className="mr-2 h-4 w-4" />
                Filtros
                {activeFilterCount > 0 && (
                  <span className="ml-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1 text-xs text-white">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            )}
          </div>

          {showFilters && filters && filters.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {filters.map((filter) => (
                  <div key={filter.key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {filter.label}
                    </label>
                    {filter.type === 'text' ? (
                      <input
                        type="text"
                        placeholder={filter.placeholder || ''}
                        value={activeFilters[filter.key] || ''}
                        onChange={(e) => setFilterValue(filter.key, e.target.value)}
                        className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <select
                        value={activeFilters[filter.key] || 'all'}
                        onChange={(e) => {
                          const value = e.target.value === 'all' ? '' : e.target.value
                          setFilterValue(filter.key, value)
                        }}
                        className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">Todos</option>
                        {(filter.options || []).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
              {activeFilterCount > 0 && (
                <div className="mt-3 flex justify-end">
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Limpiar filtros
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full divide-y divide-gray-200 bg-white">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  onClick={() => handleSort(column)}
                  className={cn(
                    'px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500',
                    column.sortable && sortable && 'cursor-pointer hover:bg-gray-100'
                  )}
                >
                  <div className="flex items-center gap-2">
                    {column.label}
                    {column.sortable && sortable && (
                      <ArrowUpDown className="h-3 w-3 text-gray-400" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-12 text-center text-sm text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    'transition-colors hover:bg-gray-50',
                    onRowClick && 'cursor-pointer'
                  )}
                >
                  {columns.map((column) => (
                    <td key={column.key} className="px-6 py-4 text-sm text-gray-700">
                      {column.render
                        ? column.render(row[column.key], row)
                        : String(row[column.key] || '-')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {paginatable && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Mostrando {((currentPage - 1) * pageSize) + 1} a{' '}
            {Math.min(currentPage * pageSize, sortedData.length)} de{' '}
            {sortedData.length}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-3 py-1 text-sm text-gray-600">
              {currentPage} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              aria-label="Página siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
