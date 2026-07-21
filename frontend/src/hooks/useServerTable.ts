import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { PaginatedResponse } from '@/types/api'
import { useDebounce } from './useDebounce'

export interface UseServerTableOptions<T> {
  /** Query key base (se le añade el objeto `params` interno). */
  queryKey: string[]
  /** Obtiene la página actual del servidor dado el objeto de params. */
  fetcher: (params: Record<string, unknown>) => Promise<PaginatedResponse<T>>
  /** Tamaño de página por defecto. */
  pageSize?: number
  /** Retardo del debounce de búsqueda (ms). */
  debounceMs?: number
  /** Orden inicial (columna + dirección). */
  defaultSort?: { column: string; dir: 'asc' | 'desc' }
  /** Filtros fijos o extra server-side por vista (estado, fechas, etc.). */
  extraParams?: Record<string, unknown>
}

function pickLastPage(d: PaginatedResponse<unknown> | undefined): number {
  if (!d) return 1
  return d.meta?.last_page ?? d.last_page ?? 1
}

function pickTotal(d: PaginatedResponse<unknown> | undefined): number {
  if (!d) return 0
  return d.meta?.total ?? d.total ?? d.data.length
}

/**
 * Hook reutilizable para tablas con búsqueda, orden y paginación **server-side**.
 *
 * Centraliza el estado de `page`, `search` (con debounce), `sort` y filtros, y
 * devuelve un objeto `tableProps` listo para esparcir sobre `<Table>`.
 */
export function useServerTable<T>({
  queryKey,
  fetcher,
  pageSize: initialPageSize = 25,
  debounceMs = 350,
  defaultSort,
  extraParams,
}: UseServerTableOptions<T>) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, debounceMs)
  const [sortColumn, setSortColumn] = useState<string | null>(defaultSort?.column ?? null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(defaultSort?.dir ?? 'asc')
  const [filters, setFilters] = useState<Record<string, string>>({})

  // Serializamos `extraParams`/`filters` para que cambios de identidad del
  // objeto (común cuando el consumidor lo crea inline) no disparen un nuevo
  // queryKey y, por tanto, un refetch en cada render. Sólo el contenido real
  // afecta a la query.
  const filtersKey = JSON.stringify(filters)
  const extraParamsKey = JSON.stringify(extraParams ?? {})

  const params = useMemo(() => {
    const p: Record<string, unknown> = {
      page,
      per_page: pageSize,
    }
    if (debouncedSearch.trim() !== '') p.search = debouncedSearch
    if (sortColumn) {
      p.sort_by = sortColumn
      p.sort_dir = sortDirection
    }
    const parsedFilters: Record<string, string> = JSON.parse(filtersKey)
    for (const [k, v] of Object.entries(parsedFilters)) {
      if (v !== '' && v != null) p[k] = v
    }
    const parsedExtra: Record<string, unknown> = JSON.parse(extraParamsKey)
    for (const [k, v] of Object.entries(parsedExtra)) {
      if (v !== '' && v != null && v !== undefined) p[k] = v
    }
    return p
  }, [page, pageSize, debouncedSearch, sortColumn, sortDirection, filtersKey, extraParamsKey])

  const query = useQuery<PaginatedResponse<T>>({
    queryKey: [...queryKey, params],
    queryFn: () => fetcher(params),
    placeholderData: (prev) => prev,
  })

  const items = query.data?.data ?? []

  const resetPage = useCallback(() => setPage(1), [])

  const onSearchChange = useCallback(
    (value: string) => {
      setSearch(value)
      resetPage()
    },
    [resetPage]
  )

  const onSortChange = useCallback(
    (column: string, direction: 'asc' | 'desc') => {
      setSortColumn(column)
      setSortDirection(direction)
      resetPage()
    },
    [resetPage]
  )

  const onPageChange = useCallback((next: number) => setPage(next), [])

  const onPageSizeChange = useCallback(
    (size: number) => {
      setPageSize(size)
      resetPage()
    },
    [resetPage]
  )

  const onFilterChange = useCallback(
    (next: Record<string, string>) => {
      setFilters(next)
      resetPage()
    },
    [resetPage]
  )

  const tableProps = {
    searchValue: search,
    onSearchChange,
    sortColumn,
    sortDirection,
    onSortChange,
    currentPage: page,
    totalPages: pickLastPage(query.data),
    totalItems: pickTotal(query.data),
    onPageChange,
    pageSize,
    onPageSizeChange,
    filterState: filters,
    onFilterChange,
  }

  // True cuando hay búsqueda, filtros u orden activos que no sean los defaults.
  // Útil para distinguir el estado vacío "virgen" del "filtrado" en las páginas.
  const hasActiveFilters =
    search.trim() !== '' ||
    sortColumn !== (defaultSort?.column ?? null) ||
    sortDirection !== (defaultSort?.dir ?? 'asc') ||
    Object.values(filters).some((v) => v !== '' && v != null)

  return {
    data: items,
    raw: query.data,
    tableProps,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    hasActiveFilters,
  }
}
