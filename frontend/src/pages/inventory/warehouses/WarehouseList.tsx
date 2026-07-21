import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Filter, X, Warehouse as WarehouseIcon } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import Modal from '@/components/ui/Modal'
import WarehouseTable from '@/components/warehouse/WarehouseTable'
import WarehouseCard from '@/components/warehouse/WarehouseCard'
import WarehouseForm from '@/components/warehouse/WarehouseForm'
import { useWarehouses, useCreateWarehouse } from '@/hooks/useWarehouses'
import { useIsAdmin } from '@/contexts/AuthContext'


export default function WarehouseList() {
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | 'all'>('all')
  const [responsableFilter, setResponsableFilter] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 25

  const { data, isLoading, error } = useWarehouses({ page: currentPage, per_page: pageSize })
  const createMutation = useCreateWarehouse()

  const warehouses = data?.data || []

  const responsables = useMemo(
    () =>
      [
        ...new Set(
          warehouses
            .map((w) => w.responsable?.nombre ?? w.responsable?.correo)
            .filter((r): r is string => Boolean(r))
        ),
      ].sort(),
    [warehouses]
  )

  const filtered = useMemo(() => {
    return warehouses.filter((w) => {
      const term = searchTerm.toLowerCase()
      const responsable = w.responsable?.nombre ?? w.responsable?.correo ?? ''
      const matchesSearch =
        !term ||
        w.nombre.toLowerCase().includes(term) ||
        w.direccion.toLowerCase().includes(term) ||
        responsable.toLowerCase().includes(term) ||
        String(w.id).toLowerCase().includes(term)

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'activo' && w.activo) ||
        (statusFilter === 'inactivo' && !w.activo)
      const matchesResponsable =
        responsableFilter === 'all' || responsable === responsableFilter

      return matchesSearch && matchesStatus && matchesResponsable
    })
  }, [warehouses, searchTerm, statusFilter, responsableFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const paginated = filtered.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize
  )

  const handleView = useCallback(
    (id: string) => navigate(`/inventario/almacenes/${id}`),
    [navigate]
  )

  const handleCreate = useCallback(
    (data: WarehouseFormData) => {
      createMutation.mutate(data)
      setShowCreateModal(false)
    },
    [createMutation]
  )

  const clearFilters = useCallback(() => {
    setSearchTerm('')
    setStatusFilter('all')
    setResponsableFilter('all')
  }, [])

  const hasActiveFilters =
    statusFilter !== 'all' || responsableFilter !== 'all'

  if (isLoading) {
    return (
      <PageLayout title="Inventario › Almacenes">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout title="Inventario › Almacenes">
        <div className="flex items-center justify-center h-64">
          <p className="text-destructive">Error al cargar almacenes</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Inventario › Almacenes">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Almacenes</h2>
            <p className="text-sm text-muted-foreground">
              Gestión de almacenes y ubicaciones de impresoras
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Almacén
            </Button>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por nombre, dirección, responsable..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full rounded-md border border-input py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Buscar almacenes"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="mr-2 h-4 w-4" />
              Filtros
              {hasActiveFilters && (
                <span className="ml-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-white">
                  !
                </span>
              )}
            </Button>
          </div>

          {showFilters && (
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Estado</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value as string | 'all')
                      setCurrentPage(1)
                    }}
                    className="w-full rounded-md border border-input py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="all">Todos</option>
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Responsable</label>
                  <select
                    value={responsableFilter}
                    onChange={(e) => {
                      setResponsableFilter(e.target.value)
                      setCurrentPage(1)
                    }}
                    className="w-full rounded-md border border-input py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="all">Todos</option>
                    {encargados.map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="mr-1 h-3 w-3" />
                    Limpiar filtros
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {warehouses.length === 0 ? (
          <EmptyState
            icon={WarehouseIcon}
            title="No hay almacenes"
            description="Comienza creando tu primer almacén para gestionar las ubicaciones de impresoras."
            action={
              isAdmin
                ? { label: 'Crear Almacén', onClick: () => setShowCreateModal(true) }
                : undefined
            }
          />
        ) : filtered.length === 0 ? (
          <div className="hidden md:block">
            <WarehouseTable
              warehouses={paginated}
              onView={handleView}
              emptyMessage="No se encontraron almacenes con los filtros aplicados."
            />
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <WarehouseTable
                warehouses={paginated}
                onView={handleView}
              />
            </div>
            <div className="md:hidden space-y-4">
              {paginated.map((w) => (
                <WarehouseCard
                  key={w.id}
                  warehouse={w}
                  onView={handleView}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Mostrando {(safeCurrentPage - 1) * pageSize + 1} a{' '}
                  {Math.min(safeCurrentPage * pageSize, filtered.length)} de {filtered.length}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safeCurrentPage === 1}
                  >
                    Anterior
                  </Button>
                  <span className="px-3 py-1 text-sm text-muted-foreground">
                    {safeCurrentPage} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safeCurrentPage === totalPages}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Nuevo Almacén"
        size="lg"
      >
        <WarehouseForm
          onSubmit={handleCreate}
          onCancel={() => setShowCreateModal(false)}
        />
      </Modal>
    </PageLayout>
  )
}
